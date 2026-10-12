/**
 * Firestore Security Rules Adversarial Test Suite ("Dirty Dozen" Payloads)
 * Verifies that all 12 adversarial payloads defined in `security_spec.md`
 * are rejected with PERMISSION_DENIED by `firestore.rules`.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  authContext: {
    uid: string | null;
    email?: string;
    email_verified?: boolean;
  };
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
  enforcedByRuleGate: string;
}

export const DIRTY_DOZEN_SECURITY_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Write to /user_audit_profiles/user_1',
    collectionPath: '/user_audit_profiles/user_1',
    operation: 'create',
    authContext: { uid: null },
    payload: {
      uid: 'user_1',
      sqliteUserId: 'USR-STU-001',
      displayName: 'Aarav Sharma',
      department: 'Computer Science & Engineering',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'isVerifiedUser() -> request.auth != null',
  },
  {
    id: 2,
    name: 'Unverified Email Write to /user_audit_profiles/user_1',
    collectionPath: '/user_audit_profiles/user_1',
    operation: 'create',
    authContext: {
      uid: 'user_1',
      email: 'aarav.sharma@student.smartcampus.edu.in',
      email_verified: false,
    },
    payload: {
      uid: 'user_1',
      sqliteUserId: 'USR-STU-001',
      displayName: 'Aarav Sharma',
      department: 'Computer Science & Engineering',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'request.auth.token.email_verified == true',
  },
  {
    id: 3,
    name: 'Identity Spoofing (Cross-UID Create)',
    collectionPath: '/user_audit_profiles/victim_1',
    operation: 'create',
    authContext: {
      uid: 'attacker_1',
      email: 'attacker@smartcampus.edu.in',
      email_verified: true,
    },
    payload: {
      uid: 'victim_1',
      sqliteUserId: 'USR-STU-001',
      displayName: 'Aarav Sharma',
      department: 'Computer Science & Engineering',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'incoming().uid == request.auth.uid && incoming().uid == userId',
  },
  {
    id: 4,
    name: 'Shadow Field Privilege Escalation (role: "admin")',
    collectionPath: '/user_audit_profiles/user_1',
    operation: 'create',
    authContext: {
      uid: 'user_1',
      email: 'aarav.sharma@student.smartcampus.edu.in',
      email_verified: true,
    },
    payload: {
      uid: 'user_1',
      sqliteUserId: 'USR-STU-001',
      displayName: 'Aarav Sharma',
      department: 'Computer Science & Engineering',
      role: 'admin',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'data.keys().hasOnly([...]) in isValidUserAuditProfile',
  },
  {
    id: 5,
    name: 'Resource Poisoning (10KB displayName)',
    collectionPath: '/user_audit_profiles/user_1',
    operation: 'create',
    authContext: {
      uid: 'user_1',
      email: 'aarav.sharma@student.smartcampus.edu.in',
      email_verified: true,
    },
    payload: {
      uid: 'user_1',
      sqliteUserId: 'USR-STU-001',
      displayName: 'A'.repeat(10000),
      department: 'Computer Science & Engineering',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'data.displayName.size() <= 120',
  },
  {
    id: 6,
    name: 'Regex Bypass in sqliteUserId',
    collectionPath: '/user_audit_profiles/user_1',
    operation: 'create',
    authContext: {
      uid: 'user_1',
      email: 'aarav.sharma@student.smartcampus.edu.in',
      email_verified: true,
    },
    payload: {
      uid: 'user_1',
      sqliteUserId: 'USR-STU-001; DROP TABLE users;',
      displayName: 'Aarav Sharma',
      department: 'Computer Science & Engineering',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: "data.sqliteUserId.matches('^[a-zA-Z0-9_\\\\-]+$')",
  },
  {
    id: 7,
    name: 'Forged Client Timestamp on Create',
    collectionPath: '/user_audit_profiles/user_1',
    operation: 'create',
    authContext: {
      uid: 'user_1',
      email: 'aarav.sharma@student.smartcampus.edu.in',
      email_verified: true,
    },
    payload: {
      uid: 'user_1',
      sqliteUserId: 'USR-STU-001',
      displayName: 'Aarav Sharma',
      department: 'Computer Science & Engineering',
      createdAt: '2020-01-01T00:00:00Z',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'incoming().createdAt == request.time',
  },
  {
    id: 8,
    name: 'Immortal Field Mutation (createdAt / uid) on Update',
    collectionPath: '/user_audit_profiles/user_1',
    operation: 'update',
    authContext: {
      uid: 'user_1',
      email: 'aarav.sharma@student.smartcampus.edu.in',
      email_verified: true,
    },
    payload: {
      uid: 'user_2',
      createdAt: '2026-10-12T00:00:00Z',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'incoming().uid == existing().uid && incoming().createdAt == existing().createdAt',
  },
  {
    id: 9,
    name: 'Unauthorized Update Key (sqliteUserId Tampering by Non-Admin)',
    collectionPath: '/user_audit_profiles/user_1',
    operation: 'update',
    authContext: {
      uid: 'user_1',
      email: 'aarav.sharma@student.smartcampus.edu.in',
      email_verified: true,
    },
    payload: {
      sqliteUserId: 'USR-ADMIN-01',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'incoming().sqliteUserId == existing().sqliteUserId && affectedKeys().hasOnly(...)',
  },
  {
    id: 10,
    name: 'Cross-User Profile Read (get)',
    collectionPath: '/user_audit_profiles/student_1',
    operation: 'get',
    authContext: {
      uid: 'student_2',
      email: 'rohan.kulkarni@student.smartcampus.edu.in',
      email_verified: true,
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'request.auth.uid == userId || isAdmin()',
  },
  {
    id: 11,
    name: 'Unscoped List Scraping (list)',
    collectionPath: '/user_audit_profiles',
    operation: 'list',
    authContext: {
      uid: 'student_2',
      email: 'rohan.kulkarni@student.smartcampus.edu.in',
      email_verified: true,
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'resource.data.uid == request.auth.uid',
  },
  {
    id: 12,
    name: 'Self-Promotion to /admins/{adminUid} with Unverified Spoofed Email',
    collectionPath: '/admins/attacker_1',
    operation: 'create',
    authContext: {
      uid: 'attacker_1',
      email: 'sandhyachekuri2718@gmail.com',
      email_verified: false,
    },
    payload: {
      uid: 'attacker_1',
      sqliteUserId: 'USR-ADMIN-01',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRuleGate: 'isAdmin() -> isVerifiedUser() && request.auth.token.email_verified == true',
  },
];
