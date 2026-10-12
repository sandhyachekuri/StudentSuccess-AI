/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Upload,
  BookOpen,
  GraduationCap,
  Shield,
  Menu,
  X,
  LogOut,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  Department,
  EnrichedStudent,
  FacultyMember,
  InterventionCategory,
  InterventionItem,
  InterventionStatus,
  RiskLevel,
  RiskThresholds,
  SegmentId,
  StudentRecord,
  UserRole,
} from './types/student';
import {
  FACULTY_MEMBERS,
  INITIAL_SYNTHETIC_STUDENTS,
} from './data/syntheticStudents';
import {
  DEFAULT_RISK_THRESHOLDS,
  enrichStudentDataset,
} from './engine/analyticsEngine';
import { AdminDashboardView } from './components/AdminDashboardView';
import { FacultyDashboardView } from './components/FacultyDashboardView';
import { StudentDashboardView } from './components/StudentDashboardView';
import { StudentDirectoryView } from './components/StudentDirectoryView';
import { CSVImportView } from './components/CSVImportView';
import { MethodologyView } from './components/MethodologyView';
import { FacultyEvaluationGuide } from './components/FacultyEvaluationGuide';
import { StudentProfileModal } from './components/StudentProfileModal';
import { LoginPageView } from './components/LoginPageView';
import {
  AuthenticatedUser,
  AuthLoginResponse,
  BackendConnectionState,
  BackendHealthResponse,
  checkBackendHealth,
  fetchCurrentUserFromBackend,
  fetchStudentsFromBackend,
  getConfiguredApiBaseUrl,
  getStoredAuthToken,
  logoutFromBackend,
} from './services/apiClient';

type NavView = 'dashboard' | 'directory' | 'import' | 'methodology';

function resolvePathForView(role: UserRole, view: NavView): string {
  return `/${role}/${view}`;
}

export default function App() {
  // FastAPI Backend Connection State
  const [apiBaseUrl, setApiBaseUrl] = useState<string>(() => getConfiguredApiBaseUrl());
  const [backendConnectionState, setBackendConnectionState] =
    useState<BackendConnectionState>('untested');
  const [backendHealthInfo, setBackendHealthInfo] =
    useState<BackendHealthResponse | null>(null);
  const [backendLastError, setBackendLastError] = useState<string | null>(null);

  // Database-Backed Authentication State (`GET /auth/me`, `POST /auth/login`, `POST /auth/logout`)
  const [authUser, setAuthUser] = useState<AuthenticatedUser | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);
  const [isVerifyingSession, setIsVerifyingSession] = useState<boolean>(() =>
    Boolean(getStoredAuthToken())
  );
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [rbacBanner, setRbacBanner] = useState<string | null>(null);

  const handleCheckBackendHealth = async () => {
    setBackendConnectionState('checking');
    setBackendLastError(null);
    try {
      const health = await checkBackendHealth(apiBaseUrl);
      setBackendHealthInfo(health);
      setBackendConnectionState('connected');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setBackendHealthInfo(null);
      setBackendConnectionState('unavailable');
      setBackendLastError(msg);
    }
  };

  // Active Dataset State (starts with 56 deterministic synthetic student records)
  const [rawRecords, setRawRecords] = useState<StudentRecord[]>(
    INITIAL_SYNTHETIC_STUDENTS
  );
  const [facultyMembersState, setFacultyMembersState] =
    useState<FacultyMember[]>(FACULTY_MEMBERS);
  const [isUsingCustomDataset, setIsUsingCustomDataset] = useState(false);

  const handleCohortDataSynced = React.useCallback(
    (dbStudents: StudentRecord[], dbFaculty: FacultyMember[]) => {
      if (dbStudents && dbStudents.length > 0) {
        setRawRecords((prev) => {
          const map = new Map<string, StudentRecord>();
          prev.forEach((r) => map.set(r.studentId.toUpperCase(), r));
          let changed = false;
          dbStudents.forEach((s) => {
            const key = s.studentId.toUpperCase();
            const existing = map.get(key);
            if (
              !existing ||
              existing.name !== s.name ||
              existing.department !== s.department ||
              existing.cgpa !== s.cgpa ||
              existing.attendance !== s.attendance ||
              existing.backlogs !== s.backlogs ||
              existing.assignedFacultyId !== s.assignedFacultyId
            ) {
              map.set(key, { ...(existing || {}), ...s });
              changed = true;
            }
          });
          return changed ? Array.from(map.values()) : prev;
        });
      }

      if (dbFaculty && dbFaculty.length > 0) {
        setFacultyMembersState((prev) => {
          const map = new Map<string, FacultyMember>();
          prev.forEach((f) => map.set(f.id.toUpperCase(), f));
          let changed = false;
          dbFaculty.forEach((f) => {
            const key = f.id.toUpperCase();
            if (!map.has(key)) {
              map.set(key, f);
              changed = true;
            }
          });
          return changed ? Array.from(map.values()) : prev;
        });
      }
    },
    []
  );

  // Configurable Risk Thresholds
  const [thresholds, setThresholds] = useState<RiskThresholds>(
    DEFAULT_RISK_THRESHOLDS
  );

  // Session-persisted Intervention Status Overrides & Custom Interventions
  const [interventionOverrides, setInterventionOverrides] = useState<
    Record<string, { status: InterventionStatus; notes?: string; updatedAt: string }>
  >({
    'INT-STU-2026-001-COD': {
      status: 'In Progress',
      notes: 'Enrolled in Friday DSA problem-solving cohort; completed Week 1 array module.',
      updatedAt: '2026-10-11',
    },
    'INT-STU-2026-002-ATT': {
      status: 'In Progress',
      notes: 'Conducted 1-on-1 counseling with Dr. Chatterjee; weekly attendance tracking active.',
      updatedAt: '2026-10-11',
    },
    'INT-STU-2026-004-REM': {
      status: 'Completed',
      notes: 'Attended Signals & Systems remedial tutorial series; cleared mock test.',
      updatedAt: '2026-10-11',
    },
  });
  const [customInterventions, setCustomInterventions] = useState<InterventionItem[]>([]);

  // Active Role & Scoped Persona State derived from Authenticated User
  const userRole: UserRole = authUser?.role || 'admin';
  const [activeFacultyId, setActiveFacultyId] = useState<string>('FAC-101');
  const [activeStudentId, setActiveStudentId] = useState<string>('STU-2026-001');

  // Navigation & Directory Deep-Link Filter State
  const [activeView, setActiveView] = useState<NavView>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [selectedStudentIdForModal, setSelectedStudentIdForModal] = useState<
    string | null
  >(null);

  const [dirSegmentFilter, setDirSegmentFilter] = useState<SegmentId | 'ALL'>('ALL');
  const [dirDeptFilter, setDirDeptFilter] = useState<Department | 'ALL'>('ALL');
  const [dirAcademicRiskFilter, setDirAcademicRiskFilter] = useState<RiskLevel | 'ALL'>('ALL');
  const [dirPlacementRiskFilter, setDirPlacementRiskFilter] = useState<RiskLevel | 'ALL'>('ALL');

  // Verify existing Bearer session token on startup via GET /auth/me
  useEffect(() => {
    const token = getStoredAuthToken();
    if (!token) {
      setIsVerifyingSession(false);
      if (window.location.pathname !== '/login') {
        window.history.replaceState({}, '', '/login');
      }
      return;
    }

    let cancelled = false;
    fetchCurrentUserFromBackend(apiBaseUrl)
      .then((res) => {
        if (cancelled) return;
        setAuthUser(res.user);
        setSessionExpiresAt(res.expiresAt);
        if (res.user.linkedFacultyId) {
          setActiveFacultyId(res.user.linkedFacultyId);
        }
        if (res.user.linkedStudentId) {
          setActiveStudentId(res.user.linkedStudentId);
        }
        // Check if current URL path is allowed for this user's role
        const path = window.location.pathname.toLowerCase();
        const expectedPrefix = `/${res.user.role}/`;
        if (!path.startsWith(expectedPrefix)) {
          window.history.replaceState({}, '', res.user.redirectTo);
          setActiveView('dashboard');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setAuthUser(null);
        setAuthNotice(
          err instanceof Error
            ? err.message
            : 'Your authentication session expired. Please sign in again.'
        );
        window.history.replaceState({}, '', '/login');
      })
      .finally(() => {
        if (!cancelled) setIsVerifyingSession(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  // Sync dynamically provisioned SQLite student records whenever an authenticated session becomes active
  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    fetchStudentsFromBackend(undefined, apiBaseUrl)
      .then((records) => {
        if (cancelled || !records || records.length === 0) return;
        setRawRecords((prev) => {
          const map = new Map<string, StudentRecord>();
          prev.forEach((r) => map.set(r.studentId.toUpperCase(), r));
          records.forEach((r) => {
            const key = r.studentId.toUpperCase();
            const existing = map.get(key);
            map.set(key, {
              ...(existing || {}),
              studentId: r.studentId,
              name: r.name,
              department: r.department,
              academicYear: r.academicYear,
              cgpa: r.cgpa,
              backlogs: r.backlogs,
              attendance: r.attendance,
              lmsActivity: r.lmsActivity,
              assignmentCompletion: r.assignmentCompletion,
              codingScore: r.codingScore,
              aptitudeScore: r.aptitudeScore,
              communicationScore: r.communicationScore,
              mockInterviewScore: r.mockInterviewScore,
              technicalSkillScore: r.technicalSkillScore,
              extracurricularScore: r.extracurricularScore,
              assignedFacultyId: r.assignedFacultyId,
              semesterHistory: existing?.semesterHistory || r.semesterHistory,
            });
          });
          return Array.from(map.values());
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authUser, apiBaseUrl]);

  // Enforce frontend route protection on browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      if (!authUser) {
        if (window.location.pathname !== '/login') {
          window.history.replaceState({}, '', '/login');
        }
        return;
      }

      const parts = window.location.pathname
        .split('/')
        .filter(Boolean)
        .map((p) => p.toLowerCase());
      const pathRole = parts[0] as UserRole | undefined;
      const pathView = (parts[1] || 'dashboard') as NavView;

      if (pathRole && pathRole !== authUser.role) {
        setRbacBanner(
          `Route protection enforced: Role '${authUser.role.toUpperCase()}' cannot access '/${pathRole}/*'. Redirected to ${authUser.redirectTo}.`
        );
        window.history.replaceState({}, '', authUser.redirectTo);
        setActiveView('dashboard');
        return;
      }

      if (
        authUser.role === 'student' &&
        (pathView === 'directory' || pathView === 'import' || pathView === 'methodology')
      ) {
        setRbacBanner(
          'Student portal: Institutional methodology, rules, directories, and imports are restricted to Admin/Faculty. Displaying your personalized academic insights, attendance, marks, and recommendations.'
        );
        window.history.replaceState({}, '', '/student/dashboard');
        setActiveView('dashboard');
        return;
      }

      if (authUser.role === 'faculty' && pathView === 'import') {
        setRbacBanner(
          'Role permission enforced: CSV Cohort Import is restricted to Admin accounts.'
        );
        window.history.replaceState({}, '', '/faculty/dashboard');
        setActiveView('dashboard');
        return;
      }

      if (
        pathView === 'dashboard' ||
        pathView === 'directory' ||
        pathView === 'import' ||
        pathView === 'methodology'
      ) {
        setActiveView(pathView);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [authUser]);

  const handleNavigateView = (targetView: NavView) => {
    if (!authUser) return;
    if (
      authUser.role === 'student' &&
      (targetView === 'directory' || targetView === 'import' || targetView === 'methodology')
    ) {
      setRbacBanner(
        'Student portal: Institutional methodology and system rules are restricted to Admin and Faculty. Your dashboard displays your personalized insights, marks, attendance, and recommendations.'
      );
      return;
    }
    if (authUser.role === 'faculty' && targetView === 'import') {
      setRbacBanner('Access denied: CSV Data Import requires Admin role permissions.');
      return;
    }
    setRbacBanner(null);
    setActiveView(targetView);
    const nextPath = resolvePathForView(authUser.role, targetView);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
  };

  const handleLoginSuccess = (loginRes: AuthLoginResponse) => {
    setAuthUser(loginRes.user);
    setSessionExpiresAt(loginRes.expiresAt);
    setAuthNotice(null);
    setRbacBanner(null);
    setSelectedStudentIdForModal(null);

    if (loginRes.user.linkedFacultyId) {
      setActiveFacultyId(loginRes.user.linkedFacultyId);
    }
    if (loginRes.user.linkedStudentId) {
      setActiveStudentId(loginRes.user.linkedStudentId);
    }

    setActiveView('dashboard');
    window.history.pushState({}, '', loginRes.redirectTo);
  };

  const handleLogout = async () => {
    await logoutFromBackend(apiBaseUrl);
    setAuthUser(null);
    setSessionExpiresAt(null);
    setSelectedStudentIdForModal(null);
    setRbacBanner(null);
    setAuthNotice('You have signed out. Your session token was revoked on the backend.');
    window.history.pushState({}, '', '/login');
  };

  // Compute Enriched Student Dataset dynamically from rawRecords, thresholds, and session interventions
  const enrichedStudents = useMemo(() => {
    return enrichStudentDataset(
      rawRecords,
      thresholds,
      interventionOverrides,
      customInterventions
    );
  }, [rawRecords, thresholds, interventionOverrides, customInterventions]);

  // Locked Student ID for Student Role (strictly isolated to the logged-in student's own ID)
  const effectiveStudentId =
    userRole === 'student' && authUser?.linkedStudentId
      ? authUser.linkedStudentId
      : activeStudentId;

  // Currently selected student for the slide-over profile modal
  const selectedStudentForModal: EnrichedStudent | null = useMemo(() => {
    if (!selectedStudentIdForModal) return null;
    // Students cannot inspect other students' profiles
    if (userRole === 'student' && selectedStudentIdForModal !== effectiveStudentId) {
      return null;
    }
    return (
      enrichedStudents.find((s) => s.studentId === selectedStudentIdForModal) || null
    );
  }, [selectedStudentIdForModal, enrichedStudents, userRole, effectiveStudentId]);

  // Active Student Record for Student Role
  const currentStudentPersona: EnrichedStudent = useMemo(() => {
    return (
      enrichedStudents.find((s) => s.studentId === effectiveStudentId) ||
      enrichedStudents[0]
    );
  }, [enrichedStudents, effectiveStudentId]);

  const handleUpdateInterventionStatus = (
    interventionId: string,
    status: InterventionStatus,
    notes?: string
  ) => {
    if (userRole === 'student') return;
    const today = new Date().toISOString().slice(0, 10);
    setInterventionOverrides((prev) => ({
      ...prev,
      [interventionId]: {
        status,
        notes: notes !== undefined ? notes : prev[interventionId]?.notes,
        updatedAt: today,
      },
    }));
  };

    const handleAddCustomIntervention = (
    studentId: string,
    category: InterventionCategory,
    title: string,
    recommendedAction: string,
    priority: 'High' | 'Medium' | 'Standard'
  ) => {
    if (userRole === 'student') return;
    const student = rawRecords.find((r) => r.studentId === studentId);
    const mentor =
      facultyMembersState.find((f) => f.id === student?.assignedFacultyId)?.name ||
      'Assigned Faculty Mentor';
    const newItem: InterventionItem = {
      id: `INT-CUSTOM-${Date.now()}`,
      studentId,
      category,
      title,
      reason: 'Custom faculty-initiated intervention based on advisor review.',
      triggerRule: 'Faculty Mentor Assessment',
      recommendedAction,
      priority,
      status: 'Planned',
      assignedTo: mentor,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    setCustomInterventions((prev) => [newItem, ...prev]);
  };

  const handleAssignFaculty = (studentId: string, facultyId: string) => {
    if (userRole !== 'admin') return;
    setRawRecords((prev) =>
      prev.map((r) =>
        r.studentId === studentId ? { ...r, assignedFacultyId: facultyId } : r
      )
    );
  };

  const handleReplaceDataset = (newRecords: StudentRecord[]) => {
    setRawRecords(newRecords);
    setIsUsingCustomDataset(true);
    if (newRecords.length > 0 && userRole !== 'student') {
      setActiveStudentId(newRecords[0].studentId);
    }
  };

  const handleMergeDataset = (newRecords: StudentRecord[]) => {
    setRawRecords((prev) => {
      const map = new Map<string, StudentRecord>();
      prev.forEach((r) => map.set(r.studentId.toUpperCase(), r));
      newRecords.forEach((r) => map.set(r.studentId.toUpperCase(), r));
      return Array.from(map.values());
    });
    setIsUsingCustomDataset(true);
  };

  const handleRestoreDefaultDataset = () => {
    setRawRecords(INITIAL_SYNTHETIC_STUDENTS);
    setIsUsingCustomDataset(false);
    if (userRole !== 'student') {
      setActiveStudentId('STU-2026-001');
    }
  };

  const handleNavigateToDirectoryWithFilter = (opts: {
    segment?: SegmentId | 'ALL';
    department?: Department | 'ALL';
    academicRisk?: RiskLevel | 'ALL';
    placementRisk?: RiskLevel | 'ALL';
  }) => {
    setDirSegmentFilter(opts.segment ?? 'ALL');
    setDirDeptFilter(opts.department ?? 'ALL');
    setDirAcademicRiskFilter(opts.academicRisk ?? 'ALL');
    setDirPlacementRiskFilter(opts.placementRisk ?? 'ALL');
    handleNavigateView('directory');
  };

  const navItems = useMemo(() => {
    const items: { id: NavView; label: string; icon: React.ReactNode }[] = [
      {
        id: 'dashboard',
        label:
          userRole === 'admin'
            ? 'Admin Dashboard'
            : userRole === 'faculty'
            ? 'Faculty Workspace'
            : 'My Student Portal',
        icon: <LayoutDashboard className="w-4 h-4" />,
      },
    ];

    if (userRole === 'admin' || userRole === 'faculty') {
      items.push({
        id: 'directory',
        label: 'Student Directory',
        icon: <Users className="w-4 h-4" />,
      });
    }

    if (userRole === 'admin') {
      items.push({
        id: 'import',
        label: 'CSV Data Import',
        icon: <Upload className="w-4 h-4" />,
      });
    }

    if (userRole === 'admin') {
      items.push({
        id: 'methodology',
        label: 'Methodology & Config',
        icon: <BookOpen className="w-4 h-4" />,
      });
    } else if (userRole === 'faculty') {
      items.push({
        id: 'methodology',
        label: 'Evaluation & Risk Rules',
        icon: <BookOpen className="w-4 h-4" />,
      });
    }

    return items;
  }, [userRole]);

  // 1. Session Verification Loading Screen
  if (isVerifyingSession) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white mx-auto">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div className="text-sm font-semibold">
            Verifying Session via GET /auth/me...
          </div>
          <div className="text-xs text-slate-400">
            StudentSuccess AI Institutional Identity Service
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Route Gate -> Render Login Page
  if (!authUser) {
    return (
      <LoginPageView
        onLoginSuccess={handleLoginSuccess}
        apiBaseUrl={apiBaseUrl}
        initialNotice={authNotice}
      />
    );
  }

  // 3. Authenticated Application Workspace
  return (
    <div className="h-screen w-full overflow-hidden flex bg-slate-50 text-slate-900">
      {/* Mobile Sidebar Backdrop */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
        />
      )}

      {/* Professional Dark Navy Sidebar — Independently Vertically Scrollable */}
      <aside
        aria-label="Workspace Sidebar Navigation"
        className={`sidebar-scroll fixed inset-y-0 left-0 z-40 w-64 h-screen max-h-screen min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-[#0B1120] text-slate-200 flex flex-col justify-between border-r border-slate-800 transition-transform lg:static lg:translate-x-0 shrink-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 space-y-6 shrink-0">
          {/* Brand Lockup */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <div className="font-display font-bold text-base text-white tracking-tight leading-none">
                  StudentSuccess AI
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Predict · Understand · Intervene
                </div>
              </div>
            </div>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="lg:hidden p-1 text-slate-400 hover:text-white"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Authenticated Session Card (Backed by SQLite `auth_sessions`) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Authenticated ({authUser.role.toUpperCase()})</span>
              </span>
              <Shield className="w-3.5 h-3.5 text-blue-400" />
            </div>

            <div className="space-y-0.5">
              <div className="text-xs font-bold text-white truncate">
                {authUser.name}
              </div>
              <div className="text-[11px] font-mono text-slate-400 truncate">
                {authUser.email}
              </div>
              <div className="text-[11px] text-slate-400 leading-snug pt-0.5">
                {authUser.title}
              </div>
            </div>

            {sessionExpiresAt && (
              <div className="text-[10px] font-mono text-slate-500 border-t border-slate-800 pt-2">
                Session Expires: {new Date(sessionExpiresAt).toLocaleString()}
              </div>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-red-950/80 hover:text-red-200 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out (POST /auth/logout)</span>
            </button>
          </div>

          {/* Primary Sidebar Navigation */}
          <nav className="space-y-1">
            <div className="text-[11px] font-semibold text-slate-400 px-3 pb-1">
              Workspace Navigation
            </div>
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    handleNavigateView(item.id);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Dataset, FastAPI Health Status & Hackathon Attribution */}
        <div className="p-5 border-t border-slate-800/80 space-y-3 text-xs shrink-0 mt-auto">
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Active Campus Dataset</span>
              <span className="font-mono text-blue-400">
                {backendConnectionState === 'connected' ? 'FastAPI Ready' : 'SQLite + Local'}
              </span>
            </div>
            <div className="font-mono font-semibold text-white">
              {userRole === 'student'
                ? `Isolated (${effectiveStudentId})`
                : `${enrichedStudents.length} Student Records`}
            </div>
            <div className="text-[11px] text-slate-400">
              {isUsingCustomDataset ? 'Custom / Synced Dataset' : 'Deterministic Synthetic Cohort'}
            </div>
            <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleCheckBackendHealth}
                disabled={backendConnectionState === 'checking'}
                className="text-[11px] font-medium text-blue-400 hover:text-blue-300 underline disabled:opacity-50"
              >
                {backendConnectionState === 'checking'
                  ? 'Checking /health...'
                  : 'Check Backend /health'}
              </button>
              <span className="text-[10px] font-mono text-slate-400">
                {backendConnectionState === 'connected'
                  ? 'Connected'
                  : backendConnectionState === 'unavailable'
                  ? 'Offline (Fallback)'
                  : 'Ready'}
              </span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 leading-normal">
            KPMG in India — HacXLerate 2026
            <br />
            Smart Campus Analytics Platform
          </div>
        </div>
      </aside>

      {/* Main Content Area — Independently Vertically Scrollable */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-screen overflow-y-auto overflow-x-hidden overscroll-y-contain">
        {/* Top Bar Contract: 3 Zones Separated by gap-8 */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-8 shrink-0">
          {/* Zone 1: Brand / Context Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              StudentSuccess AI
            </span>
            <span className="hidden sm:inline-block text-xs font-mono text-slate-400">
              /{userRole}/{activeView}
            </span>
          </div>

          {/* Zone 2: Concise Single-Line Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavigateView(item.id)}
                className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                  activeView === item.id
                    ? 'border-blue-600 text-slate-900 font-semibold'
                    : 'border-transparent'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Primary Action + Sign Out */}
          <div className="flex items-center gap-2.5 shrink-0">
            {userRole === 'student' ? (
              <button
                onClick={() => setSelectedStudentIdForModal(currentStudentPersona.studentId)}
                className="px-3.5 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
              >
                Inspect My Score Breakdown
              </button>
            ) : (
              <button
                onClick={() =>
                  handleNavigateView(activeView === 'directory' ? 'dashboard' : 'directory')
                }
                className="px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                {activeView === 'directory' ? 'Back to Dashboard' : 'Explore Cohort Directory'}
              </button>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1.5 shrink-0"
              title="Sign out and revoke session token"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Main Viewport Container */}
        <main className="flex-1 p-6 max-w-[1440px] w-full mx-auto space-y-4">
          {rbacBanner && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{rbacBanner}</span>
              </div>
              <button
                onClick={() => setRbacBanner(null)}
                className="text-amber-700 hover:text-amber-950 font-semibold"
              >
                Dismiss
              </button>
            </div>
          )}

          {activeView === 'dashboard' && userRole === 'admin' && (
            <AdminDashboardView
              students={enrichedStudents}
              facultyList={facultyMembersState}
              onSelectStudent={(s) => setSelectedStudentIdForModal(s.studentId)}
              onNavigateToDirectoryWithFilter={handleNavigateToDirectoryWithFilter}
              onNavigateToImport={() => handleNavigateView('import')}
              onAssignFaculty={handleAssignFaculty}
              onUpdateInterventionStatus={handleUpdateInterventionStatus}
              apiBaseUrl={apiBaseUrl}
              onCohortDataSynced={handleCohortDataSynced}
            />
          )}

          {activeView === 'dashboard' && userRole === 'faculty' && (
            <FacultyDashboardView
              students={enrichedStudents}
              facultyList={facultyMembersState}
              activeFacultyId={activeFacultyId}
              onChangeActiveFacultyId={setActiveFacultyId}
              onSelectStudent={(s) => setSelectedStudentIdForModal(s.studentId)}
              onUpdateInterventionStatus={handleUpdateInterventionStatus}
            />
          )}

          {activeView === 'dashboard' && userRole === 'student' && (
            <StudentDashboardView
              student={currentStudentPersona}
              demoStudentOptions={[currentStudentPersona]}
              onChangeActiveStudentId={() => {
                // Locked to authenticated student's own record
              }}
              facultyList={facultyMembersState}
            />
          )}

          {activeView === 'directory' && (userRole === 'admin' || userRole === 'faculty') && (
            <StudentDirectoryView
              students={enrichedStudents}
              facultyList={facultyMembersState}
              onSelectStudent={(s) => setSelectedStudentIdForModal(s.studentId)}
              initialSegmentFilter={dirSegmentFilter}
              initialDepartmentFilter={dirDeptFilter}
              initialAcademicRiskFilter={dirAcademicRiskFilter}
              initialPlacementRiskFilter={dirPlacementRiskFilter}
            />
          )}

          {activeView === 'import' && userRole === 'admin' && (
            <CSVImportView
              activeRecordCount={enrichedStudents.length}
              isUsingCustomDataset={isUsingCustomDataset}
              thresholds={thresholds}
              onReplaceDataset={handleReplaceDataset}
              onMergeDataset={handleMergeDataset}
              onRestoreDefaultDataset={handleRestoreDefaultDataset}
              apiBaseUrl={apiBaseUrl}
              backendConnectionState={backendConnectionState}
            />
          )}

          {activeView === 'methodology' && userRole === 'admin' && (
            <MethodologyView
              thresholds={thresholds}
              onUpdateThresholds={setThresholds}
              onResetThresholds={() => setThresholds(DEFAULT_RISK_THRESHOLDS)}
              apiBaseUrl={apiBaseUrl}
              onChangeApiBaseUrl={setApiBaseUrl}
              backendConnectionState={backendConnectionState}
              backendHealthInfo={backendHealthInfo}
              backendLastError={backendLastError}
              onCheckBackendHealth={handleCheckBackendHealth}
              onSyncStudentsFromBackend={handleReplaceDataset}
              activeStudents={rawRecords}
            />
          )}

          {activeView === 'methodology' && userRole === 'faculty' && (
            <FacultyEvaluationGuide
              thresholds={thresholds}
              onNavigateToDashboard={() => handleNavigateView('dashboard')}
              onNavigateToDirectory={() => handleNavigateView('directory')}
            />
          )}

          {activeView === 'methodology' && userRole === 'student' && (
            <StudentDashboardView
              student={currentStudentPersona}
              demoStudentOptions={[currentStudentPersona]}
              onChangeActiveStudentId={() => {}}
              facultyList={facultyMembersState}
            />
          )}
        </main>
      </div>

      {/* Detailed Student Profile Drawer / Modal */}
      <StudentProfileModal
        student={selectedStudentForModal}
        onClose={() => setSelectedStudentIdForModal(null)}
        userRole={userRole}
        facultyList={facultyMembersState}
        onUpdateInterventionStatus={handleUpdateInterventionStatus}
        onAddCustomIntervention={handleAddCustomIntervention}
        onAssignFaculty={handleAssignFaculty}
        apiBaseUrl={apiBaseUrl}
      />
    </div>
  );
}
