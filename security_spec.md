# StudentSuccess AI — Firestore Security Specification (`security_spec.md`)

## 1. Architecture & Master Source of Truth
- **Hybrid Identity & Data Model**: Firebase Authentication provides cryptographic identity verification (`request.auth.uid`, `request.auth.token.email`, `request.auth.token.email_verified`). SQLite (`backend/studentsuccess.db`) serves as the authoritative store for application user profiles, role assignments (`admin`, `faculty`, `student`), and academic/placement records.
- **Firestore Collections**:
  1. `/user_audit_profiles/{userId}`: Stores non-PII session sync metadata (`uid`, `sqliteUserId`, `displayName`, `department`, `lastLoginAt`, `createdAt`, `updatedAt`) strictly scoped to the document owner (`userId == request.auth.uid`) or verified Administrator (`isAdmin()`).
  2. `/admins/{adminUid}`: Trusted registry of Administrator UIDs. Bootstrap admin (`sandhyachekuri2718@gmail.com` with `email_verified == true`) or existing admins can manage entries.

## 2. Data Invariants
1. **Default-Deny Global Catch-All**: Any path not explicitly matched is unconditionally denied (`allow read, write: if false;`).
2. **ID Poisoning Guard**: Every path variable (`{userId}`, `{adminUid}`) on single-document operations (`get`, `create`, `update`, `delete`) must satisfy `isValidId(id)` (`id is string && id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`).
3. **Identity Integrity & Anti-Spoofing**: `incoming().uid == request.auth.uid && incoming().uid == userId`. Users can never write an audit profile for another UID or inject a `role` or `isAdmin` field.
4. **Strict Key Allowlisting (`hasAll` + `hasOnly`)**:
   - `UserAuditProfile` must contain exact keys `['uid', 'sqliteUserId', 'displayName', 'department', 'lastLoginAt', 'createdAt', 'updatedAt']`. Shadow fields (e.g., `role`, `isVerified`) are rejected.
5. **Temporal Integrity**: `createdAt == request.time` on creation; `createdAt == existing().createdAt` (immortal field) and `updatedAt == request.time` on update.

## 3. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Write**: `auth = null` attempting `create` on `/user_audit_profiles/user_1` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: `auth = { uid: 'user_1', token: { email_verified: false } }` attempting `create` on `/user_audit_profiles/user_1` -> `PERMISSION_DENIED`.
3. **Identity Spoofing (Cross-UID Create)**: `auth.uid = 'attacker_1'` creating `/user_audit_profiles/victim_1` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection (`role: 'admin'`)**: Adding extra key `role: 'admin'` to `/user_audit_profiles/user_1` -> `PERMISSION_DENIED` (blocked by `hasOnly`).
5. **Resource Poisoning (10KB `displayName`)**: Setting `displayName` to a 10,000-character string -> `PERMISSION_DENIED` (blocked by `.size() <= 120`).
6. **Regex Bypass in `sqliteUserId`**: Setting `sqliteUserId` to `"USR-STU-001; DROP TABLE users;"` -> `PERMISSION_DENIED` (blocked by `.matches('^[a-zA-Z0-9_\\-]+$')`).
7. **Forged Client Timestamp on Create**: Setting `createdAt` to a past timestamp instead of `request.time` -> `PERMISSION_DENIED`.
8. **Immortal Field Mutation on Update**: Mutating `createdAt` or `uid` during an `update` on `/user_audit_profiles/user_1` -> `PERMISSION_DENIED`.
9. **Unauthorized Update Key (`sqliteUserId` Tampering)**: Non-admin user attempting to change `sqliteUserId` via `update` -> `PERMISSION_DENIED` (blocked by `affectedKeys().hasOnly(['displayName', 'department', 'lastLoginAt', 'updatedAt'])`).
10. **Cross-User Profile Read (`get`)**: `auth.uid = 'student_2'` reading `/user_audit_profiles/student_1` -> `PERMISSION_DENIED`.
11. **Unscoped List Scraping (`list`)**: `auth.uid = 'student_2'` listing `/user_audit_profiles` without `resource.data.uid == request.auth.uid` -> `PERMISSION_DENIED`.
12. **Self-Promotion to `/admins/{adminUid}`**: Non-admin user creating `/admins/attacker_1` (or spoofing admin email with `email_verified: false`) -> `PERMISSION_DENIED`.
