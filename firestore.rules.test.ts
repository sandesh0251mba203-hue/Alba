/**
 * Alba Security Rules Red-Team Verification Suite (Phase 0 Dirty Dozen)
 * Run with Firebase Emulator Suite when testing locally:
 *   firebase emulators:exec --only firestore "npx tsx firestore.rules.test.ts"
 */
export const DIRTY_DOZEN_PAYLOADS = [
  { name: 'Self-Promote Super Admin', collection: 'users', payload: { uid: 'attacker', role: 'super_admin' } },
  { name: 'Read Other Customer Profile PII', collection: 'customer_profiles', docId: 'victim_uid' },
  { name: 'Approve Own Venue Listing', collection: 'venues', update: { verificationStatus: 'approved' } },
  { name: 'Zero Out Partner Commission', collection: 'venue_partners', update: { commissionRatePercent: 0 } },
  { name: 'Confirm Own Booking as Customer', collection: 'bookings', update: { status: 'confirmed' } },
  { name: 'Mutate Immutable Booking History', collection: 'booking_status_history', update: { toStatus: 'confirmed' } },
  { name: 'Submit Review Without Completed Booking', collection: 'reviews', payload: { bookingId: 'pending_123' } },
  { name: 'Read Admin Internal Support Note', collection: 'support_messages', query: { isInternalNote: true } },
  { name: 'Spoof Timestamp on Create', collection: 'bookings', payload: { createdAt: '2020-01-01T00:00:00Z' } },
  { name: 'ID Poisoning', collection: 'groups', docId: 'bad/id with spaces!' },
  { name: 'Shadow Field Injection', collection: 'favourites', payload: { adminOverride: true } },
  { name: 'Unverified Email Booking Write', collection: 'bookings', auth: { email_verified: false } }
];
