import {
  CSVValidationError,
  Department,
  EnrichedStudent,
  FacultyMember,
  RiskThresholds,
  StudentRecord,
  UserRole,
} from '../types/student';
import {
  authenticateWithFirebaseEmailPassword,
  authenticateWithFirebaseGooglePopup,
  sendFirebasePasswordReset,
  signOutFirebaseClient,
  syncVerifiedUserAuditProfile,
} from '../firebase';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  title: string;
  role: UserRole;
  department?: string | null;
  linkedFacultyId?: string | null;
  linkedStudentId?: string | null;
  isActive?: boolean;
  firebaseUid?: string | null;
  authProvider?: string;
  accountStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  redirectTo: string;
}

export interface ManagedUsersSummary {
  totalUsers: number;
  activeUsers: number;
  deactivatedUsers: number;
  adminCount: number;
  facultyCount: number;
  studentCount: number;
  firebaseLinkedCount: number;
  firebaseAdminConfigured: boolean;
  firebaseAdminStatus: string;
}

export interface ManagedUsersListResponse {
  summary: ManagedUsersSummary;
  users: AuthenticatedUser[];
  dbStudents: StudentRecord[];
  dbFaculty: FacultyMember[];
}

export interface ProvisionUserPayload {
  role: UserRole;
  email: string;
  name: string;
  initialPassword: string;
  title?: string;
  department?: Department;
  firebaseUid?: string;
  // Faculty fields
  linkedFacultyId?: string;
  designation?: string;
  specialization?: string;
  // Student fields
  linkedStudentId?: string;
  academicYear?: number;
  cgpa?: number;
  backlogs?: number;
  attendance?: number;
  lmsActivity?: number;
  assignmentCompletion?: number;
  codingScore?: number;
  aptitudeScore?: number;
  communicationScore?: number;
  mockInterviewScore?: number;
  technicalSkillScore?: number;
  extracurricularScore?: number;
  assignedFacultyId?: string;
}

export interface ProvisionUserResponse {
  message: string;
  user: AuthenticatedUser;
  studentRecord?: StudentRecord | null;
  facultyProfile?: FacultyMember | null;
}

export interface UpdateUserPayload {
  name?: string;
  title?: string;
  role?: UserRole;
  department?: Department;
  firebaseUid?: string;
  newPassword?: string;
  cgpa?: number;
  attendance?: number;
  backlogs?: number;
}

export interface AuthLoginResponse {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
  rememberMe: boolean;
  redirectTo: string;
  user: AuthenticatedUser;
}

export interface AuthMeResponse {
  user: AuthenticatedUser;
  expiresAt: string;
  rememberMe: boolean;
}

export interface ForgotPasswordResponse {
  status: string;
  email: string;
  message: string;
}

export interface BackendHealthResponse {
  status: string;
  service: string;
  engine: string;
  activeStudentsCount: number;
  geminiConfigured?: boolean;
  timestamp: string;
}

export interface BackendAIStatusResponse {
  configured: boolean;
  service: string;
  model: string;
  message: string;
}

export interface BackendAIRecommendationResponse {
  studentId: string;
  studentName: string;
  modelUsed: string;
  generatedAt: string;
  executiveSummary: string;
  academicAnalysis: string;
  placementAnalysis: string;
  prioritizedActions: string[];
  weeklyStudyPlan: string[];
}

export interface BackendAnalyzeResponse {
  summary: {
    totalStudents: number;
    averageSuccessScore: number;
    averageCgpa: number;
    averageAttendance: number;
    averagePlacementReadiness: number;
    academicHighRiskCount: number;
    academicMediumRiskCount: number;
    placementHighRiskCount: number;
    placementMediumRiskCount: number;
    immediateAttentionCount: number;
  };
  students: EnrichedStudent[];
}

export interface BackendCSVUploadResponse {
  isValidStructure: boolean;
  missingColumns: string[];
  totalRowsRead: number;
  validCount: number;
  errorCount: number;
  errors: CSVValidationError[];
  validRecords: EnrichedStudent[];
}

export type BackendConnectionState =
  | 'untested'
  | 'checking'
  | 'connected'
  | 'unavailable';

const AUTH_TOKEN_STORAGE_KEY = 'ssai_auth_session_token';

export function getStoredAuthToken(): string | null {
  try {
    return (
      localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ||
      sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string, rememberMe: boolean): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    if (rememberMe) {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function clearStoredAuthToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

function buildAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  const token = getStoredAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Resolves the configured API base URL from VITE_API_BASE_URL or an explicit override.
 */
export function getConfiguredApiBaseUrl(overrideUrl?: string): string {
  const raw =
    overrideUrl !== undefined
      ? overrideUrl
      : (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
        'http://localhost:8000';
  return raw.trim().replace(/\/+$/, '');
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 6000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Attempts the configured FastAPI URL first (`VITE_API_BASE_URL`, e.g., `http://localhost:8000`).
 * If unreachable over the network (e.g., inside the cloud preview container where port 3000
 * hosts the Python SQLite auth bridge), seamlessly falls back to the same-origin server (`""`).
 */
async function fetchBackendEndpoint(
  endpointPath: string,
  options: RequestInit = {},
  baseUrlOverride?: string,
  timeoutMs = 6000
): Promise<Response> {
  const primaryBase = getConfiguredApiBaseUrl(baseUrlOverride);
  const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;

  if (primaryBase) {
    try {
      return await fetchWithTimeout(`${primaryBase}${cleanPath}`, options, timeoutMs);
    } catch {
      // Network unreachable on primaryBase (e.g. localhost:8000 from remote browser);
      // fall through to same-origin backend bridge on port 3000.
    }
  }
  return await fetchWithTimeout(cleanPath, options, timeoutMs);
}

/**
 * POST /auth/firebase-login — Sends a verified Firebase ID token via `Authorization: Bearer <idToken>`
 * to the FastAPI backend, where Firebase Admin SDK verifies the token and maps the verified UID
 * to the SQLite user profile and role.
 */
export async function loginWithFirebaseTokenOnBackend(
  params: {
    idToken: string;
    role: UserRole;
    rememberMe: boolean;
  },
  baseUrlOverride?: string
): Promise<AuthLoginResponse> {
  const res = await fetchBackendEndpoint(
    '/auth/firebase-login',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${params.idToken}`,
      },
      body: JSON.stringify(params),
    },
    baseUrlOverride
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.detail || `Firebase backend authentication failed with HTTP ${res.status}`
    );
  }

  const loginResponse = data as AuthLoginResponse;
  setStoredAuthToken(loginResponse.accessToken, params.rememberMe);
  syncVerifiedUserAuditProfile({
    sqliteUserId: loginResponse.user.id,
    displayName: loginResponse.user.name,
    department: loginResponse.user.department || 'Institutional Governance',
  }).catch(() => {});
  return loginResponse;
}

/**
 * Signs in with Firebase Google Popup, obtains a signed Firebase ID token,
 * and verifies identity + role authorization against the FastAPI/SQLite backend.
 */
export async function loginWithGoogleFirebasePopup(
  params: {
    role: UserRole;
    rememberMe: boolean;
  },
  baseUrlOverride?: string
): Promise<AuthLoginResponse> {
  const fbResult = await authenticateWithFirebaseGooglePopup();
  return await loginWithFirebaseTokenOnBackend(
    {
      idToken: fbResult.idToken,
      role: params.role,
      rememberMe: params.rememberMe,
    },
    baseUrlOverride
  );
}

/**
 * Hybrid Email/Password Sign-In:
 * 1. Attempts Firebase Authentication Email/Password provider first (`signInWithEmailAndPassword`),
 *    obtains a signed Firebase ID token, and sends `Authorization: Bearer <idToken>` to `POST /auth/firebase-login`.
 * 2. If the Email/Password provider is not yet enabled in the Firebase Console or the seeded SQLite user
 *    has not yet been migrated into Firebase Auth, verifies credentials against SQLite (`POST /auth/login`)
 *    and automatically links/provisions the Firebase Auth UID when Email/Password is enabled.
 */
export async function loginWithBackend(
  params: {
    email: string;
    password: string;
    role: UserRole;
    rememberMe: boolean;
  },
  baseUrlOverride?: string
): Promise<AuthLoginResponse> {
  // Step 1: Try direct Firebase Email/Password authentication
  try {
    const fbResult = await authenticateWithFirebaseEmailPassword(
      params.email,
      params.password,
      false
    );
    return await loginWithFirebaseTokenOnBackend(
      {
        idToken: fbResult.idToken,
        role: params.role,
        rememberMe: params.rememberMe,
      },
      baseUrlOverride
    );
  } catch (fbErr: any) {
    const fbCode = String(fbErr?.code || '');
    // If Firebase explicitly rejected a wrong password for an existing Firebase user, surface it
    if (fbCode === 'auth/wrong-password' || fbCode === 'auth/too-many-requests') {
      throw new Error(
        fbCode === 'auth/too-many-requests'
          ? 'Too many unsuccessful sign-in attempts. Please wait a moment and try again.'
          : 'Invalid institutional email or password. Please verify your credentials.'
      );
    }
    // Otherwise fall through to SQLite credential verification + automatic Firebase UID migration
  }

  // Step 2: Verify against SQLite PBKDF2-HMAC-SHA256 database
  const res = await fetchBackendEndpoint(
    '/auth/login',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(params),
    },
    baseUrlOverride
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.detail || `Authentication failed with HTTP ${res.status}`
    );
  }

  let loginResponse = data as AuthLoginResponse;
  setStoredAuthToken(loginResponse.accessToken, params.rememberMe);

  // Step 3: If SQLite credentials succeeded and user has no firebaseUid yet,
  // attempt to auto-provision & link in Firebase Email/Password if enabled in console
  if (!loginResponse.user.firebaseUid) {
    try {
      const migratedFb = await authenticateWithFirebaseEmailPassword(
        params.email,
        params.password,
        true
      );
      loginResponse = await loginWithFirebaseTokenOnBackend(
        {
          idToken: migratedFb.idToken,
          role: params.role,
          rememberMe: params.rememberMe,
        },
        baseUrlOverride
      );
    } catch {
      // Email/Password provider may not be enabled yet in Firebase Console; SQLite session remains active
    }
  }

  return loginResponse;
}

/**
 * POST /auth/logout — Signs out of Firebase client session, revokes the backend session token,
 * and clears client token storage.
 */
export async function logoutFromBackend(baseUrlOverride?: string): Promise<void> {
  try {
    await signOutFirebaseClient();
    await fetchBackendEndpoint(
      '/auth/logout',
      {
        method: 'POST',
        headers: buildAuthHeaders({ Accept: 'application/json' }),
      },
      baseUrlOverride
    );
  } finally {
    clearStoredAuthToken();
  }
}

/**
 * GET /auth/me — Verifies the stored Bearer token with the backend and returns the active user.
 */
export async function fetchCurrentUserFromBackend(
  baseUrlOverride?: string
): Promise<AuthMeResponse> {
  const token = getStoredAuthToken();
  if (!token) {
    throw new Error('No active session token found.');
  }

  const res = await fetchBackendEndpoint(
    '/auth/me',
    {
      method: 'GET',
      headers: buildAuthHeaders({ Accept: 'application/json' }),
    },
    baseUrlOverride
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    clearStoredAuthToken();
    throw new Error(data.detail || `Session verification failed (HTTP ${res.status})`);
  }

  return data as AuthMeResponse;
}

/**
 * POST /auth/forgot-password — Dispatches a Firebase password reset email (when enabled)
 * and logs the institutional reset request in SQLite.
 */
export async function requestPasswordResetFromBackend(
  params: { email: string; role?: UserRole },
  baseUrlOverride?: string
): Promise<ForgotPasswordResponse> {
  try {
    await sendFirebasePasswordReset(params.email);
  } catch {
    // Continue to record in SQLite even if email hasn't been registered in Firebase Auth yet
  }

  const res = await fetchBackendEndpoint(
    '/auth/forgot-password',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(params),
    },
    baseUrlOverride
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `Password reset request failed (HTTP ${res.status})`);
  }
  return data as ForgotPasswordResponse;
}

/**
 * GET /api/admin/users — Lists all SQLite user accounts, role summaries, and dynamically
 * provisioned student/faculty records. Restricted to Admin role.
 */
export async function fetchManagedUsersFromBackend(
  filters?: {
    search?: string;
    role?: string;
    status?: string;
  },
  baseUrlOverride?: string
): Promise<ManagedUsersListResponse> {
  const params = new URLSearchParams();
  if (filters?.search && filters.search.trim()) {
    params.set('search', filters.search.trim());
  }
  if (filters?.role && filters.role !== 'ALL') {
    params.set('role', filters.role);
  }
  if (filters?.status && filters.status !== 'ALL') {
    params.set('status', filters.status);
  }
  const qs = params.toString();
  const path = `/api/admin/users${qs ? `?${qs}` : ''}`;

  const res = await fetchBackendEndpoint(
    path,
    {
      method: 'GET',
      headers: buildAuthHeaders({ Accept: 'application/json' }),
    },
    baseUrlOverride
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `GET /api/admin/users failed with HTTP ${res.status}`);
  }
  return data as ManagedUsersListResponse;
}

/**
 * POST /api/admin/users — Provisions a new Student, Faculty, or Admin account in SQLite.
 */
export async function provisionUserViaBackend(
  payload: ProvisionUserPayload,
  baseUrlOverride?: string
): Promise<ProvisionUserResponse> {
  const res = await fetchBackendEndpoint(
    '/api/admin/users',
    {
      method: 'POST',
      headers: buildAuthHeaders({
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }),
      body: JSON.stringify(payload),
    },
    baseUrlOverride
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `POST /api/admin/users failed with HTTP ${res.status}`);
  }
  return data as ProvisionUserResponse;
}

/**
 * PUT /api/admin/users/:userId — Updates user profile, role assignment, Firebase UID, or academic metrics.
 */
export async function updateUserViaBackend(
  userId: string,
  payload: UpdateUserPayload,
  baseUrlOverride?: string
): Promise<{ message: string; user: AuthenticatedUser }> {
  const res = await fetchBackendEndpoint(
    `/api/admin/users/${encodeURIComponent(userId)}`,
    {
      method: 'PUT',
      headers: buildAuthHeaders({
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }),
      body: JSON.stringify(payload),
    },
    baseUrlOverride
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.detail || `PUT /api/admin/users/${userId} failed with HTTP ${res.status}`
    );
  }
  return data as { message: string; user: AuthenticatedUser };
}

/**
 * PATCH /api/admin/users/:userId/status — Activates or deactivates a user account.
 */
export async function setUserActiveStatusViaBackend(
  userId: string,
  isActive: boolean,
  baseUrlOverride?: string
): Promise<{ message: string; user: AuthenticatedUser }> {
  const res = await fetchBackendEndpoint(
    `/api/admin/users/${encodeURIComponent(userId)}/status`,
    {
      method: 'PATCH',
      headers: buildAuthHeaders({
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }),
      body: JSON.stringify({ isActive }),
    },
    baseUrlOverride
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.detail || `PATCH /api/admin/users/${userId}/status failed with HTTP ${res.status}`
    );
  }
  return data as { message: string; user: AuthenticatedUser };
}

/**
 * GET /health — Checks if the backend is reachable and healthy.
 */
export async function checkBackendHealth(
  baseUrlOverride?: string
): Promise<BackendHealthResponse> {
  const res = await fetchBackendEndpoint(
    '/health',
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
    },
    baseUrlOverride
  );

  if (!res.ok) {
    throw new Error(`Health check returned HTTP ${res.status}`);
  }
  return (await res.json()) as BackendHealthResponse;
}

/**
 * GET /api/students — Fetches enriched student records from the backend (enforcing RBAC).
 */
export async function fetchStudentsFromBackend(
  filters?: {
    department?: string;
    academic_risk?: string;
    placement_risk?: string;
    segment?: string;
    search?: string;
  },
  baseUrlOverride?: string
): Promise<EnrichedStudent[]> {
  const params = new URLSearchParams();
  if (filters?.department && filters.department !== 'ALL') {
    params.set('department', filters.department);
  }
  if (filters?.academic_risk && filters.academic_risk !== 'ALL') {
    params.set('academic_risk', filters.academic_risk);
  }
  if (filters?.placement_risk && filters.placement_risk !== 'ALL') {
    params.set('placement_risk', filters.placement_risk);
  }
  if (filters?.segment && filters.segment !== 'ALL') {
    params.set('segment', filters.segment);
  }
  if (filters?.search) {
    params.set('search', filters.search);
  }

  const queryString = params.toString();
  const path = `/api/students${queryString ? `?${queryString}` : ''}`;

  const res = await fetchBackendEndpoint(
    path,
    {
      method: 'GET',
      headers: buildAuthHeaders({ Accept: 'application/json' }),
    },
    baseUrlOverride
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody.detail || `GET /api/students failed with HTTP ${res.status}`
    );
  }
  return (await res.json()) as EnrichedStudent[];
}

/**
 * GET /api/students/{student_id} — Fetches a single enriched student record by ID.
 * Students are restricted by the backend to their own linkedStudentId (`403 Forbidden` otherwise).
 */
export async function fetchStudentByIdFromBackend(
  studentId: string,
  baseUrlOverride?: string
): Promise<EnrichedStudent> {
  const res = await fetchBackendEndpoint(
    `/api/students/${encodeURIComponent(studentId)}`,
    {
      method: 'GET',
      headers: buildAuthHeaders({ Accept: 'application/json' }),
    },
    baseUrlOverride
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody.detail || `GET /api/students/${studentId} failed with HTTP ${res.status}`
    );
  }
  return (await res.json()) as EnrichedStudent;
}

/**
 * POST /api/analyze — Sends student records and optional risk thresholds to the backend.
 */
export async function analyzeCohortViaBackend(
  students: StudentRecord[],
  thresholds?: RiskThresholds,
  baseUrlOverride?: string
): Promise<BackendAnalyzeResponse> {
  const res = await fetchBackendEndpoint(
    '/api/analyze',
    {
      method: 'POST',
      headers: buildAuthHeaders({
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }),
      body: JSON.stringify({
        students,
        thresholds,
      }),
    },
    baseUrlOverride,
    8000
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody.detail
        ? typeof errBody.detail === 'string'
          ? errBody.detail
          : JSON.stringify(errBody.detail)
        : `POST /api/analyze failed with HTTP ${res.status}`
    );
  }
  return (await res.json()) as BackendAnalyzeResponse;
}

/**
 * POST /api/upload-csv — Uploads a CSV file to the FastAPI backend for validation.
 */
export async function uploadCsvViaBackend(
  file: File,
  replaceActive = false,
  baseUrlOverride?: string
): Promise<BackendCSVUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetchBackendEndpoint(
    `/api/upload-csv?replace_active=${replaceActive ? 'true' : 'false'}`,
    {
      method: 'POST',
      headers: buildAuthHeaders(),
      body: formData,
    },
    baseUrlOverride,
    8000
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody.detail || `POST /api/upload-csv failed with HTTP ${res.status}`
    );
  }
  return (await res.json()) as BackendCSVUploadResponse;
}

/**
 * GET /api/ai/status — Checks whether GEMINI_API_KEY is configured on the backend.
 */
export async function checkBackendAiStatus(
  baseUrlOverride?: string
): Promise<BackendAIStatusResponse> {
  const res = await fetchBackendEndpoint(
    '/api/ai/status',
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
    },
    baseUrlOverride
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody.detail || `GET /api/ai/status failed with HTTP ${res.status}`
    );
  }
  return (await res.json()) as BackendAIStatusResponse;
}

/**
 * POST /api/ai/recommendations — Requests personalized student analysis and learning
 * recommendations from the backend using server-side GEMINI_API_KEY.
 */
export async function requestStudentAiRecommendations(
  student: StudentRecord,
  focusArea?: string,
  baseUrlOverride?: string
): Promise<BackendAIRecommendationResponse> {
  const res = await fetchBackendEndpoint(
    '/api/ai/recommendations',
    {
      method: 'POST',
      headers: buildAuthHeaders({
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }),
      body: JSON.stringify({
        student: {
          studentId: student.studentId,
          name: student.name,
          department: student.department,
          academicYear: student.academicYear,
          cgpa: student.cgpa,
          backlogs: student.backlogs,
          attendance: student.attendance,
          lmsActivity: student.lmsActivity,
          assignmentCompletion: student.assignmentCompletion,
          codingScore: student.codingScore,
          aptitudeScore: student.aptitudeScore,
          communicationScore: student.communicationScore,
          mockInterviewScore: student.mockInterviewScore,
          technicalSkillScore: student.technicalSkillScore,
          extracurricularScore: student.extracurricularScore,
          assignedFacultyId: student.assignedFacultyId,
          semesterHistory: student.semesterHistory,
        },
        focusArea: focusArea || 'Comprehensive Academic & Placement Improvement',
      }),
    },
    baseUrlOverride,
    15000
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody.detail || `POST /api/ai/recommendations failed with HTTP ${res.status}`
    );
  }
  return (await res.json()) as BackendAIRecommendationResponse;
}
