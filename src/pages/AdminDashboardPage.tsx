import React, { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Download, CheckCircle2 } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  AlbaUser,
  Booking,
  FinancialScenario,
  Group,
  PriceLockOffer,
  Review,
  Settlement,
  SupportMessage,
  SupportTicket,
  Venue,
  VenuePartner,
} from '../types/alba';
import {
  BENGALURU_REFERENCE_VENUES,
  VENTURE_FINANCIAL_SCENARIOS,
} from '../data/bengaluruCatalog';
import {
  addSupportMessage,
  adminVerifyPartner,
  createSettlementRecord,
  transitionBookingStatus,
  tsToMillis,
} from '../services/firestoreService';
import {
  computeScenarioProjection,
  exportBookingsFinancialCsv,
} from '../services/financialService';

type AdminSection =
  | 'overview'
  | 'partners'
  | 'venues'
  | 'bookings'
  | 'customers'
  | 'groups'
  | 'pricelock'
  | 'revenue'
  | 'settlements'
  | 'reviews'
  | 'support'
  | 'audit'
  | 'settings';

export function AdminDashboardPage() {
  const { firebaseUser } = useAuth();
  const [section, setSection] = useState<AdminSection>('overview');

  const [users, setUsers] = useState<AlbaUser[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [partners, setPartners] = useState<VenuePartner[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [offers, setOffers] = useState<PriceLockOffer[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; actorId: string; action: string; entityType: string; entityId: string; details?: string }>>([]);

  const [scenarios, setScenarios] = useState<FinancialScenario[]>(VENTURE_FINANCIAL_SCENARIOS);
  const [selectedScenarioId, setSelectedScenarioId] = useState<'base' | 'conservative' | 'ambitious'>('base');
  const [defaultCommission, setDefaultCommission] = useState(15);
  const [commissionMap, setCommissionMap] = useState<Record<string, number>>({});
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketMsgs, setTicketMsgs] = useState<SupportMessage[]>([]);
  const [adminReply, setAdminReply] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [notice, setNotice] = useState('');

  const loadAdminData = async () => {
    const [uSnap, gSnap, vSnap, pSnap, bSnap, oSnap, sSnap, rSnap, tSnap, aSnap] =
      await Promise.all([
        getDocs(query(collection(db, 'users'), limit(100))),
        getDocs(query(collection(db, 'groups'), limit(100))),
        getDocs(query(collection(db, 'venues'), limit(100))),
        getDocs(query(collection(db, 'venue_partners'), limit(100))),
        getDocs(query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(100))),
        getDocs(query(collection(db, 'price_lock_offers'), limit(100))),
        getDocs(query(collection(db, 'settlements'), limit(100))),
        getDocs(query(collection(db, 'reviews'), limit(100))),
        getDocs(query(collection(db, 'support_tickets'), orderBy('createdAt', 'desc'), limit(100))),
        getDocs(query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(100))),
      ]);

    setUsers(uSnap.docs.map((d) => d.data() as AlbaUser));
    setGroups(gSnap.docs.map((d) => d.data() as Group));
    setVenues(vSnap.docs.map((d) => d.data() as Venue));
    setPartners(pSnap.docs.map((d) => d.data() as VenuePartner));
    setBookings(bSnap.docs.map((d) => d.data() as Booking));
    setOffers(oSnap.docs.map((d) => d.data() as PriceLockOffer));
    setSettlements(sSnap.docs.map((d) => d.data() as Settlement));
    setReviews(rSnap.docs.map((d) => d.data() as Review));
    setTickets(tSnap.docs.map((d) => d.data() as SupportTicket));
    setAuditLogs(aSnap.docs.map((d) => d.data() as typeof auditLogs[number]));
  };

  useEffect(() => {
    loadAdminData().catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedTicket) return;
    getDocs(
      query(
        collection(db, 'support_messages'),
        where('ticketId', '==', selectedTicket.id)
      )
    )
      .then((snap) =>
        setTicketMsgs(
          snap.docs
            .map((d) => d.data() as SupportMessage)
            .sort((a, b) => tsToMillis(a.createdAt) - tsToMillis(b.createdAt))
        )
      )
      .catch(() => setTicketMsgs([]));
  }, [selectedTicket]);

  // Live DB-derived KPIs (zero fabricated numbers!)
  const approvedVenuesCount = venues.filter((v) => v.verificationStatus === 'approved').length;
  const pendingPartnersCount = partners.filter((p) =>
    ['pending', 'under_review'].includes(p.verificationStatus)
  ).length;
  const confirmedBookings = bookings.filter((b) => b.status === 'confirmed');
  const completedBookings = bookings.filter((b) => b.status === 'completed');
  const grossBookingValue = [...confirmedBookings, ...completedBookings].reduce(
    (s, b) => s + (b.grossAmount || 0),
    0
  );
  const platformCommission = [...confirmedBookings, ...completedBookings].reduce(
    (s, b) => s + (b.platformCommission || 0),
    0
  );
  const customerSavings = [...confirmedBookings, ...completedBookings].reduce(
    (s, b) => s + (b.customerSavings || 0),
    0
  );
  const settledTotal = settlements
    .filter((s) => s.status === 'settled')
    .reduce((sum, s) => sum + (s.netPayable || 0), 0);
  const totalPayable = [...confirmedBookings, ...completedBookings].reduce(
    (s, b) => s + (b.merchantPayable || 0),
    0
  );
  const outstandingSettlements = Math.max(0, totalPayable - settledTotal);

  const activeScenario =
    scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0];
  const scenarioProj = computeScenarioProjection(activeScenario);

  const handleSeedReferenceCatalog = async () => {
    if (!firebaseUser) return;
    for (const ref of BENGALURU_REFERENCE_VENUES) {
      await setDoc(doc(db, 'venues', ref.id), {
        id: ref.id,
        partnerId: ref.partnerId,
        partnerUserId: ref.partnerUserId,
        name: ref.name,
        category: ref.category,
        city: ref.city,
        locality: ref.locality,
        address: ref.address || '',
        description: ref.description,
        imageUrl: ref.imageUrl || '',
        operatingHours: ref.operatingHours || '',
        weekdayPrice: ref.weekdayPrice,
        weekendPrice: ref.weekendPrice,
        isIllustrativeListing: true,
        verificationStatus: 'approved',
        lat: ref.lat || 12.97,
        lng: ref.lng || 77.6,
        isDeleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    setNotice('Bengaluru illustrative reference venues seeded into Firestore.');
    loadAdminData();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <p className="text-xs font-semibold text-blue-700">Alba Ltd. Super Admin</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0A1428]">
            Super Admin Command Centre
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            All KPIs below are computed directly from live Cloud Firestore collections.
          </p>
        </div>

        <button
          type="button"
          onClick={() => exportBookingsFinancialCsv(bookings)}
          className="px-4 py-2 bg-[#0A1428] hover:bg-blue-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 self-start"
        >
          <Download className="w-3.5 h-3.5" />
          Export Financial CSV
        </button>
      </div>

      {notice && (
        <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sidebar */}
        <aside className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-3 space-y-1">
          {(
            [
              ['overview', '01. Live KPIs Overview'],
              ['partners', `02. Partner Verification (${pendingPartnersCount})`],
              ['venues', `03. Venue Management (${venues.length})`],
              ['bookings', `04. Booking Management (${bookings.length})`],
              ['customers', `05. Customer Directory (${users.length})`],
              ['groups', `06. Group Management (${groups.length})`],
              ['pricelock', `07. Price-Lock Offers (${offers.length})`],
              ['revenue', '08. Revenue & Scenario Modeler'],
              ['settlements', '09. Partner Settlements'],
              ['reviews', `10. Reviews Moderation (${reviews.length})`],
              ['support', `11. Support & Internal Notes (${tickets.length})`],
              ['audit', `12. Immutable Audit Logs (${auditLogs.length})`],
              ['settings', '13. Commission & Expansion'],
            ] as [AdminSection, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                section === key
                  ? 'bg-[#0A1428] text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </aside>

        {/* Main Viewport */}
        <div className="lg:col-span-9 space-y-6">
          {section === 'overview' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                ['Registered Customers', users.length],
                ['Active Group Organizers', new Set(groups.map((g) => g.organizerId)).size],
                ['Registered Groups', groups.length],
                ['Approved Venues', approvedVenuesCount],
                ['Pending Partners', pendingPartnersCount],
                ['Total Bookings', bookings.length],
                ['Confirmed Bookings', confirmedBookings.length],
                ['Completed Bookings', completedBookings.length],
                ['Gross Booking Value', `₹${grossBookingValue.toLocaleString('en-IN')}`],
                ['Platform Commission', `₹${platformCommission.toLocaleString('en-IN')}`],
                ['Customer Savings', `₹${customerSavings.toLocaleString('en-IN')}`],
                ['Outstanding Settlements', `₹${outstandingSettlements.toLocaleString('en-IN')}`],
              ].map(([label, val]) => (
                <div key={String(label)} className="bg-white border border-slate-200 rounded-2xl p-4">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="font-mono text-xl font-bold text-[#0A1428] mt-1 tabular-nums">
                    {val}
                  </p>
                </div>
              ))}
            </div>
          )}

          {section === 'partners' && (
            <div className="space-y-3">
              {partners.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-600">
                  No venue partner applications submitted yet.
                </div>
              ) : (
                partners.map((p) => (
                  <div
                    key={p.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase text-blue-700">
                        {p.verificationStatus} · {p.category}
                      </p>
                      <h3 className="font-bold text-slate-900">{p.businessName}</h3>
                      <p className="text-xs text-slate-600">
                        Owner: {p.ownerName} · {p.email} · {p.phone} · {p.locality}, {p.city}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={40}
                        value={commissionMap[p.id] ?? p.commissionRatePercent ?? defaultCommission}
                        onChange={(e) =>
                          setCommissionMap((prev) => ({
                            ...prev,
                            [p.id]: Number(e.target.value) || 15,
                          }))
                        }
                        className="w-16 px-2 py-1 text-xs border border-slate-300 rounded font-mono"
                        title="Commission %"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await adminVerifyPartner({
                            partner: p,
                            status: 'approved',
                            commissionRatePercent: commissionMap[p.id] ?? p.commissionRatePercent ?? 15,
                            adminId: firebaseUser!.uid,
                          });
                          setNotice(`Approved ${p.businessName}.`);
                          loadAdminData();
                        }}
                        className="px-3 py-1.5 bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await adminVerifyPartner({
                            partner: p,
                            status: 'rejected',
                            commissionRatePercent: commissionMap[p.id] ?? 15,
                            adminId: firebaseUser!.uid,
                          });
                          loadAdminData();
                        }}
                        className="px-3 py-1.5 border border-red-200 text-red-700 text-xs font-semibold rounded-lg"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {section === 'venues' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">Firestore Venue Registry</h3>
                  <p className="text-xs text-slate-600">
                    Seed Bengaluru illustrative reference venues into Firestore if catalog is empty.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSeedReferenceCatalog}
                  className="px-4 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg"
                >
                  Seed Bengaluru Reference Listings
                </button>
              </div>
              {venues.map((v) => (
                <div key={v.id} className="bg-white border border-slate-200 rounded-xl p-4 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{v.name}</p>
                    <p className="text-slate-500">
                      {v.category} · {v.locality} · {v.isIllustrativeListing ? 'Illustrative' : 'Partner'} · {v.verificationStatus}
                    </p>
                  </div>
                  <span className="font-mono font-semibold">₹{v.weekdayPrice} / ₹{v.weekendPrice}</span>
                </div>
              ))}
            </div>
          )}

          {section === 'bookings' && (
            <div className="space-y-3">
              {bookings.map((b) => (
                <div key={b.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap justify-between items-center gap-3 text-xs">
                  <div>
                    <p className="font-mono text-slate-500">{b.id}</p>
                    <p className="font-bold text-slate-900 text-sm">{b.venueName}</p>
                    <p className="text-slate-600">
                      {b.customerName} · {b.activityDate} · {b.participants} guests · Gross ₹{b.grossAmount} · Comm ₹{b.platformCommission || 0}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold uppercase text-blue-700">{b.status}</span>
                    {b.status === 'refund_requested' && (
                      <button
                        type="button"
                        onClick={async () => {
                          await transitionBookingStatus({
                            booking: b,
                            nextStatus: 'refunded',
                            actorId: firebaseUser!.uid,
                            note: 'Admin processed refund status',
                          });
                          loadAdminData();
                        }}
                        className="px-2.5 py-1 bg-amber-600 text-white rounded font-semibold"
                      >
                        Mark Refunded
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {section === 'customers' && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">City</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Verified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.uid}>
                      <td className="px-4 py-3 font-medium">{u.fullName}</td>
                      <td className="px-4 py-3">{u.email}</td>
                      <td className="px-4 py-3">{u.city || 'Bengaluru'}</td>
                      <td className="px-4 py-3 font-mono">{u.role}</td>
                      <td className="px-4 py-3">{u.emailVerified ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {section === 'groups' && (
            <div className="space-y-3">
              {groups.map((g) => (
                <div key={g.id} className="bg-white border border-slate-200 rounded-xl p-4 flex justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{g.name}</p>
                    <p className="text-slate-600">
                      {g.destination} · {g.tripDate} · {g.memberIds.length} members · Status: {g.status}
                    </p>
                  </div>
                  <span className="font-mono font-semibold">₹{g.budgetPerPerson}/p</span>
                </div>
              ))}
            </div>
          )}

          {section === 'pricelock' && (
            <div className="space-y-3">
              {offers.map((o) => (
                <div key={o.id} className="bg-white border border-slate-200 rounded-xl p-4 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{o.venueName}</p>
                    <p className="text-slate-600">
                      Advance ₹{o.albaAdvancePrice} vs Weekend ₹{o.weekendPrice} · Status: {o.offerStatus}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await updateDoc(doc(db, 'price_lock_offers', o.id), {
                        offerStatus: o.offerStatus === 'active' ? 'paused' : 'active',
                        updatedAt: serverTimestamp(),
                      });
                      loadAdminData();
                    }}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg font-semibold"
                  >
                    {o.offerStatus === 'active' ? 'Pause' : 'Activate'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {section === 'revenue' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Venture Plan Financial Assumptions Modeler
                    </h2>
                    <p className="text-xs text-slate-500">
                      Planning assumptions only — never reported as actual realized business results.
                    </p>
                  </div>
                  <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                    {scenarios.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedScenarioId(s.id)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize ${
                          selectedScenarioId === s.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                        }`}
                      >
                        {s.id}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-500 mb-1">Expected Customers</label>
                    <input
                      type="number"
                      value={activeScenario.expectedCustomers}
                      onChange={(e) =>
                        setScenarios((prev) =>
                          prev.map((s) =>
                            s.id === activeScenario.id
                              ? { ...s, expectedCustomers: Number(e.target.value) || 0 }
                              : s
                          )
                        )
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Rev / Txn (₹)</label>
                    <input
                      type="number"
                      value={activeScenario.revenuePerTransaction}
                      onChange={(e) =>
                        setScenarios((prev) =>
                          prev.map((s) =>
                            s.id === activeScenario.id
                              ? { ...s, revenuePerTransaction: Number(e.target.value) || 0 }
                              : s
                          )
                        )
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Purchases / Cust</label>
                    <input
                      type="number"
                      step={0.1}
                      value={activeScenario.purchasesPerCustomer}
                      onChange={(e) =>
                        setScenarios((prev) =>
                          prev.map((s) =>
                            s.id === activeScenario.id
                              ? { ...s, purchasesPerCustomer: Number(e.target.value) || 0 }
                              : s
                          )
                        )
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Var Cost / Txn (₹)</label>
                    <input
                      type="number"
                      value={activeScenario.variableCostPerTxn}
                      onChange={(e) =>
                        setScenarios((prev) =>
                          prev.map((s) =>
                            s.id === activeScenario.id
                              ? { ...s, variableCostPerTxn: Number(e.target.value) || 0 }
                              : s
                          )
                        )
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Monthly Fixed (₹)</label>
                    <input
                      type="number"
                      step={50000}
                      value={activeScenario.monthlyFixedCost}
                      onChange={(e) =>
                        setScenarios((prev) =>
                          prev.map((s) =>
                            s.id === activeScenario.id
                              ? { ...s, monthlyFixedCost: Number(e.target.value) || 0 }
                              : s
                          )
                        )
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                  <div>
                    <p className="text-xs text-slate-500">Projected Monthly Txns</p>
                    <p className="font-mono text-lg font-bold tabular-nums">
                      {scenarioProj.monthlyTransactions.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Contribution / Sale</p>
                    <p className="font-mono text-lg font-bold tabular-nums">
                      ₹{scenarioProj.contributionPerSale.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Projected Monthly Rev</p>
                    <p className="font-mono text-lg font-bold text-blue-700 tabular-nums">
                      ₹{scenarioProj.monthlyRevenue.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Operating Surplus / Deficit</p>
                    <p
                      className={`font-mono text-lg font-bold tabular-nums ${
                        scenarioProj.netOperatingSurplus >= 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      ₹{scenarioProj.netOperatingSurplus.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === 'settlements' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">Record Partner Settlement</h3>
                  <p className="text-xs text-slate-600">
                    Settle net payable balances after deducting Alba platform commission.
                  </p>
                </div>
                {partners[0] && (
                  <button
                    type="button"
                    onClick={async () => {
                      const p = partners[0];
                      await createSettlementRecord({
                        partnerId: p.id,
                        partnerUserId: p.userId,
                        partnerName: p.businessName,
                        grossAmount: grossBookingValue,
                        commissionDeducted: platformCommission,
                        netPayable: totalPayable,
                        payoutReference: `UTR_${Date.now()}`,
                        adminId: firebaseUser!.uid,
                      });
                      setNotice('Settlement recorded.');
                      loadAdminData();
                    }}
                    className="px-4 py-2 bg-[#0A1428] text-white text-xs font-semibold rounded-lg"
                  >
                    Record Settlement Batch
                  </button>
                )}
              </div>

              {settlements.map((s) => (
                <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-4 flex justify-between text-xs">
                  <span>
                    <strong>{s.partnerName}</strong> · {s.payoutReference || 'Pending UTR'}
                  </span>
                  <span className="font-mono font-bold">
                    Net ₹{s.netPayable} ({s.status})
                  </span>
                </div>
              ))}
            </div>
          )}

          {section === 'reviews' && (
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {r.customerName} · {r.rating}/5 ★ · {r.moderationStatus}
                    </p>
                    <p className="text-slate-600 mt-1">{r.comment}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await updateDoc(doc(db, 'reviews', r.id), {
                        moderationStatus: r.moderationStatus === 'published' ? 'removed' : 'published',
                        updatedAt: serverTimestamp(),
                      });
                      loadAdminData();
                    }}
                    className="px-3 py-1 border border-slate-300 rounded font-semibold"
                  >
                    {r.moderationStatus === 'published' ? 'Remove' : 'Restore'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {section === 'support' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-5 space-y-2">
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTicket(t)}
                    className={`w-full text-left p-4 rounded-xl border ${
                      selectedTicket?.id === t.id
                        ? 'bg-blue-50 border-blue-600'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <p className="text-xs text-slate-500 uppercase">
                      {t.status} · {t.category}
                    </p>
                    <p className="font-semibold text-slate-900 text-sm">{t.subject}</p>
                    <p className="text-xs text-slate-500">From: {t.userName}</p>
                  </button>
                ))}
              </div>
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                {selectedTicket ? (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-900">{selectedTicket.subject}</h3>
                      <select
                        value={selectedTicket.status}
                        onChange={async (e) => {
                          await updateDoc(doc(db, 'support_tickets', selectedTicket.id), {
                            status: e.target.value,
                            updatedAt: serverTimestamp(),
                          });
                          loadAdminData();
                        }}
                        className="px-2 py-1 text-xs border border-slate-300 rounded"
                      >
                        <option value="open">open</option>
                        <option value="in_progress">in_progress</option>
                        <option value="resolved">resolved</option>
                        <option value="closed">closed</option>
                      </select>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {ticketMsgs.map((m) => (
                        <div
                          key={m.id}
                          className={`p-3 rounded-lg text-xs ${
                            m.isInternalNote
                              ? 'bg-amber-50 border border-amber-200 text-amber-950'
                              : 'bg-slate-50 border border-slate-200'
                          }`}
                        >
                          <span className="font-bold uppercase">
                            {m.isInternalNote ? 'Internal Admin Note' : m.senderRole}:{' '}
                          </span>
                          {m.body}
                        </div>
                      ))}
                    </div>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!adminReply.trim()) return;
                        await addSupportMessage({
                          ticketId: selectedTicket.id,
                          ticketOwnerId: selectedTicket.userId,
                          senderId: firebaseUser!.uid,
                          senderRole: 'super_admin',
                          body: adminReply,
                          isInternalNote,
                        });
                        setAdminReply('');
                        const snap = await getDocs(
                          query(
                            collection(db, 'support_messages'),
                            where('ticketId', '==', selectedTicket.id)
                          )
                        );
                        setTicketMsgs(
                          snap.docs
                            .map((d) => d.data() as SupportMessage)
                            .sort((a, b) => tsToMillis(a.createdAt) - tsToMillis(b.createdAt))
                        );
                      }}
                      className="space-y-2"
                    >
                      <textarea
                        rows={2}
                        value={adminReply}
                        onChange={(e) => setAdminReply(e.target.value)}
                        placeholder="Write reply or internal admin note..."
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                      <div className="flex items-center justify-between">
                        <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={isInternalNote}
                            onChange={(e) => setIsInternalNote(e.target.checked)}
                          />
                          Internal Admin-Only Note (hidden from customer)
                        </label>
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-[#0A1428] text-white text-xs font-semibold rounded-lg"
                        >
                          Post
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Select a ticket to view messages.</p>
                )}
              </div>
            </div>
          )}

          {section === 'audit' && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">Details</th>
                    <th className="px-4 py-3">Actor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-3 font-mono font-semibold">{l.action}</td>
                      <td className="px-4 py-3">{l.entityType} ({l.entityId})</td>
                      <td className="px-4 py-3">{l.details || '—'}</td>
                      <td className="px-4 py-3 font-mono">{l.actorId.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {section === 'settings' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 max-w-xl">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Platform Settings & Default Commission
              </h2>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Platform Commission (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={defaultCommission}
                  onChange={(e) => setDefaultCommission(Number(e.target.value) || 15)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <button
                type="button"
                onClick={async () => {
                  await setDoc(doc(db, 'platform_settings', 'global'), {
                    id: 'global',
                    defaultCommissionPercent: defaultCommission,
                    minAdvanceDays: 3,
                    activeCity: 'Bengaluru',
                    updatedBy: firebaseUser!.uid,
                    updatedAt: serverTimestamp(),
                  });
                  setNotice('Global platform settings saved to Firestore.');
                }}
                className="px-4 py-2 bg-[#0A1428] text-white text-xs font-semibold rounded-lg"
              >
                Save Global Settings
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
