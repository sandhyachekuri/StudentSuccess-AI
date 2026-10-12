import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Search,
  RefreshCw,
  Edit3,
  Power,
  CheckCircle2,
  AlertOctagon,
  GraduationCap,
  UserCheck,
  Shield,
  X,
  KeyRound,
  Link2,
} from 'lucide-react';
import {
  Department,
  FacultyMember,
  StudentRecord,
  UserRole,
} from '../types/student';
import { DEPARTMENTS } from '../data/syntheticStudents';
import {
  AuthenticatedUser,
  fetchManagedUsersFromBackend,
  ManagedUsersSummary,
  ProvisionUserPayload,
  provisionUserViaBackend,
  setUserActiveStatusViaBackend,
  UpdateUserPayload,
  updateUserViaBackend,
} from '../services/apiClient';
import { getFirebaseProjectInfo } from '../firebase';

interface AdminUserManagementPanelProps {
  apiBaseUrl?: string;
  facultyList: FacultyMember[];
  onCohortDataSynced?: (
    dbStudents: StudentRecord[],
    dbFaculty: FacultyMember[]
  ) => void;
}

export const AdminUserManagementPanel: React.FC<
  AdminUserManagementPanelProps
> = ({ apiBaseUrl, facultyList, onCohortDataSynced }) => {
  const [users, setUsers] = useState<AuthenticatedUser[]>([]);
  const [summary, setSummary] = useState<ManagedUsersSummary | null>(null);
  const [dbStudentsMap, setDbStudentsMap] = useState<
    Record<string, StudentRecord>
  >({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Provision Modal State ('student' | 'faculty' | null)
  const [provisionModalRole, setProvisionModalRole] = useState<
    'student' | 'faculty' | null
  >(null);
  const [isProvisioning, setIsProvisioning] = useState<boolean>(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  // Provision Form Fields
  const [provName, setProvName] = useState<string>('');
  const [provEmail, setProvEmail] = useState<string>('');
  const [provPassword, setProvPassword] = useState<string>('Campus@2026');
  const [provDept, setProvDept] = useState<Department>(
    'Computer Science & Engineering'
  );
  const [provFirebaseUid, setProvFirebaseUid] = useState<string>('');
  // Faculty-specific
  const [provFacId, setProvFacId] = useState<string>('');
  const [provDesignation, setProvDesignation] = useState<string>(
    'Assistant Professor & Faculty Advisor'
  );
  const [provSpecialization, setProvSpecialization] = useState<string>(
    'Applied AI & Software Systems'
  );
  // Student-specific
  const [provStuId, setProvStuId] = useState<string>('');
  const [provYear, setProvYear] = useState<number>(3);
  const [provAssignedFac, setProvAssignedFac] = useState<string>('FAC-101');
  const [provCgpa, setProvCgpa] = useState<number>(7.8);
  const [provBacklogs, setProvBacklogs] = useState<number>(0);
  const [provAttendance, setProvAttendance] = useState<number>(84);
  const [provLms, setProvLms] = useState<number>(80);
  const [provAssignments, setProvAssignments] = useState<number>(82);
  const [provCoding, setProvCoding] = useState<number>(74);
  const [provAptitude, setProvAptitude] = useState<number>(75);
  const [provComm, setProvComm] = useState<number>(76);
  const [provMock, setProvMock] = useState<number>(72);
  const [provTech, setProvTech] = useState<number>(75);
  const [provExtra, setProvExtra] = useState<number>(70);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<AuthenticatedUser | null>(
    null
  );
  const [editName, setEditName] = useState<string>('');
  const [editTitle, setEditTitle] = useState<string>('');
  const [editRole, setEditRole] = useState<UserRole>('student');
  const [editDept, setEditDept] = useState<Department | ''>('');
  const [editFirebaseUid, setEditFirebaseUid] = useState<string>('');
  const [editNewPassword, setEditNewPassword] = useState<string>('');
  const [editCgpa, setEditCgpa] = useState<string>('');
  const [editAttendance, setEditAttendance] = useState<string>('');
  const [editBacklogs, setEditBacklogs] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fbInfo = getFirebaseProjectInfo();

  const loadManagedUsers = useCallback(async () => {
    setIsLoading(true);
    setErrorBanner(null);
    try {
      const res = await fetchManagedUsersFromBackend(
        {
          search: searchQuery,
          role: roleFilter,
          status: statusFilter,
        },
        apiBaseUrl
      );
      setUsers(res.users);
      setSummary(res.summary);
      const stuMap: Record<string, StudentRecord> = {};
      (res.dbStudents || []).forEach((s) => {
        stuMap[s.studentId.toUpperCase()] = s;
      });
      setDbStudentsMap(stuMap);
      if (onCohortDataSynced) {
        onCohortDataSynced(res.dbStudents || [], res.dbFaculty || []);
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, searchQuery, roleFilter, statusFilter, onCohortDataSynced]);

  useEffect(() => {
    loadManagedUsers();
  }, [loadManagedUsers]);

  const openProvisionModal = (role: 'student' | 'faculty') => {
    setProvisionModalRole(role);
    setProvisionError(null);
    setProvName('');
    setProvEmail('');
    setProvPassword(role === 'student' ? 'Student@2026' : 'Faculty@2026');
    setProvDept('Computer Science & Engineering');
    setProvFirebaseUid('');
    setProvFacId('');
    setProvStuId('');
    setProvYear(3);
    setProvAssignedFac(facultyList[0]?.id || 'FAC-101');
    setProvCgpa(7.8);
    setProvBacklogs(0);
    setProvAttendance(84);
  };

  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provisionModalRole) return;
    setProvisionError(null);
    setSuccessBanner(null);

    if (provName.trim().length < 2) {
      setProvisionError('Full name must be at least 2 characters.');
      return;
    }
    if (!provEmail.trim() || !provEmail.includes('@')) {
      setProvisionError('Enter a valid institutional email address.');
      return;
    }
    if (provPassword.length < 6) {
      setProvisionError(
        'Initial activation password must be at least 6 characters.'
      );
      return;
    }

    const payload: ProvisionUserPayload = {
      role: provisionModalRole,
      name: provName.trim(),
      email: provEmail.trim().toLowerCase(),
      initialPassword: provPassword,
      department: provDept,
      firebaseUid: provFirebaseUid.trim() || undefined,
    };

    if (provisionModalRole === 'faculty') {
      payload.linkedFacultyId = provFacId.trim() || undefined;
      payload.designation = provDesignation.trim();
      payload.specialization = provSpecialization.trim();
    } else {
      payload.linkedStudentId = provStuId.trim() || undefined;
      payload.academicYear = Number(provYear);
      payload.assignedFacultyId = provAssignedFac;
      payload.cgpa = Number(provCgpa);
      payload.backlogs = Number(provBacklogs);
      payload.attendance = Number(provAttendance);
      payload.lmsActivity = Number(provLms);
      payload.assignmentCompletion = Number(provAssignments);
      payload.codingScore = Number(provCoding);
      payload.aptitudeScore = Number(provAptitude);
      payload.communicationScore = Number(provComm);
      payload.mockInterviewScore = Number(provMock);
      payload.technicalSkillScore = Number(provTech);
      payload.extracurricularScore = Number(provExtra);
    }

    setIsProvisioning(true);
    try {
      const created = await provisionUserViaBackend(payload, apiBaseUrl);
      setSuccessBanner(created.message);
      setProvisionModalRole(null);
      await loadManagedUsers();
    } catch (err) {
      setProvisionError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProvisioning(false);
    }
  };

  const openEditModal = (u: AuthenticatedUser) => {
    setEditingUser(u);
    setEditError(null);
    setEditName(u.name);
    setEditTitle(u.title);
    setEditRole(u.role);
    setEditDept((u.department as Department) || '');
    setEditFirebaseUid(u.firebaseUid || '');
    setEditNewPassword('');

    const linkedStu = u.linkedStudentId
      ? dbStudentsMap[u.linkedStudentId.toUpperCase()]
      : undefined;
    setEditCgpa(linkedStu ? String(linkedStu.cgpa) : '');
    setEditAttendance(linkedStu ? String(linkedStu.attendance) : '');
    setEditBacklogs(linkedStu ? String(linkedStu.backlogs) : '');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);
    setSuccessBanner(null);

    const payload: UpdateUserPayload = {
      name: editName.trim(),
      title: editTitle.trim(),
      role: editRole,
      department: (editDept as Department) || undefined,
      firebaseUid: editFirebaseUid.trim(),
    };
    if (editNewPassword.trim()) {
      payload.newPassword = editNewPassword.trim();
    }
    if (editingUser.linkedStudentId) {
      if (editCgpa !== '') payload.cgpa = Number(editCgpa);
      if (editAttendance !== '') payload.attendance = Number(editAttendance);
      if (editBacklogs !== '') payload.backlogs = Number(editBacklogs);
    }

    setIsUpdating(true);
    try {
      const res = await updateUserViaBackend(
        editingUser.id,
        payload,
        apiBaseUrl
      );
      setSuccessBanner(res.message);
      setEditingUser(null);
      await loadManagedUsers();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleStatus = async (u: AuthenticatedUser) => {
    setErrorBanner(null);
    setSuccessBanner(null);
    const nextActive = !u.isActive;
    try {
      const res = await setUserActiveStatusViaBackend(
        u.id,
        nextActive,
        apiBaseUrl
      );
      setSuccessBanner(res.message);
      await loadManagedUsers();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* Architecture & Provisioning Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">
                Firebase Authentication & Dynamic SQLite User Governance
              </h2>
              <span className="text-[11px] font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">
                Firebase Project: {fbInfo.projectId}
              </span>
            </div>
            <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
              Identity verification is powered by <strong>Firebase Authentication</strong> (verified on FastAPI via <code className="font-mono">firebase-admin</code> / Bearer ID tokens), while <strong>SQLite</strong> (<code className="font-mono">studentsuccess.db</code>) stores authoritative user profiles, role assignments, and academic records. Provision new Students or Faculty below without source-code changes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => openProvisionModal('student')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Student</span>
            </button>
            <button
              type="button"
              onClick={() => openProvisionModal('faculty')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Add Faculty</span>
            </button>
            <button
              type="button"
              onClick={loadManagedUsers}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              title="Refresh SQLite User Directory"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] font-medium text-slate-500">
                Total Provisioned Users
              </div>
              <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                {summary.totalUsers}
              </div>
            </div>
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3">
              <div className="text-[11px] font-medium text-emerald-800">
                Active Accounts
              </div>
              <div className="text-xl font-bold font-mono text-emerald-700 mt-0.5">
                {summary.activeUsers}
              </div>
            </div>
            <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3">
              <div className="text-[11px] font-medium text-amber-800">
                Deactivated
              </div>
              <div className="text-xl font-bold font-mono text-amber-700 mt-0.5">
                {summary.deactivatedUsers}
              </div>
            </div>
            <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-3">
              <div className="text-[11px] font-medium text-blue-800">
                Students / Faculty
              </div>
              <div className="text-xl font-bold font-mono text-blue-700 mt-0.5">
                {summary.studentCount} / {summary.facultyCount}
              </div>
            </div>
            <div className="bg-violet-50/60 border border-violet-200 rounded-lg p-3">
              <div className="text-[11px] font-medium text-violet-800">
                Administrators
              </div>
              <div className="text-xl font-bold font-mono text-violet-700 mt-0.5">
                {summary.adminCount}
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] font-medium text-slate-500">
                Firebase UID Linked
              </div>
              <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                {summary.firebaseLinkedCount}
              </div>
            </div>
          </div>
        )}

        {/* Feedback Banners */}
        {successBanner && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{successBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessBanner(null)}
              className="text-emerald-700 hover:text-emerald-950 font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {errorBanner && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-red-600 shrink-0" />
              <span className="font-medium">{errorBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="text-red-700 hover:text-red-950 font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users by name, email, USR ID, STU-2026-xxx, FAC-xxx, or department..."
              aria-label="Search user records"
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Filter by role"
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium"
            >
              <option value="ALL">All Roles</option>
              <option value="admin">Admin Only</option>
              <option value="faculty">Faculty Only</option>
              <option value="student">Student Only</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by account status"
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="active">Active Accounts</option>
              <option value="deactivated">Deactivated Accounts</option>
            </select>
          </div>
        </div>

        {/* User Records Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-4">User ID & Profile</th>
                <th className="py-3 px-3">Institutional Email</th>
                <th className="py-3 px-3">Role & Scope</th>
                <th className="py-3 px-3">Firebase Identity Mapping</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Governance Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-slate-500 text-xs"
                  >
                    {isLoading
                      ? 'Loading institutional user records from SQLite...'
                      : 'No user accounts match the current search or filter criteria.'}
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const linkedStu = u.linkedStudentId
                    ? dbStudentsMap[u.linkedStudentId.toUpperCase()]
                    : undefined;
                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        !u.isActive ? 'opacity-65 bg-slate-50/60' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {u.name}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {u.id} · {u.title}
                        </div>
                        {linkedStu && (
                          <div className="text-[11px] text-blue-700 font-mono mt-0.5">
                            CGPA: {linkedStu.cgpa.toFixed(2)} · Att:{' '}
                            {linkedStu.attendance}% · Backlogs:{' '}
                            {linkedStu.backlogs}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700">
                        {u.email}
                      </td>
                      <td className="py-3 px-3">
                        <div className="inline-flex items-center gap-1 font-mono font-bold uppercase text-[11px] text-slate-900">
                          {u.role === 'admin' && (
                            <Shield className="w-3.5 h-3.5 text-violet-600" />
                          )}
                          {u.role === 'faculty' && (
                            <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                          )}
                          {u.role === 'student' && (
                            <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          <span>{u.role}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {u.role === 'admin'
                            ? 'Full Institutional Governance'
                            : u.role === 'faculty'
                            ? `${u.linkedFacultyId || 'FAC'} · ${u.department || 'All Depts'}`
                            : `${u.linkedStudentId || 'STU'} · ${u.department || ''}`}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {u.firebaseUid ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                              <Link2 className="w-3 h-3" />
                              Firebase UID Linked
                            </span>
                            <div className="font-mono text-[10px] text-slate-500 truncate max-w-[170px]">
                              {u.firebaseUid}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="text-[11px] font-medium text-slate-600">
                              Auto-links on Firebase Sign-In
                            </span>
                            <div className="font-mono text-[10px] text-slate-400">
                              Provider: {u.authProvider || 'sqlite_pbkdf2'}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-0.5">
                            Deactivated
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                              u.isActive
                                ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            <Power className="w-3 h-3" />
                            <span>{u.isActive ? 'Deactivate' : 'Activate'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PROVISION NEW STUDENT / FACULTY MODAL */}
      {provisionModalRole && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 shadow-xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {provisionModalRole === 'student'
                    ? 'Provision New Student Account & Academic Record'
                    : 'Provision New Faculty Mentor Account'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setProvisionModalRole(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {provisionError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2">
                <AlertOctagon className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{provisionError}</span>
              </div>
            )}

            <form onSubmit={handleProvisionSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={provName}
                    onChange={(e) => setProvName(e.target.value)}
                    placeholder={
                      provisionModalRole === 'student'
                        ? 'e.g., Siddharth Nair'
                        : 'e.g., Dr. Kavita Krishnan'
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Institutional Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={provEmail}
                    onChange={(e) => setProvEmail(e.target.value)}
                    placeholder={
                      provisionModalRole === 'student'
                        ? 'siddharth.nair@student.smartcampus.edu.in'
                        : 'k.krishnan@smartcampus.edu.in'
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department *
                  </label>
                  <select
                    value={provDept}
                    onChange={(e) => setProvDept(e.target.value as Department)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Activation Password *
                  </label>
                  <input
                    type="text"
                    required
                    value={provPassword}
                    onChange={(e) => setProvPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {provisionModalRole === 'student'
                      ? 'Student ID (Auto-generated if blank)'
                      : 'Faculty ID (Auto-generated if blank)'}
                  </label>
                  <input
                    type="text"
                    value={
                      provisionModalRole === 'student' ? provStuId : provFacId
                    }
                    onChange={(e) =>
                      provisionModalRole === 'student'
                        ? setProvStuId(e.target.value)
                        : setProvFacId(e.target.value)
                    }
                    placeholder={
                      provisionModalRole === 'student'
                        ? 'e.g., STU-2026-057'
                        : 'e.g., FAC-106'
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Firebase UID (Optional — Auto-links on First Login)
                  </label>
                  <input
                    type="text"
                    value={provFirebaseUid}
                    onChange={(e) => setProvFirebaseUid(e.target.value)}
                    placeholder="Leave blank to link automatically"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {provisionModalRole === 'faculty' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Academic Designation
                    </label>
                    <input
                      type="text"
                      value={provDesignation}
                      onChange={(e) => setProvDesignation(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Specialization Area
                    </label>
                    <input
                      type="text"
                      value={provSpecialization}
                      onChange={(e) => setProvSpecialization(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="text-xs font-bold text-slate-800">
                    Academic & Placement Baseline Indicators (SQLite{' '}
                    <code className="font-mono">student_records</code>)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Academic Year (1–4)
                      </label>
                      <select
                        value={provYear}
                        onChange={(e) => setProvYear(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                      >
                        {[1, 2, 3, 4].map((yr) => (
                          <option key={yr} value={yr}>
                            Year {yr}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Assigned Faculty Mentor
                      </label>
                      <select
                        value={provAssignedFac}
                        onChange={(e) => setProvAssignedFac(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                      >
                        {facultyList.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.id} · {f.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        CGPA (0–10)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={provCgpa}
                        onChange={(e) => setProvCgpa(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Active Backlogs (0–20)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={provBacklogs}
                        onChange={(e) => setProvBacklogs(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Attendance %
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={provAttendance}
                        onChange={(e) =>
                          setProvAttendance(Number(e.target.value))
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        LMS Activity (0–100)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={provLms}
                        onChange={(e) => setProvLms(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Assignment %
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={provAssignments}
                        onChange={(e) =>
                          setProvAssignments(Number(e.target.value))
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Coding Score (0–100)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={provCoding}
                        onChange={(e) => setProvCoding(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Aptitude Score
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={provAptitude}
                        onChange={(e) => setProvAptitude(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Communication
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={provComm}
                        onChange={(e) => setProvComm(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Mock Interview
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={provMock}
                        onChange={(e) => setProvMock(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Technical Skills
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={provTech}
                        onChange={(e) => setProvTech(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setProvisionModalRole(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProvisioning}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg"
                >
                  {isProvisioning
                    ? 'Provisioning in SQLite...'
                    : `Create ${provisionModalRole === 'student' ? 'Student' : 'Faculty'} Account`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER PROFILE, ROLE & ACADEMIC METRICS MODAL */}
      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Update User Profile & Role ({editingUser.id})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2">
                <AlertOctagon className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Institutional Email (Immutable Identifier)
                </label>
                <input
                  type="text"
                  disabled
                  value={editingUser.email}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-100 border border-slate-200 rounded-lg text-slate-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Authorized Role
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Institutional Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={editDept}
                    onChange={(e) =>
                      setEditDept(e.target.value as Department | '')
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="">None (Institutional)</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Linked Firebase UID
                  </label>
                  <input
                    type="text"
                    value={editFirebaseUid}
                    onChange={(e) => setEditFirebaseUid(e.target.value)}
                    placeholder="Auto-linked on Firebase login"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {editingUser.linkedStudentId && (
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-800">
                    Linked Student Academic Record ({editingUser.linkedStudentId})
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        CGPA (0–10)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={editCgpa}
                        onChange={(e) => setEditCgpa(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Attendance %
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={editAttendance}
                        onChange={(e) => setEditAttendance(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Backlogs
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={editBacklogs}
                        onChange={(e) => setEditBacklogs(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reset Password (Optional — Leave blank to keep current)</span>
                </label>
                <input
                  type="password"
                  value={editNewPassword}
                  onChange={(e) => setEditNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 chars)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg"
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
