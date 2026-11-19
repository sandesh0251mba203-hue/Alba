export type UserRole = 'customer' | 'group_member' | 'venue_partner' | 'super_admin';

export type BookingStatus =
  | 'draft'
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'refund_requested'
  | 'refunded';

export type PaymentStatus =
  | 'unpaid'
  | 'instructions_sent'
  | 'reference_submitted'
  | 'verified'
  | 'refunded';

export type VerificationStatus =
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'suspended';

export interface AlbaUser {
  uid: string;
  fullName: string;
  email: string;
  role: UserRole;
  city?: string;
  emailVerified?: boolean;
  isDeleted?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CustomerProfile {
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  city: string;
  interests?: string[];
  preferredActivities?: string[];
  typicalGroupSize?: number;
  budgetPreference?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Venue {
  id: string;
  partnerId?: string;
  partnerUserId: string;
  name: string;
  category: string;
  city: string;
  locality: string;
  address?: string;
  description: string;
  imageUrl?: string;
  videoPreviewUrl?: string;
  operatingHours?: string;
  weekdayPrice: number;
  weekendPrice: number;
  isIllustrativeListing?: boolean;
  verificationStatus: VerificationStatus;
  lat?: number;
  lng?: number;
  isDeleted?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface VenuePartner {
  id: string;
  userId: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  category: string;
  address?: string;
  city: string;
  locality: string;
  gstNumber?: string;
  registrationDetails?: string;
  operatingHours?: string;
  verificationStatus: VerificationStatus;
  commissionRatePercent?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Activity {
  id: string;
  venueId: string;
  partnerUserId: string;
  name: string;
  category: string;
  description?: string;
  durationMinutes: number;
  isPublished: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface VenueInventory {
  id: string;
  venueId: string;
  partnerUserId: string;
  date: string;
  timeSlot: string;
  totalSlots: number;
  availableSlots: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PriceLockOffer {
  id: string;
  venueId: string;
  venueName: string;
  partnerUserId: string;
  title?: string;
  weekdayPrice: number;
  weekendPrice: number;
  albaAdvancePrice: number;
  discountPercent?: number;
  minAdvanceDays: number;
  availableSlots?: number;
  activityDate?: string;
  bookingDeadline?: string;
  expiresAt?: string;
  partnerTerms?: string;
  cancellationPolicy?: string;
  offerStatus: 'awaiting_partner_confirmation' | 'active' | 'expired' | 'paused';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Itinerary {
  id: string;
  ownerId: string;
  groupId?: string;
  title: string;
  destination: string;
  startingLocation?: string;
  travelDate: string;
  participantsCount: number;
  groupType: 'Friends' | 'Family' | 'Couples' | 'Solo';
  budgetPerPerson: number;
  estimatedTotalPerPerson?: number;
  travelMode?: string;
  summary?: string;
  aiGenerated: boolean;
  aiDisclaimer?: string;
  memberIds: string[];
  stopIds?: string[];
  isFinalized?: boolean;
  isDeleted?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ItineraryStop {
  id: string;
  itineraryId: string;
  ownerId: string;
  memberIds?: string[];
  orderIndex: number;
  timeSlot: string;
  durationMinutes?: number;
  title: string;
  category: string;
  locality?: string;
  description?: string;
  estimatedCostPerPerson: number;
  priceType: 'estimated' | 'illustrative' | 'verified_partner';
  travelTimeNote?: string;
  venueId?: string;
  suggestedByUserId?: string;
  alternativeOption?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ItineraryVote {
  id: string;
  itineraryId: string;
  stopId: string;
  groupId?: string;
  userId: string;
  userName?: string;
  memberIds?: string[];
  vote: 'up' | 'down';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Group {
  id: string;
  name: string;
  organizerId: string;
  organizerName?: string;
  destination: string;
  tripDate: string;
  budgetPerPerson: number;
  totalBudget?: number;
  participantLimit?: number;
  memberIds: string[];
  itineraryId?: string;
  inviteCode: string;
  status: 'planning' | 'voting' | 'finalized' | 'completed' | 'cancelled';
  isDeleted?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  organizerId: string;
  displayName: string;
  role: 'organizer' | 'member';
  preferences?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Booking {
  id: string;
  idempotencyKey: string;
  customerId: string;
  customerName?: string;
  venueId: string;
  venueName: string;
  partnerUserId: string;
  groupId?: string;
  itineraryId?: string;
  activityDate: string;
  timeSlot: string;
  participants: number;
  standardWeekendUnitPrice?: number;
  lockedUnitPrice: number;
  priceLockApplied?: boolean;
  priceLockOfferId?: string;
  grossAmount: number;
  customerSavings?: number;
  commissionRatePercent?: number;
  platformCommission?: number;
  merchantPayable?: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BookingStatusHistory {
  id: string;
  bookingId: string;
  customerId: string;
  partnerUserId: string;
  fromStatus?: string;
  toStatus: string;
  changedBy: string;
  note?: string;
  createdAt?: unknown;
}

export interface PaymentRecord {
  id: string;
  bookingId: string;
  customerId: string;
  partnerUserId: string;
  amount: number;
  method: 'upi_manual' | 'pay_at_venue' | 'gateway_pending';
  upiInstruction?: string;
  transactionRef?: string;
  status: 'instructions_sent' | 'reference_submitted' | 'verified' | 'refunded';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Review {
  id: string;
  venueId: string;
  bookingId: string;
  customerId: string;
  customerName: string;
  rating: number;
  comment: string;
  isVerifiedBooking: boolean;
  partnerResponse?: string;
  moderationStatus: 'published' | 'flagged' | 'removed';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Favourite {
  id: string;
  userId: string;
  itemType: 'venue' | 'activity';
  itemId: string;
  itemTitle: string;
  createdAt?: unknown;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  bookingId?: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  ticketOwnerId: string;
  senderId: string;
  senderRole: 'customer' | 'venue_partner' | 'super_admin';
  body: string;
  isInternalNote: boolean;
  createdAt?: unknown;
}

export interface Settlement {
  id: string;
  partnerId: string;
  partnerUserId: string;
  partnerName: string;
  grossAmount: number;
  commissionDeducted: number;
  netPayable: number;
  status: 'pending' | 'processing' | 'settled';
  payoutReference?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FinancialScenario {
  id: 'base' | 'conservative' | 'ambitious';
  label: string;
  expectedCustomers: number;
  revenuePerTransaction: number;
  purchasesPerCustomer: number;
  variableCostPerTxn: number;
  monthlyFixedCost: number;
}
