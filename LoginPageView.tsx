import React, { useState } from 'react';
import {
  GraduationCap,
  Shield,
  UserCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertOctagon,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  KeyRound,
  Database,
  X,
} from 'lucide-react';
import { UserRole } from '../types/student';
import {
  AuthLoginResponse,
  loginWithBackend,
  loginWithGoogleFirebasePopup,
  requestPasswordResetFromBackend,
} from '../services/apiClient';
import { getFirebaseProjectInfo } from '../firebase';

interface LoginPageViewProps {
  onLoginSuccess: (authResponse: AuthLoginResponse) => void;
  apiBaseUrl?: string;
  initialNotice?: string | null;
}

interface SeededCredentialOption {
  role: UserRole;
  label: string;
  name: string;
  email: string;
  passwordHint: string;
  scopeNote: string;
}

const SEEDED_DB_ACCOUNTS: SeededCredentialOption[] = [
  {
    role: 'admin',
    label: 'Admin (Dean of Academics)',
    name: 'Dr. Rajeshwari Menon',
    email: 'dean.academics@smartcampus.edu.in',
    passwordHint: 'Admin@2026',
    scopeNote: 'Full campus cohort, CSV import & risk threshold governance (/admin/dashboard)',
  },
  {
    role: 'faculty',
    label: 'Faculty Mentor (CSE · FAC-101)',
    name: 'Dr. Arindam Chatterjee',
    email: 'a.chatterjee@smartcampus.edu.in',
    passwordHint: 'Faculty@2026',
    scopeNote: 'Assigned mentees, department cohort & intervention tracking (/faculty/dashboard)',
  },
  {
    role: 'faculty',
    label: 'Faculty Mentor (DS & AI · FAC-102)',
    name: 'Prof. Meenakshi Iyer',
    email: 'm.iyer@smartcampus.edu.in',
    passwordHint: 'Faculty@2026',
    scopeNote: 'Data Science & AI cohort advisor (/faculty/dashboard)',
  },
  {
    role: 'student',
    label: 'Student (STU-2026-001 · CSE)',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@student.smartcampus.edu.in',
    passwordHint: 'Student@2026',
    scopeNote: 'Isolated to STU-2026-001 academic & placement record (/student/dashboard)',
  },
  {
    role: 'student',
    label: 'Student (STU-2026-002 · CSE)',
    name: 'Rohan Kulkarni',
    email: 'rohan.kulkarni@student.smartcampus.edu.in',
    passwordHint: 'Student@2026',
    scopeNote: 'Isolated to STU-2026-002 academic & placement record (/student/dashboard)',
  },
];

export const LoginPageView: React.FC<LoginPageViewProps> = ({
  onLoginSuccess,
  apiBaseUrl,
  initialNotice,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [email, setEmail] = useState<string>('dean.academics@smartcampus.edu.in');
  const [password, setPassword] = useState<string>('Admin@2026');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);

  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState<boolean>(false);
  const fbProjectInfo = getFirebaseProjectInfo();

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [resetEmail, setResetEmail] = useState<string>('');
  const [isResetSubmitting, setIsResetSubmitting] = useState<boolean>(false);
  const [resetFeedback, setResetFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = 'Institutional email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Enter a valid institutional email address (e.g., user@smartcampus.edu.in).';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRoleTabSelect = (role: UserRole) => {
    setSelectedRole(role);
    setServerError(null);
    setFieldErrors({});
  };

  const handleAutofillSeededAccount = (acct: SeededCredentialOption) => {
    setSelectedRole(acct.role);
    setEmail(acct.email);
    setPassword(acct.passwordHint);
    setServerError(null);
    setFieldErrors({});
  };

  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const response = await loginWithBackend(
        {
          email: email.trim(),
          password,
          role: selectedRole,
          rememberMe,
        },
        apiBaseUrl
      );
      onLoginSuccess(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleFirebaseLogin = async () => {
    setServerError(null);
    setFieldErrors({});
    setIsGoogleSubmitting(true);
    try {
      const response = await loginWithGoogleFirebasePopup(
        {
          role: selectedRole,
          rememberMe,
        },
        apiBaseUrl
      );
      onLoginSuccess(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setServerError(msg);
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetFeedback(null);
    const cleaned = resetEmail.trim();
    if (!cleaned || !cleaned.includes('@')) {
      setResetFeedback({
        type: 'error',
        message: 'Please enter a valid institutional email address.',
      });
      return;
    }

    setIsResetSubmitting(true);
    try {
      const res = await requestPasswordResetFromBackend(
        { email: cleaned, role: selectedRole },
        apiBaseUrl
      );
      setResetFeedback({
        type: 'success',
        message: res.message,
      });
    } catch (err) {
      setResetFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsResetSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col lg:flex-row">
      {/* Left Institutional Branding & Architecture Panel */}
      <div className="lg:w-5/12 xl:w-1/2 bg-[#0B1120] text-slate-100 p-8 lg:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800">
        <div className="space-y-8">
          {/* Brand Header */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight text-white">
                StudentSuccess AI
              </div>
              <div className="text-xs text-slate-400 font-medium">
                Predict. Understand. Intervene. Improve.
              </div>
            </div>
          </div>

          <div className="space-y-3 max-w-xl">
            <div className="text-xs font-mono uppercase tracking-wider text-blue-400">
              KPMG in India — HacXLerate 2026 · Smart Campus Analytics
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight leading-snug">
              Unified Academic & Placement Intelligence Platform
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Database-backed role authentication enforcing strict institutional governance across College Administration, Faculty Mentors, and Students.
            </p>
          </div>

          {/* Role-Based Access Scope Breakdown */}
          <div className="space-y-3 pt-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Backend-Enforced Role Permissions
            </div>
            <div className="grid grid-cols-1 gap-3 text-xs">
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-blue-400" />
                    Admin (/admin/dashboard)
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">Full Governance</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Institution-wide KPIs, department & risk analytics, student directory, CSV cohort import, and threshold calibration.
                </p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-teal-400" />
                    Faculty Mentor (/faculty/dashboard)
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">Mentee & Dept Scope</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Immediate attention queue, assigned mentee tracking, custom intervention logging, and Gemini AI study plans.
                </p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-violet-400" />
                    Student (/student/dashboard)
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">Strict Self-Record Isolation</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Personal Student Success Score breakdown, What-If goal simulator, and AI study plan. Backend blocks access to other students' records (HTTP 403).
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>
            Identity: Firebase Auth ({fbProjectInfo.projectId}) · Profiles & RBAC: SQLite
          </span>
          <span className="font-mono text-[11px] text-emerald-400">
            Bearer ID Token + PBKDF2 Hybrid
          </span>
        </div>
      </div>

      {/* Right Authentication Form & Seeded Database Account Selector */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Sign in to your account
            </h2>
            <p className="text-xs text-slate-600">
              Select your institutional role and enter your credentials verified against the backend database.
            </p>
          </div>

          {initialNotice && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertOctagon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>{initialNotice}</div>
            </div>
          )}

          {/* Role Selection Tabs */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              1. Select Institutional Role
            </label>
            <div
              className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200"
              role="tablist"
              aria-label="Institutional Role Selection"
            >
              {(
                [
                  { id: 'admin', label: 'Admin', icon: Shield },
                  { id: 'faculty', label: 'Faculty', icon: UserCheck },
                  { id: 'student', label: 'Student', icon: GraduationCap },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = selectedRole === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => handleRoleTabSelect(tab.id)}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                      active
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmitLogin} className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4" noValidate>
            {serverError && (
              <div
                className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2.5"
                role="alert"
              >
                <AlertOctagon className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">Authentication Failed</div>
                  <div>{serverError}</div>
                </div>
              </div>
            )}

            {/* Email Input */}
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Institutional Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
                  }}
                  placeholder={
                    selectedRole === 'admin'
                      ? 'dean.academics@smartcampus.edu.in'
                      : selectedRole === 'faculty'
                      ? 'a.chatterjee@smartcampus.edu.in'
                      : 'aarav.sharma@student.smartcampus.edu.in'
                  }
                  className={`w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 focus:bg-white transition-colors ${
                    fieldErrors.email
                      ? 'border-red-400 focus:ring-red-500'
                      : 'border-slate-300 focus:ring-blue-600'
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password Input with Show/Hide */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setResetFeedback(null);
                    setShowForgotModal(true);
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password)
                      setFieldErrors({ ...fieldErrors, password: undefined });
                  }}
                  placeholder="Enter your password"
                  className={`w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 focus:bg-white transition-colors ${
                    fieldErrors.password
                      ? 'border-red-400 focus:ring-red-500'
                      : 'border-slate-300 focus:ring-blue-600'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.password}</p>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-700 font-medium">
                  Remember me (7-day session token)
                </span>
              </label>
              <span className="text-[11px] font-mono text-slate-400">
                Target: /{selectedRole}/dashboard
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || isGoogleSubmitting}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Firebase / SQLite Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In with Email as {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="relative py-1 flex items-center justify-center">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-2.5 text-[11px] font-medium text-slate-400 uppercase tracking-wider shrink-0">
                Or Firebase SSO
              </span>
              <div className="border-t border-slate-200 w-full" />
            </div>

            <button
              type="button"
              onClick={handleGoogleFirebaseLogin}
              disabled={isSubmitting || isGoogleSubmitting}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              {isGoogleSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Firebase ID Token via Bearer Header...</span>
                </>
              ) : (
                <>
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    Sign In with Google (Firebase Auth · {selectedRole.toUpperCase()})
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Seeded SQLite Database Accounts Reference Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Database className="w-3.5 h-3.5 text-blue-600" />
                <span>Seeded SQLite Database Accounts (Click to Autofill)</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">studentsuccess.db</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              These accounts are stored in SQLite with PBKDF2-HMAC-SHA256 password hashes. Clicking an account fills the form above so you can test real <code className="font-mono">POST /auth/login</code> verification, role mismatch rejection, or invalid passwords.
            </p>
            <div className="space-y-1.5">
              {SEEDED_DB_ACCOUNTS.map((acct) => {
                const isCurrent =
                  email.toLowerCase() === acct.email.toLowerCase() &&
                  selectedRole === acct.role;
                return (
                  <button
                    key={acct.email}
                    type="button"
                    onClick={() => handleAutofillSeededAccount(acct)}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors flex items-center justify-between gap-2 ${
                      isCurrent
                        ? 'bg-blue-50/80 border-blue-300 text-slate-900'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{acct.label}</div>
                      <div className="font-mono text-[11px] text-slate-500 truncate">
                        {acct.email} · PW: {acct.passwordHint}
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-blue-600 shrink-0">
                      Autofill
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-password-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-600" />
                <h3 id="forgot-password-title" className="text-sm font-bold text-slate-900">
                  Institutional Password Recovery
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Enter your SmartCampus institutional email address. The backend (<code className="font-mono">POST /auth/forgot-password</code>) will log your recovery request and dispatch reset instructions.
            </p>

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Institutional Email
                </label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="user@smartcampus.edu.in"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                />
              </div>

              {resetFeedback && (
                <div
                  className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                    resetFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  {resetFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertOctagon className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <span>{resetFeedback.message}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isResetSubmitting}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg"
                >
                  {isResetSubmitting ? 'Submitting...' : 'Send Recovery Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
