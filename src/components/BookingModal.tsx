import React, { useMemo, useState } from 'react';
import { X, Calendar, Users, Clock, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PriceLockOffer, Venue } from '../types/alba';
import { useAuth } from '../context/AuthContext';
import { submitBookingRequest } from '../services/firestoreService';

interface BookingModalProps {
  venue: Venue;
  offer?: PriceLockOffer | null;
  defaultParticipants?: number;
  groupId?: string;
  itineraryId?: string;
  onClose: () => void;
  onSuccess?: (bookingId: string) => void;
}

const TIME_SLOTS = [
  '09:30 AM – 12:30 PM',
  '01:00 PM – 04:00 PM',
  '04:30 PM – 07:30 PM',
  '07:30 PM – 10:30 PM',
];

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function BookingModal({
  venue,
  offer,
  defaultParticipants = 6,
  groupId,
  itineraryId,
  onClose,
  onSuccess,
}: BookingModalProps) {
  const { firebaseUser, albaUser } = useAuth();
  const [activityDate, setActivityDate] = useState(addDaysIso(4));
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[1]);
  const [participants, setParticipants] = useState(defaultParticipants);
  const [paymentMethod, setPaymentMethod] = useState<'upi_manual' | 'pay_at_venue'>('upi_manual');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);

  const pricingSummary = useMemo(() => {
    const target = new Date(`${activityDate}T00:00:00`);
    const today = new Date();
    const diffDays = Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const minDays = offer?.minAdvanceDays ?? 3;
    const isConfirmedActiveOffer = offer?.offerStatus === 'active';
    const isDateEligible = diffDays >= minDays;
    const priceLockApplied = Boolean(isConfirmedActiveOffer && isDateEligible);

    const stdUnit = venue.weekendPrice;
    const unitPrice = priceLockApplied && offer ? offer.albaAdvancePrice : venue.weekendPrice;
    const gross = unitPrice * participants;
    const illustrativeSavings =
      offer && isDateEligible ? Math.max(0, (stdUnit - offer.albaAdvancePrice) * participants) : 0;

    return {
      diffDays,
      minDays,
      isDateEligible,
      isConfirmedActiveOffer,
      priceLockApplied,
      stdUnit,
      unitPrice,
      gross,
      illustrativeSavings,
    };
  }, [activityDate, participants, venue, offer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!firebaseUser) {
      setError('Please sign in first to submit a booking request.');
      return;
    }
    if (!firebaseUser.emailVerified) {
      setError('Please verify your email address before submitting a booking request.');
      return;
    }
    setSubmitting(true);
    try {
      const bookingId = await submitBookingRequest({
        customerId: firebaseUser.uid,
        customerName: albaUser?.fullName || firebaseUser.displayName || 'Alba Guest',
        venue,
        activityDate,
        timeSlot,
        participants,
        priceLockOffer: offer || null,
        groupId,
        itineraryId,
        paymentMethod,
      });
      setCreatedBookingId(bookingId);
      onSuccess?.(bookingId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit booking request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full overflow-hidden my-8">
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-[#0A1428] text-white">
          <div>
            <p className="text-xs text-blue-300 font-medium">Alba Multi-Vendor Booking Request</p>
            <h2 id="booking-modal-title" className="text-lg font-bold tracking-tight">
              {venue.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close booking modal"
            className="p-2 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {createdBookingId ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-emerald-950">
                    Booking Request Submitted (Pending Partner Confirmation)
                  </h3>
                  <p className="text-sm text-emerald-900 mt-1">
                    Reference ID: <span className="font-mono font-medium">{createdBookingId}</span>
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 space-y-2">
                <p className="font-semibold text-slate-900">Next Steps & Payment Instructions</p>
                <p>
                  Your request has been queued for the Venue Partner. Slots are only confirmed once
                  the partner accepts your request and verifies inventory.
                </p>
                <p>
                  Estimated Total Locked: <span className="font-mono font-semibold">₹{pricingSummary.gross.toLocaleString('en-IN')}</span>{' '}
                  via {paymentMethod === 'upi_manual' ? 'UPI Reference Recording' : 'Pay at Venue'}.
                  No online charge has been processed automatically.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3">
                <Link
                  to="/account"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors"
                >
                  View in My Bookings
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {venue.isIllustrativeListing && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>Illustrative Reference Venue:</strong> Pricing shown reflects weekday vs.
                    weekend benchmarks awaiting official Venue Partner confirmation. Submitting a
                    request logs your interest in the booking ledger.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Activity Date
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="date"
                      required
                      min={addDaysIso(0)}
                      value={activityDate}
                      onChange={(e) => setActivityDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Participants
                  </label>
                  <div className="relative">
                    <Users className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="number"
                      min={1}
                      max={30}
                      required
                      value={participants}
                      onChange={(e) => setParticipants(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Preferred Time Slot
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setTimeSlot(slot)}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border text-left flex items-center gap-2 transition-colors ${
                        timeSlot === slot
                          ? 'bg-blue-50 border-blue-600 text-blue-800'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{slot}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  MVP Payment Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('upi_manual')}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                      paymentMethod === 'upi_manual'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    UPI Instruction + Ref ID
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('pay_at_venue')}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                      paymentMethod === 'pay_at_venue'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    Pay at Venue on Arrival
                  </button>
                </div>
              </div>

              {/* Price-Lock Eligibility & Breakdown */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-700" />
                    Advance Price-Lock Eligibility
                  </span>
                  <span className="text-xs font-medium text-slate-600">
                    {pricingSummary.diffDays} days ahead (min {pricingSummary.minDays} days)
                  </span>
                </div>

                {pricingSummary.priceLockApplied ? (
                  <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    Verified Partner Price-Lock active! Locking weekday rate ₹
                    {pricingSummary.unitPrice} instead of weekend ₹{pricingSummary.stdUnit}/person.
                  </p>
                ) : offer ? (
                  <p className="text-xs text-slate-600">
                    {offer.offerStatus === 'awaiting_partner_confirmation'
                      ? `Illustrative weekday benchmark: ₹${offer.albaAdvancePrice}/person (saves ₹${pricingSummary.illustrativeSavings} total) — awaiting official partner agreement.`
                      : `Book at least ${pricingSummary.minDays} days in advance to unlock the ₹${offer.albaAdvancePrice} weekday rate.`}
                  </p>
                ) : (
                  <p className="text-xs text-slate-600">
                    Standard venue rate applies: ₹{venue.weekendPrice}/person (weekday rate ₹
                    {venue.weekdayPrice}).
                  </p>
                )}

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-semibold text-slate-900">
                  <span>Request Total ({participants} guests)</span>
                  <span className="font-mono tabular-nums text-base">
                    ₹{pricingSummary.gross.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors"
                >
                  {submitting ? 'Submitting Request...' : 'Submit Booking Request'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
