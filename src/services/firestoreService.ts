import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  onSnapshot,
  serverTimestamp,
  runTransaction,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AlbaUser,
  AppNotification,
  Booking,
  BookingStatus,
  CustomerProfile,
  Favourite,
  Group,
  GroupMember,
  Itinerary,
  ItineraryStop,
  ItineraryVote,
  PaymentRecord,
  PriceLockOffer,
  Review,
  Settlement,
  SupportMessage,
  SupportTicket,
  Venue,
  VenueInventory,
  VenuePartner,
  VerificationStatus,
  Activity,
} from '../types/alba';

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned || `id_${Date.now()}`;
}

export function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return sanitizeId(`${prefix}_${Date.now()}_${rand}`);
}

export function clampStr(val: string | undefined, max: number): string {
  return (val || '').trim().slice(0, max);
}

export function tsToMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'object' && ts !== null && 'toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
    return Number((ts as { seconds: number }).seconds) * 1000;
  }
  return 0;
}

// -----------------------------------------------------------------------------
// Notifications & Audit Logs
// -----------------------------------------------------------------------------
export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}) {
  const id = generateId('notif');
  const path = `notifications/${id}`;
  try {
    await setDoc(doc(db, 'notifications', id), {
      id,
      userId: sanitizeId(params.userId),
      type: clampStr(params.type, 64),
      title: clampStr(params.title, 160),
      message: clampStr(params.message, 500),
      link: clampStr(params.link, 200),
      isRead: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function markNotificationRead(notificationId: string) {
  const path = `notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      isRead: true,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function subscribeUserNotifications(
  userId: string,
  callback: (items: AppNotification[]) => void
): Unsubscribe {
  const path = 'notifications';
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    limit(40)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => d.data() as AppNotification)
        .sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
      callback(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function writeAuditLog(params: {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: string;
}) {
  const id = generateId('audit');
  const path = `audit_logs/${id}`;
  try {
    await setDoc(doc(db, 'audit_logs', id), {
      id,
      actorId: sanitizeId(params.actorId),
      action: clampStr(params.action, 120),
      entityType: clampStr(params.entityType, 80),
      entityId: sanitizeId(params.entityId),
      details: clampStr(params.details, 600),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

// -----------------------------------------------------------------------------
// Customer Profile
// -----------------------------------------------------------------------------
export async function getCustomerProfile(userId: string): Promise<CustomerProfile | null> {
  const path = `customer_profiles/${userId}`;
  try {
    const snap = await getDoc(doc(db, 'customer_profiles', userId));
    return snap.exists() ? (snap.data() as CustomerProfile) : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function updateCustomerProfile(
  userId: string,
  updates: {
    fullName: string;
    phone?: string;
    city: string;
    interests?: string[];
    preferredActivities?: string[];
    typicalGroupSize?: number;
    budgetPreference?: number;
  }
) {
  const path = `customer_profiles/${userId}`;
  try {
    await updateDoc(doc(db, 'customer_profiles', userId), {
      fullName: clampStr(updates.fullName, 120),
      phone: clampStr(updates.phone, 24),
      city: clampStr(updates.city || 'Bengaluru', 80),
      interests: (updates.interests || []).slice(0, 15),
      preferredActivities: (updates.preferredActivities || []).slice(0, 15),
      typicalGroupSize: Math.min(50, Math.max(1, Number(updates.typicalGroupSize) || 4)),
      budgetPreference: Math.min(100000, Math.max(0, Number(updates.budgetPreference) || 2000)),
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'users', userId), {
      fullName: clampStr(updates.fullName, 120),
      city: clampStr(updates.city || 'Bengaluru', 80),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// -----------------------------------------------------------------------------
// Venues, Offers, Inventory & Activities
// -----------------------------------------------------------------------------
export async function fetchApprovedVenues(): Promise<Venue[]> {
  const path = 'venues';
  try {
    const q = query(
      collection(db, 'venues'),
      where('verificationStatus', '==', 'approved'),
      limit(60)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as Venue)
      .filter((v) => !v.isDeleted);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function fetchActivePriceLockOffers(): Promise<PriceLockOffer[]> {
  const path = 'price_lock_offers';
  try {
    const q = query(
      collection(db, 'price_lock_offers'),
      where('offerStatus', 'in', ['active', 'awaiting_partner_confirmation']),
      limit(60)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as PriceLockOffer);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function fetchVenueReviews(venueId: string): Promise<Review[]> {
  const path = 'reviews';
  try {
    const q = query(
      collection(db, 'reviews'),
      where('venueId', '==', venueId),
      where('moderationStatus', '==', 'published'),
      limit(30)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Review);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function fetchVenueInventory(venueId: string): Promise<VenueInventory[]> {
  const path = 'venue_inventory';
  try {
    const q = query(
      collection(db, 'venue_inventory'),
      where('venueId', '==', venueId),
      limit(30)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as VenueInventory).filter((inv) => inv.availableSlots >= 0);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

// -----------------------------------------------------------------------------
// Itineraries & Stops
// -----------------------------------------------------------------------------
export async function saveItineraryToFirestore(params: {
  ownerId: string;
  title: string;
  destination: string;
  startingLocation: string;
  travelDate: string;
  participantsCount: number;
  groupType: 'Friends' | 'Family' | 'Couples' | 'Solo';
  budgetPerPerson: number;
  estimatedTotalPerPerson: number;
  travelMode: string;
  summary: string;
  aiGenerated: boolean;
  aiDisclaimer: string;
  stops: Array<{
    orderIndex: number;
    timeSlot: string;
    durationMinutes: number;
    title: string;
    category: string;
    locality: string;
    description: string;
    estimatedCostPerPerson: number;
    travelTimeNote: string;
    alternativeOption: string;
    venueId?: string;
    priceType?: 'estimated' | 'illustrative' | 'verified_partner';
  }>;
}): Promise<string> {
  const itineraryId = generateId('itin');
  const batch = writeBatch(db);
  const path = `itineraries/${itineraryId}`;
  const stopsToSave = params.stops.slice(0, 20);
  const stopIds = stopsToSave.map((_, idx) => generateId(`stop_${idx}`));

  try {
    batch.set(doc(db, 'itineraries', itineraryId), {
      id: itineraryId,
      ownerId: params.ownerId,
      groupId: '',
      title: clampStr(params.title, 160),
      destination: clampStr(params.destination, 120),
      startingLocation: clampStr(params.startingLocation, 120),
      travelDate: clampStr(params.travelDate, 32),
      participantsCount: Math.max(1, Math.min(50, params.participantsCount)),
      groupType: params.groupType,
      budgetPerPerson: Math.max(0, params.budgetPerPerson),
      estimatedTotalPerPerson: Math.max(0, params.estimatedTotalPerPerson),
      travelMode: clampStr(params.travelMode, 60),
      summary: clampStr(params.summary, 1500),
      aiGenerated: params.aiGenerated,
      aiDisclaimer: clampStr(params.aiDisclaimer, 400),
      memberIds: [params.ownerId],
      stopIds,
      isFinalized: false,
      isDeleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    stopsToSave.forEach((s, idx) => {
      const stopId = stopIds[idx];
      batch.set(doc(db, 'itinerary_stops', stopId), {
        id: stopId,
        itineraryId,
        ownerId: params.ownerId,
        memberIds: [params.ownerId],
        orderIndex: idx,
        timeSlot: clampStr(s.timeSlot, 60),
        durationMinutes: Math.max(5, Math.min(1440, Number(s.durationMinutes) || 60)),
        title: clampStr(s.title, 160),
        category: clampStr(s.category || 'Activity', 80),
        locality: clampStr(s.locality, 120),
        description: clampStr(s.description, 800),
        estimatedCostPerPerson: Math.max(0, Number(s.estimatedCostPerPerson) || 0),
        priceType: s.priceType || 'estimated',
        travelTimeNote: clampStr(s.travelTimeNote, 160),
        venueId: clampStr(s.venueId, 128),
        suggestedByUserId: params.ownerId,
        alternativeOption: clampStr(s.alternativeOption, 300),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
    return itineraryId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function fetchUserItineraries(userId: string): Promise<Itinerary[]> {
  const path = 'itineraries';
  try {
    const q = query(
      collection(db, 'itineraries'),
      where('memberIds', 'array-contains', userId),
      limit(40)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as Itinerary)
      .filter((it) => !it.isDeleted);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function duplicateItinerary(sourceId: string, ownerId: string): Promise<string> {
  const path = `itineraries/${sourceId}`;
  try {
    const sourceSnap = await getDoc(doc(db, 'itineraries', sourceId));
    if (!sourceSnap.exists()) throw new Error('Itinerary not found.');
    const source = sourceSnap.data() as Itinerary;

    const stopsSnap = await getDocs(
      query(
        collection(db, 'itinerary_stops'),
        where('itineraryId', '==', sourceId),
        where('memberIds', 'array-contains', ownerId)
      )
    );
    const stops = stopsSnap.docs
      .map((d) => d.data() as ItineraryStop)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    return await saveItineraryToFirestore({
      ownerId,
      title: `${source.title} (Copy)`,
      destination: source.destination,
      startingLocation: source.startingLocation || 'Bengaluru',
      travelDate: source.travelDate,
      participantsCount: source.participantsCount,
      groupType: source.groupType,
      budgetPerPerson: source.budgetPerPerson,
      estimatedTotalPerPerson: source.estimatedTotalPerPerson || source.budgetPerPerson,
      travelMode: source.travelMode || 'Cab / Metro',
      summary: source.summary || '',
      aiGenerated: source.aiGenerated,
      aiDisclaimer: source.aiDisclaimer || '',
      stops: stops.map((s, idx) => ({
        orderIndex: idx,
        timeSlot: s.timeSlot,
        durationMinutes: s.durationMinutes || 60,
        title: s.title,
        category: s.category,
        locality: s.locality || '',
        description: s.description || '',
        estimatedCostPerPerson: s.estimatedCostPerPerson,
        travelTimeNote: s.travelTimeNote || '',
        alternativeOption: s.alternativeOption || '',
        venueId: s.venueId,
        priceType: s.priceType,
      })),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateItineraryStop(
  stopId: string,
  updates: Partial<Pick<ItineraryStop, 'title' | 'timeSlot' | 'description' | 'estimatedCostPerPerson' | 'locality' | 'alternativeOption'>>
) {
  const path = `itinerary_stops/${stopId}`;
  try {
    await updateDoc(doc(db, 'itinerary_stops', stopId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// -----------------------------------------------------------------------------
// Groups & Real-Time Collaboration
// -----------------------------------------------------------------------------
export async function createGroupTrip(params: {
  name: string;
  organizerId: string;
  organizerName: string;
  destination: string;
  tripDate: string;
  budgetPerPerson: number;
  participantLimit: number;
  itineraryId?: string;
}): Promise<{ groupId: string; inviteCode: string }> {
  const groupId = generateId('grp');
  const inviteCode = sanitizeId(`alba_${Math.random().toString(36).slice(2, 10)}`);
  const memberId = `${groupId}_${params.organizerId}`.slice(0, 120);
  const invitationId = `inv_${inviteCode}`;

  const batch = writeBatch(db);
  try {
    batch.set(doc(db, 'groups', groupId), {
      id: groupId,
      name: clampStr(params.name, 120),
      organizerId: params.organizerId,
      organizerName: clampStr(params.organizerName, 120),
      destination: clampStr(params.destination, 120),
      tripDate: clampStr(params.tripDate, 32),
      budgetPerPerson: Math.max(0, params.budgetPerPerson),
      totalBudget: Math.max(0, params.budgetPerPerson * params.participantLimit),
      participantLimit: Math.max(1, Math.min(30, params.participantLimit)),
      memberIds: [params.organizerId],
      itineraryId: clampStr(params.itineraryId, 128),
      inviteCode,
      status: 'voting',
      isDeleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'group_members', memberId), {
      id: memberId,
      groupId,
      userId: params.organizerId,
      organizerId: params.organizerId,
      displayName: clampStr(params.organizerName, 120),
      role: 'organizer',
      preferences: 'Group Outing Captain',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'group_invitations', invitationId), {
      id: invitationId,
      groupId,
      groupName: clampStr(params.name, 120),
      organizerId: params.organizerId,
      inviteCode,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (params.itineraryId) {
      batch.update(doc(db, 'itineraries', params.itineraryId), {
        groupId,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    return { groupId, inviteCode };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `groups/${groupId}`);
  }
}

export async function joinGroupByInviteCode(params: {
  inviteCode: string;
  userId: string;
  displayName: string;
  preferences?: string;
}): Promise<string> {
  const path = 'group_invitations';
  try {
    const invSnap = await getDocs(
      query(
        collection(db, 'group_invitations'),
        where('inviteCode', '==', params.inviteCode),
        where('status', '==', 'active'),
        limit(1)
      )
    );
    if (invSnap.empty) {
      throw new Error('This group invitation link is invalid or has expired.');
    }
    const invitation = invSnap.docs[0].data() as {
      groupId: string;
      groupName: string;
      organizerId: string;
    };

    const groupRef = doc(db, 'groups', invitation.groupId);
    const groupSnap = await getDoc(groupRef);
    let currentMembers: string[] = [];
    let itineraryId = '';
    if (groupSnap.exists()) {
      const g = groupSnap.data() as Group;
      currentMembers = g.memberIds || [];
      itineraryId = g.itineraryId || '';
    }

    if (!currentMembers.includes(params.userId)) {
      await runTransaction(db, async (tx) => {
        const freshGroup = await tx.get(groupRef);
        if (!freshGroup.exists()) throw new Error('Group does not exist.');
        const gData = freshGroup.data() as Group;
        if (!gData.memberIds.includes(params.userId)) {
          const nextMembers = [...gData.memberIds, params.userId];
          tx.update(groupRef, {
            memberIds: nextMembers,
            updatedAt: serverTimestamp(),
          });
          if (gData.itineraryId) {
            const itinRef = doc(db, 'itineraries', gData.itineraryId);
            const itinSnap = await tx.get(itinRef);
            if (itinSnap.exists()) {
              const iData = itinSnap.data() as Itinerary;
              if (!iData.memberIds.includes(params.userId)) {
                tx.update(itinRef, {
                  memberIds: [...iData.memberIds, params.userId],
                  updatedAt: serverTimestamp(),
                });
              }
            }
          }
        }
      });
    }

    const memberId = sanitizeId(`${invitation.groupId}_${params.userId}`);
    await setDoc(doc(db, 'group_members', memberId), {
      id: memberId,
      groupId: invitation.groupId,
      userId: params.userId,
      organizerId: invitation.organizerId,
      displayName: clampStr(params.displayName, 120),
      role: 'member',
      preferences: clampStr(params.preferences || 'Excited to join', 300),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    void itineraryId;

    await createNotification({
      userId: invitation.organizerId,
      type: 'group_member_joined',
      title: 'New Group Member Joined',
      message: `${params.displayName} joined ${invitation.groupName}.`,
      link: `/groups/${invitation.groupId}`,
    });

    return invitation.groupId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function fetchUserGroups(userId: string): Promise<Group[]> {
  const path = 'groups';
  try {
    const q = query(
      collection(db, 'groups'),
      where('memberIds', 'array-contains', userId),
      limit(40)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Group).filter((g) => !g.isDeleted);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export function subscribeGroupDetails(
  groupId: string,
  onGroup: (group: Group | null) => void,
  onMembers: (members: GroupMember[]) => void
): () => void {
  let cancelled = false;
  const unsubGroup = onSnapshot(
    doc(db, 'groups', groupId),
    async (snap) => {
      if (!snap.exists()) {
        onGroup(null);
        onMembers([]);
        return;
      }
      const gData = snap.data() as Group;
      onGroup(gData);
      try {
        const memberSnaps = await Promise.all(
          (gData.memberIds || []).map((uid) =>
            getDoc(doc(db, 'group_members', sanitizeId(`${groupId}_${uid}`)))
          )
        );
        if (!cancelled) {
          onMembers(
            memberSnaps
              .filter((m) => m.exists())
              .map((m) => m.data() as GroupMember)
          );
        }
      } catch (err) {
        if (!cancelled) {
          handleFirestoreError(err, OperationType.GET, 'group_members');
        }
      }
    },
    (err) => handleFirestoreError(err, OperationType.GET, `groups/${groupId}`)
  );
  return () => {
    cancelled = true;
    unsubGroup();
  };
}

export async function voteOnItineraryStop(params: {
  itineraryId: string;
  stopId: string;
  groupId?: string;
  userId: string;
  userName: string;
  memberIds?: string[];
  vote: 'up' | 'down';
}) {
  const voteId = sanitizeId(`${params.itineraryId}_${params.stopId}_${params.userId}`);
  const path = `itinerary_votes/${voteId}`;
  const memberIds = Array.from(new Set([...(params.memberIds || []), params.userId])).slice(0, 20);
  try {
    const existing = await getDoc(doc(db, 'itinerary_votes', voteId));
    if (existing.exists()) {
      await updateDoc(doc(db, 'itinerary_votes', voteId), {
        vote: params.vote,
        memberIds,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'itinerary_votes', voteId), {
        id: voteId,
        itineraryId: params.itineraryId,
        stopId: params.stopId,
        groupId: clampStr(params.groupId, 128),
        userId: params.userId,
        userName: clampStr(params.userName, 120),
        memberIds,
        vote: params.vote,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// -----------------------------------------------------------------------------
// Transactional Booking Engine & Payments
// -----------------------------------------------------------------------------
export async function submitBookingRequest(params: {
  customerId: string;
  customerName: string;
  venue: Venue;
  activityDate: string;
  timeSlot: string;
  participants: number;
  priceLockOffer?: PriceLockOffer | null;
  groupId?: string;
  itineraryId?: string;
  commissionRatePercent?: number;
  paymentMethod?: 'upi_manual' | 'pay_at_venue';
}): Promise<string> {
  const datePart = params.activityDate.replace(/[^0-9]/g, '');
  const slotPart = params.timeSlot.replace(/[^a-zA-Z0-9]/g, '');
  const idempotencyKey = sanitizeId(`bk_${params.customerId.slice(0, 12)}_${params.venue.id.slice(0, 18)}_${datePart}_${slotPart}`);
  const bookingId = idempotencyKey;
  const path = `bookings/${bookingId}`;

  // Check if a 3+ day advance Price-Lock applies
  const targetDate = new Date(`${params.activityDate}T00:00:00`);
  const now = new Date();
  const diffDays = Math.floor((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const minDays = params.priceLockOffer?.minAdvanceDays || 3;
  const offerEligible =
    Boolean(params.priceLockOffer) &&
    params.priceLockOffer?.offerStatus === 'active' &&
    diffDays >= minDays;

  const standardWeekendUnitPrice = Number(params.venue.weekendPrice) || 0;
  const lockedUnitPrice = offerEligible && params.priceLockOffer
    ? Number(params.priceLockOffer.albaAdvancePrice)
    : Number(params.venue.weekendPrice);

  const qty = Math.max(1, Math.min(50, params.participants));
  const grossAmount = Math.round(lockedUnitPrice * qty);
  const customerSavings = offerEligible
    ? Math.max(0, Math.round((standardWeekendUnitPrice - lockedUnitPrice) * qty))
    : 0;
  const rate = params.commissionRatePercent ?? 15;
  const platformCommission = Math.round((grossAmount * rate) / 100);
  const merchantPayable = Math.max(0, grossAmount - platformCommission);

  try {
    const venueSnap = await getDoc(doc(db, 'venues', params.venue.id));
    if (!venueSnap.exists()) {
      throw new Error(
        'This venue is an illustrative benchmark not yet seeded in the live Firestore directory. Ask Super Admin to seed Bengaluru reference listings or pick an approved Partner Venue.'
      );
    }

    await runTransaction(db, async (tx) => {
      const bookingRef = doc(db, 'bookings', bookingId);
      const existingSnap = await tx.get(bookingRef);
      if (existingSnap.exists()) {
        const existingData = existingSnap.data() as Booking;
        if (!['cancelled', 'rejected'].includes(existingData.status)) {
          throw new Error('A booking request for this venue, date, and time slot already exists.');
        }
      }

      tx.set(bookingRef, {
        id: bookingId,
        idempotencyKey,
        customerId: params.customerId,
        customerName: clampStr(params.customerName, 120),
        venueId: params.venue.id,
        venueName: clampStr(params.venue.name, 160),
        partnerUserId: params.venue.partnerUserId,
        groupId: clampStr(params.groupId, 128),
        itineraryId: clampStr(params.itineraryId, 128),
        activityDate: clampStr(params.activityDate, 32),
        timeSlot: clampStr(params.timeSlot, 48),
        participants: qty,
        standardWeekendUnitPrice,
        lockedUnitPrice,
        priceLockApplied: offerEligible,
        priceLockOfferId: offerEligible && params.priceLockOffer ? params.priceLockOffer.id : '',
        grossAmount,
        customerSavings,
        commissionRatePercent: rate,
        platformCommission,
        merchantPayable,
        status: 'pending',
        paymentStatus: 'instructions_sent',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const historyId = generateId('bhist');
      tx.set(doc(db, 'booking_status_history', historyId), {
        id: historyId,
        bookingId,
        customerId: params.customerId,
        partnerUserId: params.venue.partnerUserId,
        fromStatus: 'draft',
        toStatus: 'pending',
        changedBy: params.customerId,
        note: offerEligible
          ? `Submitted with verified ${minDays}+ day advance Price-Lock rate`
          : 'Submitted at standard venue rate',
        createdAt: serverTimestamp(),
      });

      const paymentId = generateId('pay');
      tx.set(doc(db, 'payments', paymentId), {
        id: paymentId,
        bookingId,
        customerId: params.customerId,
        partnerUserId: params.venue.partnerUserId,
        amount: grossAmount,
        method: params.paymentMethod || 'upi_manual',
        upiInstruction:
          'Complete payment only after Venue Partner accepts your slot. Record your UPI UTR reference in My Bookings.',
        transactionRef: '',
        status: 'instructions_sent',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    if (params.venue.partnerUserId !== 'reference_catalog') {
      await createNotification({
        userId: params.venue.partnerUserId,
        type: 'booking_request',
        title: 'New Group Booking Request',
        message: `${params.customerName} requested ${qty} slots on ${params.activityDate} (${params.timeSlot}).`,
        link: '/partner',
      });
    }

    await createNotification({
      userId: params.customerId,
      type: 'booking_submitted',
      title: 'Booking Request Submitted',
      message: `Request sent to ${params.venue.name} for ${params.activityDate}. Confirmation awaits partner review.`,
      link: '/account',
    });

    await writeAuditLog({
      actorId: params.customerId,
      action: 'booking_requested',
      entityType: 'booking',
      entityId: bookingId,
      details: `${params.venue.name} · ${qty} guests · ₹${grossAmount}`,
    });

    return bookingId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function transitionBookingStatus(params: {
  booking: Booking;
  nextStatus: BookingStatus;
  actorId: string;
  note?: string;
}) {
  const path = `bookings/${params.booking.id}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'bookings', params.booking.id), {
      status: params.nextStatus,
      updatedAt: serverTimestamp(),
    });
    const historyId = generateId('bhist');
    batch.set(doc(db, 'booking_status_history', historyId), {
      id: historyId,
      bookingId: params.booking.id,
      customerId: params.booking.customerId,
      partnerUserId: params.booking.partnerUserId,
      fromStatus: params.booking.status,
      toStatus: params.nextStatus,
      changedBy: params.actorId,
      note: clampStr(params.note || `Transitioned to ${params.nextStatus}`, 400),
      createdAt: serverTimestamp(),
    });
    await batch.commit();

    await createNotification({
      userId: params.booking.customerId,
      type: `booking_${params.nextStatus}`,
      title: `Booking ${params.nextStatus.replace('_', ' ')}`,
      message: `${params.booking.venueName} (${params.booking.activityDate}) status updated to ${params.nextStatus}.`,
      link: '/account',
    });

    await writeAuditLog({
      actorId: params.actorId,
      action: `booking_status_${params.nextStatus}`,
      entityType: 'booking',
      entityId: params.booking.id,
      details: params.note,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function recordCustomerPaymentReference(params: {
  booking: Booking;
  paymentId: string;
  transactionRef: string;
  customerId: string;
}) {
  const path = `payments/${params.paymentId}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'payments', params.paymentId), {
      transactionRef: clampStr(params.transactionRef, 120),
      status: 'reference_submitted',
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'bookings', params.booking.id), {
      paymentStatus: 'reference_submitted',
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function fetchCustomerBookings(customerId: string): Promise<Booking[]> {
  const path = 'bookings';
  try {
    const q = query(
      collection(db, 'bookings'),
      where('customerId', '==', customerId),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as Booking)
      .sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

// -----------------------------------------------------------------------------
// Favourites, Reviews & Support Tickets
// -----------------------------------------------------------------------------
export async function toggleFavourite(params: {
  userId: string;
  itemType: 'venue' | 'activity';
  itemId: string;
  itemTitle: string;
}): Promise<boolean> {
  const favId = sanitizeId(`fav_${params.userId}_${params.itemType}_${params.itemId}`);
  const path = `favourites/${favId}`;
  try {
    const ref = doc(db, 'favourites', favId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await deleteDoc(ref);
      return false;
    } else {
      await setDoc(ref, {
        id: favId,
        userId: params.userId,
        itemType: params.itemType,
        itemId: sanitizeId(params.itemId),
        itemTitle: clampStr(params.itemTitle, 160),
        createdAt: serverTimestamp(),
      });
      return true;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function fetchUserFavourites(userId: string): Promise<Favourite[]> {
  const path = 'favourites';
  try {
    const snap = await getDocs(
      query(collection(db, 'favourites'), where('userId', '==', userId), limit(50))
    );
    return snap.docs.map((d) => d.data() as Favourite);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function submitVerifiedReview(params: {
  venueId: string;
  bookingId: string;
  customerId: string;
  customerName: string;
  rating: number;
  comment: string;
}) {
  const reviewId = sanitizeId(`rev_${params.bookingId}`);
  const path = `reviews/${reviewId}`;
  try {
    await setDoc(doc(db, 'reviews', reviewId), {
      id: reviewId,
      venueId: params.venueId,
      bookingId: params.bookingId,
      customerId: params.customerId,
      customerName: clampStr(params.customerName, 120),
      rating: Math.max(1, Math.min(5, Math.round(params.rating))),
      comment: clampStr(params.comment, 1000),
      isVerifiedBooking: true,
      partnerResponse: '',
      moderationStatus: 'published',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function createSupportTicket(params: {
  userId: string;
  userName: string;
  bookingId?: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  subject: string;
  initialMessage: string;
  senderRole: 'customer' | 'venue_partner' | 'super_admin';
}): Promise<string> {
  const ticketId = generateId('tkt');
  const messageId = generateId('msg');
  const batch = writeBatch(db);
  try {
    batch.set(doc(db, 'support_tickets', ticketId), {
      id: ticketId,
      userId: params.userId,
      userName: clampStr(params.userName, 120),
      bookingId: clampStr(params.bookingId, 128),
      category: clampStr(params.category, 80),
      priority: params.priority,
      subject: clampStr(params.subject, 200),
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'support_messages', messageId), {
      id: messageId,
      ticketId,
      ticketOwnerId: params.userId,
      senderId: params.userId,
      senderRole: params.senderRole,
      body: clampStr(params.initialMessage, 2000),
      isInternalNote: false,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
    return ticketId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `support_tickets/${ticketId}`);
  }
}

export async function addSupportMessage(params: {
  ticketId: string;
  ticketOwnerId: string;
  senderId: string;
  senderRole: 'customer' | 'venue_partner' | 'super_admin';
  body: string;
  isInternalNote?: boolean;
}) {
  const msgId = generateId('msg');
  try {
    await setDoc(doc(db, 'support_messages', msgId), {
      id: msgId,
      ticketId: params.ticketId,
      ticketOwnerId: params.ticketOwnerId,
      senderId: params.senderId,
      senderRole: params.senderRole,
      body: clampStr(params.body, 2000),
      isInternalNote: Boolean(params.isInternalNote),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `support_messages/${msgId}`);
  }
}

// -----------------------------------------------------------------------------
// Partner & Super Admin Operations
// -----------------------------------------------------------------------------
export async function submitPartnerRegistration(params: {
  userId: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  category: string;
  address: string;
  city: string;
  locality: string;
  gstNumber: string;
  registrationDetails: string;
  operatingHours: string;
  weekdayPrice: number;
  weekendPrice: number;
  description: string;
}): Promise<string> {
  const partnerId = sanitizeId(`ptr_${params.userId}`);
  const venueId = sanitizeId(`ven_${params.userId}`);
  const batch = writeBatch(db);
  try {
    batch.set(doc(db, 'venue_partners', partnerId), {
      id: partnerId,
      userId: params.userId,
      businessName: clampStr(params.businessName, 160),
      ownerName: clampStr(params.ownerName, 120),
      email: clampStr(params.email, 160),
      phone: clampStr(params.phone, 24),
      category: clampStr(params.category, 80),
      address: clampStr(params.address, 300),
      city: clampStr(params.city, 80),
      locality: clampStr(params.locality, 120),
      gstNumber: clampStr(params.gstNumber, 32),
      registrationDetails: clampStr(params.registrationDetails, 300),
      operatingHours: clampStr(params.operatingHours, 120),
      verificationStatus: 'pending',
      commissionRatePercent: 15,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'venues', venueId), {
      id: venueId,
      partnerId,
      partnerUserId: params.userId,
      name: clampStr(params.businessName, 160),
      category: clampStr(params.category, 80),
      city: clampStr(params.city, 80),
      locality: clampStr(params.locality, 120),
      address: clampStr(params.address, 300),
      description: clampStr(params.description, 1500),
      imageUrl: '/src/assets/images/venue_adventure_park_1795080312190.jpg',
      operatingHours: clampStr(params.operatingHours, 120),
      weekdayPrice: Math.max(0, params.weekdayPrice),
      weekendPrice: Math.max(0, params.weekendPrice),
      isIllustrativeListing: false,
      verificationStatus: 'pending',
      lat: 12.9716,
      lng: 77.5946,
      isDeleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return partnerId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `venue_partners/${partnerId}`);
  }
}

export async function adminVerifyPartner(params: {
  partner: VenuePartner;
  status: VerificationStatus;
  commissionRatePercent: number;
  adminId: string;
}) {
  const venueId = sanitizeId(`ven_${params.partner.userId}`);
  const batch = writeBatch(db);
  try {
    batch.update(doc(db, 'venue_partners', params.partner.id), {
      verificationStatus: params.status,
      commissionRatePercent: Math.max(0, Math.min(50, params.commissionRatePercent)),
      updatedAt: serverTimestamp(),
    });

    const venueSnap = await getDoc(doc(db, 'venues', venueId));
    if (venueSnap.exists()) {
      batch.update(doc(db, 'venues', venueId), {
        verificationStatus: params.status,
        updatedAt: serverTimestamp(),
      });
    }

    if (params.status === 'approved') {
      const userSnap = await getDoc(doc(db, 'users', params.partner.userId));
      if (userSnap.exists() && (userSnap.data() as AlbaUser).role !== 'super_admin') {
        batch.update(doc(db, 'users', params.partner.userId), {
          role: 'venue_partner',
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();

    await createNotification({
      userId: params.partner.userId,
      type: 'partner_verification',
      title: `Partner Application ${params.status.toUpperCase()}`,
      message: `Your venue ${params.partner.businessName} status is now ${params.status}.`,
      link: '/partner',
    });

    await writeAuditLog({
      actorId: params.adminId,
      action: `partner_verification_${params.status}`,
      entityType: 'venue_partner',
      entityId: params.partner.id,
      details: `Commission ${params.commissionRatePercent}%`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `venue_partners/${params.partner.id}`);
  }
}

export async function publishPriceLockOffer(params: {
  venue: Venue;
  partnerUserId: string;
  title: string;
  weekdayPrice: number;
  weekendPrice: number;
  albaAdvancePrice: number;
  availableSlots: number;
  activityDate: string;
  bookingDeadline: string;
  expiresAt: string;
  partnerTerms: string;
  cancellationPolicy: string;
}) {
  const offerId = generateId('plo');
  const discountPercent =
    params.weekendPrice > 0
      ? Math.max(0, Math.round(((params.weekendPrice - params.albaAdvancePrice) / params.weekendPrice) * 100))
      : 0;
  try {
    await setDoc(doc(db, 'price_lock_offers', offerId), {
      id: offerId,
      venueId: params.venue.id,
      venueName: clampStr(params.venue.name, 160),
      partnerUserId: params.partnerUserId,
      title: clampStr(params.title, 160),
      weekdayPrice: Math.max(0, params.weekdayPrice),
      weekendPrice: Math.max(0, params.weekendPrice),
      albaAdvancePrice: Math.max(0, params.albaAdvancePrice),
      discountPercent,
      minAdvanceDays: 3,
      availableSlots: Math.max(0, params.availableSlots),
      activityDate: clampStr(params.activityDate, 32),
      bookingDeadline: clampStr(params.bookingDeadline, 32),
      expiresAt: clampStr(params.expiresAt, 32),
      partnerTerms: clampStr(params.partnerTerms, 600),
      cancellationPolicy: clampStr(params.cancellationPolicy, 400),
      offerStatus: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return offerId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `price_lock_offers/${offerId}`);
  }
}

export async function createVenueInventorySlot(params: {
  venueId: string;
  partnerUserId: string;
  date: string;
  timeSlot: string;
  totalSlots: number;
}) {
  const id = sanitizeId(`inv_${params.venueId.slice(0, 16)}_${params.date}_${params.timeSlot}`);
  try {
    await setDoc(doc(db, 'venue_inventory', id), {
      id,
      venueId: params.venueId,
      partnerUserId: params.partnerUserId,
      date: clampStr(params.date, 32),
      timeSlot: clampStr(params.timeSlot, 48),
      totalSlots: Math.max(1, params.totalSlots),
      availableSlots: Math.max(1, params.totalSlots),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `venue_inventory/${id}`);
  }
}

export async function createVenueActivity(params: {
  venueId: string;
  partnerUserId: string;
  name: string;
  category: string;
  description: string;
  durationMinutes: number;
}) {
  const id = generateId('act');
  try {
    await setDoc(doc(db, 'activities', id), {
      id,
      venueId: params.venueId,
      partnerUserId: params.partnerUserId,
      name: clampStr(params.name, 160),
      category: clampStr(params.category, 80),
      description: clampStr(params.description, 800),
      durationMinutes: Math.max(10, Math.min(1440, params.durationMinutes)),
      isPublished: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `activities/${id}`);
  }
}

export async function createSettlementRecord(params: {
  partnerId: string;
  partnerUserId: string;
  partnerName: string;
  grossAmount: number;
  commissionDeducted: number;
  netPayable: number;
  payoutReference: string;
  adminId: string;
}) {
  const id = generateId('settle');
  try {
    await setDoc(doc(db, 'settlements', id), {
      id,
      partnerId: params.partnerId,
      partnerUserId: params.partnerUserId,
      partnerName: clampStr(params.partnerName, 160),
      grossAmount: params.grossAmount,
      commissionDeducted: params.commissionDeducted,
      netPayable: params.netPayable,
      status: params.payoutReference ? 'settled' : 'pending',
      payoutReference: clampStr(params.payoutReference, 120),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({
      actorId: params.adminId,
      action: 'settlement_recorded',
      entityType: 'settlement',
      entityId: id,
      details: `${params.partnerName} · Net ₹${params.netPayable}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `settlements/${id}`);
  }
}

export type { Activity, Settlement };
