# Alba Security Specification & Red Team Spec

## 1. Data Invariants
1. **Identity Integrity**: Every user-owned document (`customer_profiles`, `itineraries`, `bookings`, `favourites`, `support_tickets`, `reviews`) enforces `incoming().ownerId/customerId/userId == request.auth.uid` on creation and immutability on update.
2. **RBAC Privilege Escalation Block**: Users creating `/users/{uid}` cannot assign `role: "super_admin"`. Only the bootstrapped verified admin (`sandesh.0251mba203@dgu.ac.in` with `email_verified == true`) or an admin entry in `/admins/{uid}` holds Super Admin privileges.
3. **PII Isolation**: `/customer_profiles/{userId}`, `/users/{userId}`, and `/venue_partners/{partnerId}` reject reads from non-owners unless `isAdmin()`.
4. **Partner Listing Gate**: Public reads on `/venues/{venueId}` require `verificationStatus == 'approved' && isDeleted == false`. Only verified Super Admins can change `verificationStatus` to `'approved'`.
5. **Booking Integrity & Commission Protection**: Customers cannot modify `status` to `'accepted'` or `'confirmed'`, nor alter `platformCommission` or `commissionRatePercent` after submission. `booking_status_history` and `audit_logs` are strictly immutable (`allow update, delete: if false`).
6. **Verified Review Gate**: Reviews can only be created when the referenced `bookingId` exists, belongs to `request.auth.uid`, and has `status == 'completed'`.
7. **Internal Support Notes Isolation**: `support_messages` with `isInternalNote == true` can NEVER be read by customers or venue partners — strictly `isAdmin()` only.

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. **Self-Promote Super Admin**: `setDoc(doc(db, 'users', uid), { uid, role: 'super_admin', ... })` -> DENIED.
2. **Read Other Customer Profile PII**: `getDoc(doc(db, 'customer_profiles', victimUid))` -> DENIED.
3. **Approve Own Venue Listing as Partner**: `updateDoc(doc(db, 'venues', venueId), { verificationStatus: 'approved' })` -> DENIED.
4. **Modify Platform Commission Rate on Partner Doc**: `updateDoc(doc(db, 'venue_partners', partnerId), { commissionRatePercent: 0 })` -> DENIED.
5. **Confirm Own Booking as Customer**: `updateDoc(doc(db, 'bookings', bookingId), { status: 'confirmed' })` -> DENIED.
6. **Mutate Immutable Booking History**: `updateDoc(doc(db, 'booking_status_history', historyId), { toStatus: 'confirmed' })` -> DENIED.
7. **Submit Review Without Completed Booking**: `setDoc(doc(db, 'reviews', id), { bookingId: pendingBookingId, ... })` -> DENIED.
8. **Read Admin Internal Support Note as Customer**: `getDoc(doc(db, 'support_messages', internalNoteId))` -> DENIED.
9. **Spoof Timestamp on Create**: `setDoc(doc(db, 'bookings', id), { ..., createdAt: '2020-01-01' })` -> DENIED (must equal `request.time`).
10. **ID Poisoning**: `setDoc(doc(db, 'groups', 'invalid/id with spaces!'), ...)` -> DENIED (`isValidId` fails).
11. **Shadow Field Injection**: `setDoc(doc(db, 'favourites', id), { ..., adminOverride: true })` -> DENIED (`hasOnly` rejects).
12. **Unverified Email Booking Write**: Authenticated user with `email_verified: false` creating a booking -> DENIED.
