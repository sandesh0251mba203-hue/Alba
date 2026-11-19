import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import {
  User,
  Compass,
  Users,
  Heart,
  CalendarCheck,
  Bell,
  LifeBuoy,
  LogOut,
  CopyPlus,
  Star,
  ShieldCheck,
} from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  AppNotification,
  Booking,
  Favourite,
  Group,
  Itinerary,
  PaymentRecord,
  PriceLockOffer,
  SupportMessage,
  SupportTicket,
} from '../types/alba';
import {
  addSupportMessage,
  createSupportTicket,
  duplicateItinerary,
  fetchActivePriceLockOffers,
  fetchCustomerBookings,
  fetchUserFavourites,
  fetchUserGroups,
  fetchUserItineraries,
  joinGroupByInviteCode,
  markNotificationRead,
  recordCustomerPaymentReference,
  submitVerifiedReview,
  subscribeUserNotifications,
  toggleFavourite,
  transitionBookingStatus,
  tsToMillis,
  updateCustomerProfile,
} from '../services/firestoreService';
import { SUPPORTED_CITIES, VENUE_CATEGORIES } from '../data/bengaluruCatalog';

type TabKey =
  | 'trips'
  | 'itineraries'
  | 'bookings'
  | 'favourites'
  | 'offers'
  | 'notifications'
  | 'support'
  | 'profile';

export function CustomerDashboardPage() {
  const { firebaseUser, albaUser, profile, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabKey>('bookings');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [favourites, setFavourites] = useState<Favourite[]>([]);
  const [offers, setOffers] = useState<PriceLockOffer[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<SupportMessage[]>([]);

  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [upiRefInput, setUpiRefInput] = useState<Record<string, string>>({});
  const [reviewForm, setReviewForm] = useState<{
    booking: Booking;
    rating: number;
    comment: string;
  } | null>(null);

  // Profile fields
  const [pName, setPName] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pCity, setPCity] = useState('Bengaluru');
  const [pGroupSize, setPGroupSize] = useState(6);
  const [pBudget, setPBudget] = useState(2000);
  const [pInterests, setPInterests] = useState<string[]>([]);

  // New Ticket fields
  const [tSubject, setTSubject] = useState('');
  const [tCategory, setTCategory] = useState('Booking Support');
  const [tMessage, setTMessage] = useState('');
  const [replyText, setReplyText] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (profile) {
      setPName(profile.fullName || '');
      setPPhone(profile.phone || '');
      setPCity(profile.city || 'Bengaluru');
      setPGroupSize(profile.typicalGroupSize || 6);
      setPBudget(profile.budgetPreference || 2000);
      setPInterests(profile.interests || []);
    }
  }, [profile]);

  const loadAllCustomerData = async () => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    const [bList, gList, iList, fList, oList, pSnap, tSnap] = await Promise.all([
      fetchCustomerBookings(uid),
      fetchUserGroups(uid),
      fetchUserItineraries(uid),
      fetchUserFavourites(uid),
      fetchActivePriceLockOffers(),
      getDocs(query(collection(db, 'payments'), where('customerId', '==', uid), limit(40))),
      getDocs(
        query(
          collection(db, 'support_tickets'),
          where('userId', '==', uid),
          limit(30)
        )
      ),
    ]);
    setBookings(bList);
    setGroups(gList);
    setItineraries(iList);
    setFavourites(fList);
    setOffers(oList);
    setPayments(pSnap.docs.map((d) => d.data() as PaymentRecord));
    setTickets(
      tSnap.docs
        .map((d) => d.data() as SupportTicket)
        .sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt))
    );
  };

  useEffect(() => {
    if (!firebaseUser) return;
    loadAllCustomerData().catch(() => {});
    const unsub = subscribeUserNotifications(firebaseUser.uid, setNotifications);
    return () => unsub();
  }, [firebaseUser]);

  useEffect(() => {
    if (!selectedTicket || !firebaseUser) return;
    getDocs(
      query(
        collection(db, 'support_messages'),
        where('ticketId', '==', selectedTicket.id),
        where('ticketOwnerId', '==', firebaseUser.uid),
        where('isInternalNote', '==', false)
      )
    )
      .then((snap) =>
        setTicketMessages(
          snap.docs
            .map((d) => d.data() as SupportMessage)
            .sort((a, b) => tsToMillis(a.createdAt) - tsToMillis(b.createdAt))
        )
      )
      .catch(() => setTicketMessages([]));
  }, [selectedTicket, firebaseUser]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    await updateCustomerProfile(firebaseUser.uid, {
      fullName: pName,
      phone: pPhone,
      city: pCity,
      typicalGroupSize: pGroupSize,
      budgetPreference: pBudget,
      interests: pInterests,
      preferredActivities: pInterests,
    });
    await refreshProfile();
    setNotice('Profile preferences saved.');
  };

  const handleJoinCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !inviteCodeInput.trim()) return;
    const gId = await joinGroupByInviteCode({
      inviteCode: inviteCodeInput.trim(),
      userId: firebaseUser.uid,
      displayName: albaUser?.fullName || 'Group Member',
    });
    navigate(`/groups/${gId}`);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !tSubject.trim() || !tMessage.trim()) return;
    await createSupportTicket({
      userId: firebaseUser.uid,
      userName: albaUser?.fullName || 'Alba Customer',
      category: tCategory,
      priority: 'medium',
      subject: tSubject,
      initialMessage: tMessage,
      senderRole: 'customer',
    });
    setTSubject('');
    setTMessage('');
    setNotice('Support ticket submitted.');
    loadAllCustomerData();
  };

  const handleReplyTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !selectedTicket || !replyText.trim()) return;
    await addSupportMessage({
      ticketId: selectedTicket.id,
      ticketOwnerId: firebaseUser.uid,
      senderId: firebaseUser.uid,
      senderRole: 'customer',
      body: replyText,
      isInternalNote: false,
    });
    setReplyText('');
    const snap = await getDocs(
      query(
        collection(db, 'support_messages'),
        where('ticketId', '==', selectedTicket.id),
        where('ticketOwnerId', '==', firebaseUser.uid),
        where('isInternalNote', '==', false)
      )
    );
    setTicketMessages(
      snap.docs
        .map((d) => d.data() as SupportMessage)
        .sort((a, b) => tsToMillis(a.createdAt) - tsToMillis(b.createdAt))
    );
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'bookings', label: 'My Bookings', icon: <CalendarCheck className="w-4 h-4" />, count: bookings.length },
    { key: 'trips', label: 'My Groups', icon: <Users className="w-4 h-4" />, count: groups.length },
    { key: 'itineraries', label: 'Itineraries', icon: <Compass className="w-4 h-4" />, count: itineraries.length },
    { key: 'favourites', label: 'Saved', icon: <Heart className="w-4 h-4" />, count: favourites.length },
    { key: 'offers', label: 'Price-Locks', icon: <ShieldCheck className="w-4 h-4" /> },
    { key: 'notifications', label: 'Alerts', icon: <Bell className="w-4 h-4" />, count: unreadCount },
    { key: 'support', label: 'Support', icon: <LifeBuoy className="w-4 h-4" /> },
    { key: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <p className="text-xs font-semibold text-blue-700">Customer Account</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0A1428]">
            Welcome, {albaUser?.fullName || firebaseUser?.displayName || 'Explorer'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {firebaseUser?.email} · Role: {albaUser?.role || 'customer'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/planner"
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg"
          >
            New AI Itinerary
          </Link>
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="px-3.5 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>

      {notice && (
        <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
          {notice}
        </div>
      )}

      {/* Segmented Navigation */}
      <div className="mt-6 flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setNotice('');
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              tab === t.key ? 'bg-white text-[#0A1428] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
            {typeof t.count === 'number' && t.count > 0 && (
              <span className="font-mono text-[11px] text-blue-700">({t.count})</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {/* BOOKINGS */}
        {tab === 'bookings' && (
          <div className="space-y-4">
            {bookings.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
                <p className="text-base font-semibold text-slate-900">No bookings yet</p>
                <p className="text-sm text-slate-600">
                  Explore Bengaluru venues and submit a booking request to track confirmations here.
                </p>
                <Link
                  to="/explore"
                  className="inline-block px-4 py-2 bg-[#0A1428] text-white text-xs font-semibold rounded-lg"
                >
                  Explore Venues
                </Link>
              </div>
            ) : (
              bookings.map((b) => {
                const pay = payments.find((p) => p.bookingId === b.id);
                return (
                  <div
                    key={b.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs text-slate-500">
                          Ref <span className="font-mono">{b.id}</span> · Status:{' '}
                          <span className="font-semibold text-blue-700 uppercase">{b.status}</span>{' '}
                          · Payment: <span className="font-semibold">{b.paymentStatus}</span>
                        </p>
                        <h3 className="font-display text-lg font-bold text-slate-900 mt-1">
                          {b.venueName}
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {b.activityDate} · {b.timeSlot} · {b.participants} guests
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-xl font-bold text-slate-900 tabular-nums">
                          ₹{b.grossAmount.toLocaleString('en-IN')}
                        </p>
                        {b.priceLockApplied && (
                          <p className="text-xs font-semibold text-emerald-700">
                            Price-Lock Saved ₹{b.customerSavings || 0}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Manual UPI reference recording */}
                    {pay && b.paymentStatus === 'instructions_sent' && !['cancelled', 'rejected'].includes(b.status) && (
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 text-xs text-slate-600">
                          <strong>Payment Instructions:</strong> {pay.upiInstruction}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={upiRefInput[b.id] || ''}
                            onChange={(e) =>
                              setUpiRefInput((prev) => ({ ...prev, [b.id]: e.target.value }))
                            }
                            placeholder="Enter UPI UTR / Ref"
                            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg font-mono"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              const ref = upiRefInput[b.id];
                              if (!ref?.trim()) return;
                              await recordCustomerPaymentReference({
                                booking: b,
                                paymentId: pay.id,
                                transactionRef: ref.trim(),
                                customerId: firebaseUser!.uid,
                              });
                              setNotice('Payment reference recorded. Partner will verify receipt.');
                              loadAllCustomerData();
                            }}
                            className="px-3 py-1.5 bg-[#0A1428] text-white text-xs font-semibold rounded-lg whitespace-nowrap"
                          >
                            Save Ref
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      {['draft', 'pending', 'accepted'].includes(b.status) && (
                        <button
                          type="button"
                          onClick={async () => {
                            await transitionBookingStatus({
                              booking: b,
                              nextStatus: 'cancelled',
                              actorId: firebaseUser!.uid,
                              note: 'Cancelled by customer',
                            });
                            loadAllCustomerData();
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-50 rounded-lg"
                        >
                          Cancel Request
                        </button>
                      )}
                      {b.status === 'confirmed' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await transitionBookingStatus({
                              booking: b,
                              nextStatus: 'refund_requested',
                              actorId: firebaseUser!.uid,
                              note: 'Customer requested refund review',
                            });
                            loadAllCustomerData();
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-amber-800 border border-amber-200 hover:bg-amber-50 rounded-lg"
                        >
                          Request Refund
                        </button>
                      )}
                      {b.status === 'completed' && (
                        <button
                          type="button"
                          onClick={() => setReviewForm({ booking: b, rating: 5, comment: '' })}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg inline-flex items-center gap-1"
                        >
                          <Star className="w-3.5 h-3.5" />
                          Leave Verified Review
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* MY GROUPS */}
        {tab === 'trips' && (
          <div className="space-y-6">
            <form
              onSubmit={handleJoinCode}
              className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center"
            >
              <input
                type="text"
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(e.target.value)}
                placeholder="Paste group invitation code (e.g. alba_abc123)"
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
              >
                Join Group
              </button>
            </form>

            {groups.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-600">
                You are not part of any group outing yet. Generate an itinerary and click Create
                Group Trip to invite friends.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groups.map((g) => (
                  <div key={g.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-slate-500 uppercase">{g.status}</p>
                        <h3 className="font-display text-lg font-bold text-slate-900">{g.name}</h3>
                        <p className="text-xs text-slate-600 mt-1">
                          {g.destination} · {g.tripDate} · {g.memberIds.length} members
                        </p>
                      </div>
                      <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                        ₹{g.budgetPerPerson}/p
                      </span>
                    </div>
                    <Link
                      to={`/groups/${g.id}`}
                      className="inline-block px-4 py-2 bg-[#0A1428] text-white text-xs font-semibold rounded-lg"
                    >
                      Open Group Workspace
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ITINERARIES */}
        {tab === 'itineraries' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {itineraries.length === 0 ? (
              <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-600">
                No saved itineraries yet. Open the AI Itinerary Builder to generate and save your
                first plan.
              </div>
            ) : (
              itineraries.map((it) => (
                <div key={it.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                  <p className="text-xs text-slate-500">
                    {it.destination} · {it.travelDate} · {it.participantsCount} {it.groupType}
                  </p>
                  <h3 className="font-display text-lg font-bold text-slate-900">{it.title}</h3>
                  <p className="text-xs text-slate-600 line-clamp-2">{it.summary}</p>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                      Est. ₹{it.estimatedTotalPerPerson || it.budgetPerPerson}/person
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!firebaseUser) return;
                        await duplicateItinerary(it.id, firebaseUser.uid);
                        setNotice('Itinerary duplicated to your account.');
                        loadAllCustomerData();
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1"
                    >
                      <CopyPlus className="w-3.5 h-3.5" />
                      Duplicate Trip
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* FAVOURITES */}
        {tab === 'favourites' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {favourites.length === 0 ? (
              <div className="sm:col-span-3 bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-600">
                No saved venues yet. Tap the heart icon on any venue or video reel to save it here.
              </div>
            ) : (
              favourites.map((f) => (
                <div key={f.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 uppercase">{f.itemType}</p>
                    <h3 className="font-semibold text-slate-900 mt-0.5">{f.itemTitle}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await toggleFavourite({
                        userId: firebaseUser!.uid,
                        itemType: f.itemType,
                        itemId: f.itemId,
                        itemTitle: f.itemTitle,
                      });
                      loadAllCustomerData();
                    }}
                    className="text-xs text-red-600 font-semibold hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* PRICE-LOCK OFFERS */}
        {tab === 'offers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {offers.length === 0 ? (
              <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-600">
                No partner-published Price-Lock offers are live yet. Check Explore Venues for
                illustrative weekday vs. weekend rate comparisons.
              </div>
            ) : (
              offers.map((o) => (
                <div key={o.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2">
                  <p className="text-xs text-emerald-700 font-semibold">
                    {o.offerStatus === 'active'
                      ? 'Verified Partner Offer'
                      : 'Awaiting Partner Confirmation'}
                  </p>
                  <h3 className="font-display text-lg font-bold text-slate-900">{o.venueName}</h3>
                  <p className="text-xs text-slate-600">{o.title}</p>
                  <div className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                    Lock ₹{o.albaAdvancePrice} <span className="text-slate-400 line-through">₹{o.weekendPrice}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* NOTIFICATIONS */}
        {tab === 'notifications' && (
          <div className="space-y-3">
            {notifications.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-600">
                No notifications yet. Group invites, booking updates, and partner responses appear here.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`bg-white border rounded-xl p-4 flex items-start justify-between gap-4 ${
                    n.isRead ? 'border-slate-200' : 'border-blue-600 bg-blue-50/30'
                  }`}
                >
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{n.title}</h4>
                    <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                  </div>
                  {!n.isRead && (
                    <button
                      type="button"
                      onClick={() => markNotificationRead(n.id)}
                      className="text-xs font-semibold text-blue-700 whitespace-nowrap"
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* SUPPORT */}
        {tab === 'support' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleCreateTicket}
              className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
            >
              <h2 className="font-display text-lg font-bold text-slate-900">New Support Ticket</h2>
              <select
                value={tCategory}
                onChange={(e) => setTCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option>Booking Support</option>
                <option>Refund Request</option>
                <option>Group Planning Help</option>
                <option>Account & Verification</option>
              </select>
              <input
                type="text"
                required
                value={tSubject}
                onChange={(e) => setTSubject(e.target.value)}
                placeholder="Ticket subject"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <textarea
                required
                rows={3}
                value={tMessage}
                onChange={(e) => setTMessage(e.target.value)}
                placeholder="Describe your request"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <button
                type="submit"
                className="w-full py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-lg"
              >
                Submit Ticket
              </button>
            </form>

            <div className="lg:col-span-7 space-y-4">
              {tickets.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-600">
                  No support tickets submitted yet.
                </div>
              ) : (
                tickets.map((t) => (
                  <div
                    key={t.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-500">
                          {t.category} · Status: <span className="font-semibold uppercase">{t.status}</span>
                        </p>
                        <h3 className="font-semibold text-slate-900">{t.subject}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedTicket(selectedTicket?.id === t.id ? null : t)}
                        className="text-xs font-semibold text-blue-700"
                      >
                        {selectedTicket?.id === t.id ? 'Hide Thread' : 'View Thread'}
                      </button>
                    </div>

                    {selectedTicket?.id === t.id && (
                      <div className="pt-3 border-t border-slate-100 space-y-3">
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {ticketMessages.map((m) => (
                            <div key={m.id} className="p-2.5 rounded-lg bg-slate-50 text-xs">
                              <span className="font-semibold text-slate-800 uppercase">{m.senderRole}: </span>
                              <span className="text-slate-700">{m.body}</span>
                            </div>
                          ))}
                        </div>
                        <form onSubmit={handleReplyTicket} className="flex gap-2">
                          <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Write a reply..."
                            className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                          />
                          <button
                            type="submit"
                            className="px-3 py-1.5 bg-[#0A1428] text-white text-xs font-semibold rounded-lg"
                          >
                            Send
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* PROFILE */}
        {tab === 'profile' && (
          <form
            onSubmit={handleSaveProfile}
            className="max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
          >
            <h2 className="font-display text-lg font-bold text-slate-900">Customer Preferences</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone (Optional)</label>
                <input
                  type="text"
                  value={pPhone}
                  onChange={(e) => setPPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                <select
                  value={pCity}
                  onChange={(e) => setPCity(e.target.value)}
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Typical Group Size</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={pGroupSize}
                  onChange={(e) => setPGroupSize(Number(e.target.value) || 4)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Budget Preference (₹/person)</label>
                <input
                  type="number"
                  min={300}
                  step={100}
                  value={pBudget}
                  onChange={(e) => setPBudget(Number(e.target.value) || 2000)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Interests & Preferred Activities</label>
              <div className="flex flex-wrap gap-1.5">
                {VENUE_CATEGORIES.slice(0, 8).map((cat) => {
                  const active = pInterests.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() =>
                        setPInterests((prev) =>
                          prev.includes(cat) ? prev.filter((x) => x !== cat) : [...prev, cat]
                        )
                      }
                      className={`px-2.5 py-1 text-xs rounded-md border ${
                        active ? 'bg-blue-700 text-white border-blue-700' : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-[#0A1428] hover:bg-blue-700 text-white text-sm font-semibold rounded-lg"
            >
              Save Profile
            </button>
          </form>
        )}
      </div>

      {/* Verified Review Modal */}
      {reviewForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-slate-900">
              Verified Review · {reviewForm.booking.venueName}
            </h3>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setReviewForm({ ...reviewForm, rating: num })}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-mono ${
                    reviewForm.rating >= num ? 'bg-amber-50 border-amber-500 text-amber-800' : 'border-slate-200'
                  }`}
                >
                  {num}★
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              value={reviewForm.comment}
              onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
              placeholder="Share honest feedback from your group outing..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewForm(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!firebaseUser || !reviewForm.comment.trim()) return;
                  await submitVerifiedReview({
                    venueId: reviewForm.booking.venueId,
                    bookingId: reviewForm.booking.id,
                    customerId: firebaseUser.uid,
                    customerName: albaUser?.fullName || 'Alba Guest',
                    rating: reviewForm.rating,
                    comment: reviewForm.comment,
                  });
                  setReviewForm(null);
                  setNotice('Verified booking review published.');
                }}
                className="px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg"
              >
                Publish Verified Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
