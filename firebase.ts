import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK with provisioned configuration
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot per skill requirements
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export function getFirebaseProjectInfo() {
  return {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
    consoleProvidersUrl: `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`,
  };
}

export interface FirebaseSignInResult {
  idToken: string;
  uid: string;
  email: string;
  emailVerified: boolean;
}

/**
 * Signs in using Firebase Authentication Email/Password provider and returns
 * a fresh Firebase ID token (`Authorization: Bearer <idToken>`).
 * If `autoCreateIfVerifiedInSqlite` is true and the account does not yet exist
 * in Firebase Auth (e.g. a newly migrated SQLite user), creates the Firebase Auth
 * identity so subsequent sign-ins use Firebase UID directly.
 */
export async function authenticateWithFirebaseEmailPassword(
  email: string,
  password: string,
  autoCreateIfNewInFirebase = false
): Promise<FirebaseSignInResult> {
  const cleanedEmail = email.trim().toLowerCase();
  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      cleanedEmail,
      password
    );
    const idToken = await credential.user.getIdToken(true);
    return {
      idToken,
      uid: credential.user.uid,
      email: credential.user.email || cleanedEmail,
      emailVerified: credential.user.emailVerified,
    };
  } catch (err: any) {
    const code = String(err?.code || '');
    if (
      autoCreateIfNewInFirebase &&
      (code === 'auth/user-not-found' || code === 'auth/invalid-credential')
    ) {
      const created = await createUserWithEmailAndPassword(
        auth,
        cleanedEmail,
        password
      );
      const idToken = await created.user.getIdToken(true);
      return {
        idToken,
        uid: created.user.uid,
        email: created.user.email || cleanedEmail,
        emailVerified: created.user.emailVerified,
      };
    }
    throw err;
  }
}

/**
 * Signs in using Firebase Google Popup (configured by default in ProvisionFirebase)
 * and returns a fresh Firebase ID token to verify against the SQLite profile store.
 */
export async function authenticateWithFirebaseGooglePopup(): Promise<FirebaseSignInResult> {
  const credential = await signInWithPopup(auth, googleProvider);
  const idToken = await credential.user.getIdToken(true);
  return {
    idToken,
    uid: credential.user.uid,
    email: (credential.user.email || '').toLowerCase(),
    emailVerified: credential.user.emailVerified,
  };
}

/**
 * Dispatches a password reset email via Firebase Authentication.
 */
export async function sendFirebasePasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}

/**
 * Signs out of Firebase Authentication client session.
 */
export async function signOutFirebaseClient(): Promise<void> {
  try {
    await signOut(auth);
  } catch {
    // Ignore client sign-out errors if already signed out
  }
}

/**
 * Syncs non-PII user audit metadata to `/user_audit_profiles/{uid}` when a verified
 * Firebase user signs in, adhering strictly to `firebase-blueprint.json` volumetric bounds.
 */
export async function syncVerifiedUserAuditProfile(params: {
  sqliteUserId: string;
  displayName: string;
  department: string;
}): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    return;
  }

  const uid = currentUser.uid.slice(0, 128);
  const safeSqliteId = params.sqliteUserId
    .replace(/[^a-zA-Z0-9_\-]/g, '-')
    .slice(0, 64);
  const safeDisplayName = (params.displayName || 'Institutional User')
    .trim()
    .slice(0, 120);
  const safeDepartment = (params.department || 'Institutional Governance')
    .trim()
    .slice(0, 80);

  if (
    safeSqliteId.length < 3 ||
    safeDisplayName.length < 2 ||
    safeDepartment.length < 2
  ) {
    return;
  }

  const path = `user_audit_profiles/${uid}`;
  const docRef = doc(db, 'user_audit_profiles', uid);

  try {
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) {
      await setDoc(docRef, {
        uid,
        sqliteUserId: safeSqliteId,
        displayName: safeDisplayName,
        department: safeDepartment,
        lastLoginAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = existingSnap.data();
      await setDoc(docRef, {
        uid,
        sqliteUserId: existingData.sqliteUserId || safeSqliteId,
        displayName: safeDisplayName,
        department: safeDepartment,
        lastLoginAt: serverTimestamp(),
        createdAt: existingData.createdAt,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export { onAuthStateChanged, type User };
