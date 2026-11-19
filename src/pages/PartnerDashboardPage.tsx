import React, { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  Activity,
  Booking,
  PriceLockOffer,
  Review,
  Settlement,
  Venue,
  VenueInventory,
  VenuePartner,
} from '../types/alba';
import {
  createVenueActivity,
  createVenueInventorySlot,
  publishPriceLockOffer,
  submitPartnerRegistration,
  transitionBookingStatus,
  tsToMillis,
} from '../services/firestoreService';
import {
  BENGALURU_LOCALITIES,
  SUPPORTED_CITIES,
  VENUE_CATEGORIES,
} from '../data/bengaluruCatalog';

type PartnerTab =
  | 'overview'
  | 'bookings'
  | 'catalogue'
  | 'inventory'
  | 'pricelock'
  | 'settlements'
  | 'reviews';

export function PartnerDashboardPage() {
  const { firebaseUser, albaUser } = useAuth();
  const [partner, setPartner] = useState<VenuePartner | null>(null);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [inventory, setInventory] = useState<VenueInventory[]>([]);
  const [offers, setOffers] = useState<PriceLockOffer[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<PartnerTab>('overview');
  const [notice, setNotice] = useState('');

  // Onboarding Form State
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<string>(VENUE_CATEGORIES[1]);
  const [city, setCity] = useState('Bengaluru');
  const [locality, setLocality] = useState<string>(BENGALURU_LOCALITIES[0]);
  const [address, setAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [regDetails, setRegDetails] = useState('');
  const [hours, setHours] = useState('10:00 AM – 10:00 PM');
  const [weekdayPrice, setWeekdayPrice] = useState(800);
  const [weekendPrice, setWeekendPrice] = useState(1000);
  const [description, setDescription] = useState('');

  // Activity / Inventory / Price-Lock forms
  const [actName, setActName] = useState('');
  const [actDuration, setActDuration] = useState(60);
  const [invDate, setInvDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 4);
    return d.toISOString().split('T')[0];
  });
  const [invSlot, setInvSlot] = useState('01:00 PM – 04:00 PM');
  const [invTotal, setInvTotal] = useState(20);

  const [offerTitle, setOfferTitle] = useState('Weekend Advance Weekday-Rate Lock');
  const [offerAdvancePrice, setOfferAdvancePrice] = useState(800);
  const [offerSlots, setOfferSlots] = useState(15);
  const [offerExpiry, setOfferExpiry] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});

  const loadPartnerWorkspace = async () => {
    if (!firebaseUser) return;
    setLoading(true);
    try {
      const pSnap = await getDocs(
        query(collection(db, 'venue_partners'), where('userId', '==', firebaseUser.uid), limit(1))
      );
      if (pSnap.empty) {
        setPartner(null);
        setLoading(false);
        return;
      }
      const pData = pSnap.docs[0].data() as VenuePartner;
      setPartner(pData);

      const vSnap = await getDocs(
        query(collection(db, 'venues'), where('partnerUserId', '==', firebaseUser.uid), limit(1))
      );
      const vData = vSnap.empty ? null : (vSnap.docs[0].data() as Venue);
      setVenue(vData);

      const [bSnap, aSnap, iSnap, oSnap, sSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'bookings'),
            where('partnerUserId', '==', firebaseUser.uid),
            limit(50)
          )
        ),
        getDocs(query(collection(db, 'activities'), where('partnerUserId', '==', firebaseUser.uid))),
        getDocs(query(collection(db, 'venue_inventory'), where('partnerUserId', '==', firebaseUser.uid))),
        getDocs(query(collection(db, 'price_lock_offers'), where('partnerUserId', '==', firebaseUser.uid))),
        getDocs(query(collection(db, 'settlements'), where('partnerUserId', '==', firebaseUser.uid))),
      ]);

      setBookings(
        bSnap.docs
          .map((d) => d.data() as Booking)
          .sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt))
      );
      setActivities(aSnap.docs.map((d) => d.data() as Activity));
      setInventory(iSnap.docs.map((d) => d.data() as VenueInventory));
      setOffers(oSnap.docs.map((d) => d.data() as PriceLockOffer));
      setSettlements(sSnap.docs.map((d) => d.data() as Settlement));

      if (vData) {
        const rSnap = await getDocs(
          query(
            collection(db, 'reviews'),
            where('venueId', '==', vData.id),
            where('moderationStatus', '==', 'published'),
            limit(30)
          )
        );
        setReviews(rSnap.docs.map((d) => d.data() as Review));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (firebaseUser) {
      setOwnerName(albaUser?.fullName || firebaseUser.displayName || '');
      loadPartnerWorkspace();
    }
  }, [firebaseUser]);

  const handleRegisterPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !firebaseUser.emailVerified) {
      setNotice('Please verify your email address before applying as a Venue Partner.');
      return;
    }
    await submitPartnerRegistration({
      userId: firebaseUser.uid,
      businessName,
      ownerName,
      email: firebaseUser.email || '',
      phone,
      category,
      address,
      city,
      locality,
      gstNumber,
      registrationDetails: regDetails,
      operatingHours: hours,
      weekdayPrice,
      weekendPrice,
      description,
    });
    setNotice('Partner application submitted! Awaiting Super Admin verification.');
    loadPartnerWorkspace();
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-sm text-slate-600">
        Loading Venue Partner portal...
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div>
            <p className="text-xs font-semibold text-blue-700">Alba Venue Partner Network</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0A1428] mt-1">
              Register Your Venue on Alba
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Submit your Bengaluru venue details for verification. Approved partners publish live
              slots and advance weekday-rate Price-Lock offers.
            </p>
          </div>

          {notice && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
              {notice}
            </div>
          )}

          <form onSubmit={handleRegisterPartner} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Business / Venue Name</label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Owner Name</label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98XXXXXXXX"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {VENUE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {SUPPORTED_CITIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Locality</label>
                <select
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {BENGALURU_LOCALITIES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address</label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN (Optional)</label>
                <input
                  type="text"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Weekday Rate (₹)</label>
                <input
                  type="number"
                  required
                  value={weekdayPrice}
                  onChange={(e) => setWeekdayPrice(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Weekend Rate (₹)</label>
                <input
                  type="number"
                  required
                  value={weekendPrice}
                  onChange={(e) => setWeekendPrice(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Operating Hours</label>
                <input
                  type="text"
                  required
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Business Reg. Details</label>
                <input
                  type="text"
                  value={regDetails}
                  onChange={(e) => setRegDetails(e.target.value)}
                  placeholder="LLP / Pvt Ltd / Trade License"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Venue Description</label>
              <textarea
                rows={3}
                required
                minLength={10}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe group capacity, key activities, and amenities..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-[#0A1428] hover:bg-blue-700 text-white text-sm font-semibold rounded-lg"
            >
              Submit Partner Application for Verification
            </button>
          </form>
        </div>
      </div>
    );
  }

  const grossRevenue = bookings
    .filter((b) => ['confirmed', 'completed'].includes(b.status))
    .reduce((acc, b) => acc + (b.grossAmount || 0), 0);
  const netPayable = bookings
    .filter((b) => ['confirmed', 'completed'].includes(b.status))
    .reduce((acc, b) => acc + (b.merchantPayable || 0), 0);
  const commissionTotal = bookings
    .filter((b) => ['confirmed', 'completed'].includes(b.status))
    .reduce((acc, b) => acc + (b.platformCommission || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <p className="text-xs font-semibold text-blue-700">Venue Partner Console</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0A1428]">
            {partner.businessName}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {partner.locality}, {partner.city} · Platform Commission Rate:{' '}
            <span className="font-mono font-semibold text-slate-800">
              {partner.commissionRatePercent ?? 15}%
            </span>{' '}
            (managed by Alba Admin)
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold">
          {partner.verificationStatus === 'approved' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
              <CheckCircle2 className="w-4 h-4" /> Approved Partner
            </span>
          ) : partner.verificationStatus === 'pending' || partner.verificationStatus === 'under_review' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
              <Clock className="w-4 h-4" /> Verification: {partner.verificationStatus}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-800">
              <AlertTriangle className="w-4 h-4" /> Status: {partner.verificationStatus}
            </span>
          )}
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
          {notice}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl">
        {(
          [
            ['overview', 'Overview'],
            ['bookings', `Bookings (${bookings.length})`],
            ['catalogue', 'Activities'],
            ['inventory', 'Slots & Calendar'],
            ['pricelock', 'Price-Lock Offers'],
            ['settlements', 'Commission & Payouts'],
            ['reviews', `Reviews (${reviews.length})`],
          ] as [PartnerTab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap ${
              tab === k ? 'bg-white text-[#0A1428] shadow-sm' : 'text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="text-xs text-slate-500">Pending Requests</p>
            <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {bookings.filter((b) => b.status === 'pending').length}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="text-xs text-slate-500">Gross Confirmed Value</p>
            <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              ₹{grossRevenue.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="text-xs text-slate-500">Alba Commission</p>
            <p className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              ₹{commissionTotal.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="text-xs text-slate-500">Net Partner Payable</p>
            <p className="font-mono text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
              ₹{netPayable.toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      )}

      {tab === 'bookings' && (
        <div className="space-y-3">
          {bookings.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-600">
              No booking requests received yet.
            </div>
          ) : (
            bookings.map((b) => (
              <div
                key={b.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <p className="text-xs text-slate-500">
                    <span className="font-mono">{b.id}</span> · Status:{' '}
                    <strong className="uppercase text-blue-700">{b.status}</strong> · Payment:{' '}
                    {b.paymentStatus}
                  </p>
                  <h3 className="font-semibold text-slate-900 mt-1">
                    {b.customerName || 'Customer'} · {b.participants} guests
                  </h3>
                  <p className="text-xs text-slate-600">
                    {b.activityDate} · {b.timeSlot} · Gross ₹{b.grossAmount} · Net ₹
                    {b.merchantPayable || b.grossAmount}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {b.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          await transitionBookingStatus({
                            booking: b,
                            nextStatus: 'accepted',
                            actorId: firebaseUser!.uid,
                            note: 'Accepted by Venue Partner',
                          });
                          loadPartnerWorkspace();
                        }}
                        className="px-3 py-1.5 bg-blue-700 text-white text-xs font-semibold rounded-lg"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await transitionBookingStatus({
                            booking: b,
                            nextStatus: 'rejected',
                            actorId: firebaseUser!.uid,
                            note: 'Rejected by Venue Partner',
                          });
                          loadPartnerWorkspace();
                        }}
                        className="px-3 py-1.5 border border-red-200 text-red-700 text-xs font-semibold rounded-lg"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {b.status === 'accepted' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await transitionBookingStatus({
                          booking: b,
                          nextStatus: 'confirmed',
                          actorId: firebaseUser!.uid,
                          note: 'Confirmed by Venue Partner',
                        });
                        loadPartnerWorkspace();
                      }}
                      className="px-3 py-1.5 bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                    >
                      Mark Confirmed
                    </button>
                  )}
                  {b.status === 'confirmed' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await transitionBookingStatus({
                          booking: b,
                          nextStatus: 'completed',
                          actorId: firebaseUser!.uid,
                          note: 'Activity completed',
                        });
                        loadPartnerWorkspace();
                      }}
                      className="px-3 py-1.5 bg-[#0A1428] text-white text-xs font-semibold rounded-lg"
                    >
                      Mark Completed
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'catalogue' && venue && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await createVenueActivity({
                venueId: venue.id,
                partnerUserId: firebaseUser!.uid,
                name: actName,
                category: venue.category,
                description: `${actName} session at ${venue.name}`,
                durationMinutes: actDuration,
              });
              setActName('');
              loadPartnerWorkspace();
            }}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-3"
          >
            <h3 className="font-bold text-slate-900">Add Bookable Activity</h3>
            <input
              type="text"
              required
              value={actName}
              onChange={(e) => setActName(e.target.value)}
              placeholder="Activity name (e.g. Sunset Zipline Circuit)"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
            <input
              type="number"
              value={actDuration}
              onChange={(e) => setActDuration(Number(e.target.value) || 60)}
              placeholder="Duration (minutes)"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
            />
            <button
              type="submit"
              className="w-full py-2 bg-[#0A1428] text-white text-xs font-semibold rounded-lg"
            >
              Add Activity
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            {activities.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 text-sm text-slate-600">
                No activities added yet.
              </div>
            ) : (
              activities.map((a) => (
                <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-4">
                  <h4 className="font-semibold text-slate-900">{a.name}</h4>
                  <p className="text-xs text-slate-500">
                    {a.category} · {a.durationMinutes} mins
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'inventory' && venue && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await createVenueInventorySlot({
                venueId: venue.id,
                partnerUserId: firebaseUser!.uid,
                date: invDate,
                timeSlot: invSlot,
                totalSlots: invTotal,
              });
              setNotice('Slot inventory saved.');
              loadPartnerWorkspace();
            }}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-3"
          >
            <h3 className="font-bold text-slate-900">Publish Available Slots</h3>
            <input
              type="date"
              required
              value={invDate}
              onChange={(e) => setInvDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
            <input
              type="text"
              required
              value={invSlot}
              onChange={(e) => setInvSlot(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
            <input
              type="number"
              min={1}
              value={invTotal}
              onChange={(e) => setInvTotal(Number(e.target.value) || 10)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
            />
            <button
              type="submit"
              className="w-full py-2 bg-[#0A1428] text-white text-xs font-semibold rounded-lg"
            >
              Save Slot Capacity
            </button>
          </form>

          <div className="lg:col-span-7 space-y-2">
            {inventory.map((inv) => (
              <div
                key={inv.id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between text-xs"
              >
                <span>
                  <strong>{inv.date}</strong> · {inv.timeSlot}
                </span>
                <span className="font-mono font-semibold tabular-nums">
                  {inv.availableSlots} / {inv.totalSlots} slots
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'pricelock' && venue && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-slate-900">Publish Advance Price-Lock Offer</h3>
            {partner.verificationStatus !== 'approved' ? (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-lg">
                Only approved Venue Partners can publish live Advance Price-Lock offers.
              </p>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await publishPriceLockOffer({
                    venue,
                    partnerUserId: firebaseUser!.uid,
                    title: offerTitle,
                    weekdayPrice: venue.weekdayPrice,
                    weekendPrice: venue.weekendPrice,
                    albaAdvancePrice: offerAdvancePrice,
                    availableSlots: offerSlots,
                    activityDate: invDate,
                    bookingDeadline: offerExpiry,
                    expiresAt: offerExpiry,
                    partnerTerms: 'Valid for bookings placed at least 3 days prior.',
                    cancellationPolicy: 'Reschedule up to 48 hours prior.',
                  });
                  setNotice('Price-Lock Offer published live!');
                  loadPartnerWorkspace();
                }}
                className="space-y-3"
              >
                <input
                  type="text"
                  required
                  value={offerTitle}
                  onChange={(e) => setOfferTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  type="number"
                  required
                  value={offerAdvancePrice}
                  onChange={(e) => setOfferAdvancePrice(Number(e.target.value) || 0)}
                  placeholder="Alba Advance Rate (₹)"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
                <input
                  type="number"
                  required
                  value={offerSlots}
                  onChange={(e) => setOfferSlots(Number(e.target.value) || 10)}
                  placeholder="Available slots"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
                <input
                  type="date"
                  required
                  value={offerExpiry}
                  onChange={(e) => setOfferExpiry(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                >
                  Publish Official Offer
                </button>
              </form>
            )}
          </div>

          <div className="lg:col-span-7 space-y-3">
            {offers.map((o) => (
              <div key={o.id} className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-emerald-700 uppercase">{o.offerStatus}</p>
                <h4 className="font-semibold text-slate-900">{o.title}</h4>
                <p className="text-xs text-slate-600 font-mono mt-1">
                  Advance ₹{o.albaAdvancePrice} vs Weekend ₹{o.weekendPrice} · Min {o.minAdvanceDays} days ahead
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'settlements' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3">Settlement ID</th>
                <th className="px-4 py-3 text-right">Gross</th>
                <th className="px-4 py-3 text-right">Commission</th>
                <th className="px-4 py-3 text-right">Net Payable</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payout Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {settlements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No settlement batches recorded yet.
                  </td>
                </tr>
              ) : (
                settlements.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-mono">{s.id}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">₹{s.grossAmount}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">₹{s.commissionDeducted}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">₹{s.netPayable}</td>
                    <td className="px-4 py-3 uppercase font-semibold">{s.status}</td>
                    <td className="px-4 py-3 font-mono">{s.payoutReference || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'reviews' && (
        <div className="space-y-3">
          {reviews.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-600">
              No verified reviews yet.
            </div>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-900">{r.customerName}</span>
                  <span className="font-mono font-bold text-amber-600">{r.rating}/5 ★</span>
                </div>
                <p className="text-sm text-slate-700">{r.comment}</p>
                {r.partnerResponse ? (
                  <p className="text-xs text-slate-600 pt-2 border-t border-slate-100">
                    <strong>Your Response:</strong> {r.partnerResponse}
                  </p>
                ) : (
                  <div className="flex gap-2 pt-2">
                    <input
                      type="text"
                      value={replyMap[r.id] || ''}
                      onChange={(e) => setReplyMap((p) => ({ ...p, [r.id]: e.target.value }))}
                      placeholder="Respond to customer review..."
                      className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const text = replyMap[r.id];
                        if (!text?.trim()) return;
                        await updateDoc(doc(db, 'reviews', r.id), {
                          partnerResponse: text.trim(),
                          updatedAt: serverTimestamp(),
                        });
                        loadPartnerWorkspace();
                      }}
                      className="px-3 py-1.5 bg-[#0A1428] text-white text-xs font-semibold rounded-lg"
                    >
                      Reply
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
