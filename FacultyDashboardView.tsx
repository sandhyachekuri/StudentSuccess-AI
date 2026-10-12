import React, { useMemo, useState } from 'react';
import {
  Search,
  AlertOctagon,
  UserCheck,
  CheckCircle2,
  Clock,
  BookOpen,
  Code,
  Calculator,
  MessageSquare,
  CalendarCheck,
  ChevronRight,
} from 'lucide-react';
import {
  EnrichedStudent,
  FacultyMember,
  InterventionCategory,
  InterventionStatus,
  RiskLevel,
} from '../types/student';
import { RiskLevelIndicator } from './StudentProfileModal';

interface FacultyDashboardViewProps {
  students: EnrichedStudent[];
  facultyList: FacultyMember[];
  activeFacultyId: string;
  onChangeActiveFacultyId: (facultyId: string) => void;
  onSelectStudent: (student: EnrichedStudent) => void;
  onUpdateInterventionStatus: (
    interventionId: string,
    status: InterventionStatus,
    notes?: string
  ) => void;
}

export const FacultyDashboardView: React.FC<FacultyDashboardViewProps> = ({
  students,
  facultyList,
  activeFacultyId,
  onChangeActiveFacultyId,
  onSelectStudent,
  onUpdateInterventionStatus,
}) => {
  const [viewScope, setViewScope] = useState<'assigned_only' | 'all_cohort'>('assigned_only');
  const [activeTab, setActiveTab] = useState<
    'immediate_attention' | 'assigned_students' | 'intervention_board'
  >('immediate_attention');
  const [searchQuery, setSearchQuery] = useState('');
  const [academicRiskFilter, setAcademicRiskFilter] = useState<RiskLevel | 'ALL'>('ALL');
  const [placementRiskFilter, setPlacementRiskFilter] = useState<RiskLevel | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<InterventionCategory | 'ALL'>('ALL');

  const currentFaculty =
    facultyList.find((f) => f.id === activeFacultyId) || facultyList[0];

  const scopedStudents = useMemo(() => {
    const base =
      viewScope === 'assigned_only'
        ? students.filter((s) => s.assignedFacultyId === currentFaculty.id)
        : students;

    const q = searchQuery.trim().toLowerCase();
    return base.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q) && !s.studentId.toLowerCase().includes(q)) {
        return false;
      }
      if (academicRiskFilter !== 'ALL' && s.academicRisk.level !== academicRiskFilter) {
        return false;
      }
      if (placementRiskFilter !== 'ALL' && s.placementRisk.level !== placementRiskFilter) {
        return false;
      }
      if (
        categoryFilter !== 'ALL' &&
        !s.interventions.some((i) => i.category === categoryFilter)
      ) {
        return false;
      }
      return true;
    });
  }, [
    students,
    viewScope,
    currentFaculty.id,
    searchQuery,
    academicRiskFilter,
    placementRiskFilter,
    categoryFilter,
  ]);

  const immediateAttentionStudents = useMemo(() => {
    return scopedStudents
      .filter((s) => s.requiresImmediateAttention)
      .sort((a, b) => a.scoreBreakdown.overallScore - b.scoreBreakdown.overallScore);
  }, [scopedStudents]);

  const allScopedInterventions = useMemo(() => {
    return scopedStudents.flatMap((s) =>
      s.interventions
        .filter((i) => categoryFilter === 'ALL' || i.category === categoryFilter)
        .map((i) => ({
          ...i,
          studentName: s.name,
          studentScore: s.scoreBreakdown.overallScore,
          studentRef: s,
        }))
    );
  }, [scopedStudents, categoryFilter]);

  const stats = useMemo(() => {
    const total = scopedStudents.length;
    const avgScore =
      total > 0
        ? (
            scopedStudents.reduce((acc, s) => acc + s.scoreBreakdown.overallScore, 0) / total
          ).toFixed(1)
        : '0.0';
    const urgentCount = immediateAttentionStudents.length;
    const completedCount = allScopedInterventions.filter((i) => i.status === 'Completed').length;
    const inProgressCount = allScopedInterventions.filter(
      (i) => i.status === 'In Progress'
    ).length;

    return {
      total,
      avgScore,
      urgentCount,
      totalInterventions: allScopedInterventions.length,
      completedCount,
      inProgressCount,
    };
  }, [scopedStudents, immediateAttentionStudents, allScopedInterventions]);

  return (
    <div className="space-y-6">
      {/* Faculty Header & Mentor Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-blue-600">
            Faculty & Academic Mentor Workspace · {currentFaculty.department}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Mentee Risk Diagnostics & Intervention Execution
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Active Advisor: <strong>{currentFaculty.name}</strong> ({currentFaculty.designation} ·{' '}
            {currentFaculty.specialization})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-1.5">
            <UserCheck className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs text-slate-500">Faculty Profile:</span>
            <select
              value={currentFaculty.id}
              onChange={(e) => onChangeActiveFacultyId(e.target.value)}
              aria-label="Select Faculty Mentor Profile"
              className="text-xs font-semibold text-slate-900 bg-transparent focus:outline-none"
            >
              {facultyList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.id})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-lg">
            <button
              onClick={() => setViewScope('assigned_only')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                viewScope === 'assigned_only'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My Assigned Mentees
            </button>
            <button
              onClick={() => setViewScope('all_cohort')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                viewScope === 'all_cohort'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Campus Students
            </button>
          </div>
        </div>
      </div>

      {/* Faculty Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Assigned / Scoped Students</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {stats.total}
            </span>
            <span className="text-xs font-mono text-blue-600">
              Avg Score: {stats.avgScore}/100
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Requiring Immediate Attention</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-red-600">
              {stats.urgentCount}
            </span>
            <span className="text-xs text-slate-500">High Risk or Score &lt; 58</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Interventions In Progress</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-blue-600">
              {stats.inProgressCount}
            </span>
            <span className="text-xs font-mono text-slate-500">
              of {stats.totalInterventions} total actions
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Completed Interventions</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-emerald-600">
              {stats.completedCount}
            </span>
            <span className="text-xs text-emerald-700 font-medium">Session Persisted</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assigned student by ID or Name..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="md:col-span-2">
            <select
              value={academicRiskFilter}
              onChange={(e) => setAcademicRiskFilter(e.target.value as RiskLevel | 'ALL')}
              aria-label="Filter by Academic Risk"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
            >
              <option value="ALL">Academic Risk: All</option>
              <option value="High Risk">Academic: High Risk</option>
              <option value="Medium Risk">Academic: Medium Risk</option>
              <option value="Low Risk">Academic: Low Risk</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={placementRiskFilter}
              onChange={(e) => setPlacementRiskFilter(e.target.value as RiskLevel | 'ALL')}
              aria-label="Filter by Placement Risk"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
            >
              <option value="ALL">Placement Risk: All</option>
              <option value="High Risk">Placement: High Risk</option>
              <option value="Medium Risk">Placement: Medium Risk</option>
              <option value="Low Risk">Placement: Low Risk</option>
            </select>
          </div>

          <div className="md:col-span-4">
            <select
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value as InterventionCategory | 'ALL')
              }
              aria-label="Filter by Intervention Category"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
            >
              <option value="ALL">All Intervention Types (Remedial, Attendance, Coding, Aptitude)</option>
              <option value="Remedial Classes">Remedial Classes (Backlogs / Low CGPA)</option>
              <option value="Attendance Follow-Up">Attendance Follow-Ups (&lt;75%)</option>
              <option value="Coding Practice">Coding Practice Plans</option>
              <option value="Aptitude Training">Aptitude Training Modules</option>
              <option value="Communication & Mock Interviews">
                Communication & Mock Interviews
              </option>
              <option value="LMS & Assignment Engagement">LMS & Assignment Follow-Up</option>
            </select>
          </div>
        </div>

        {/* Workspace Mode Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setActiveTab('immediate_attention')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'immediate_attention'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Students Requiring Immediate Attention ({immediateAttentionStudents.length})
            </button>
            <button
              onClick={() => setActiveTab('assigned_students')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'assigned_students'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Assigned Student List & Score Explanations ({scopedStudents.length})
            </button>
            <button
              onClick={() => setActiveTab('intervention_board')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'intervention_board'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Intervention Action Tracker ({allScopedInterventions.length})
            </button>
          </div>
        </div>
      </div>

      {/* Tab 1: Students Requiring Immediate Attention */}
      {activeTab === 'immediate_attention' && (
        <div className="space-y-4">
          {immediateAttentionStudents.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <div className="text-sm font-bold text-slate-900">
                No Students Flagged for Immediate Emergency Intervention in Current Filter
              </div>
              <p className="text-xs text-slate-500">
                Switch to &ldquo;Assigned Student List&rdquo; or &ldquo;All Campus Students&rdquo; to inspect moderate and high-performing students.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {immediateAttentionStudents.map((student) => (
                <div
                  key={student.studentId}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                        <span>{student.studentId}</span>
                        <span aria-hidden="true">·</span>
                        <span>{student.department}</span>
                        <span aria-hidden="true">·</span>
                        <span>Year {student.academicYear}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-sans font-medium text-slate-700">
                          {student.segment.label}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-0.5">
                        {student.name}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 block">Academic Risk</span>
                          <RiskLevelIndicator level={student.academicRisk.level} />
                        </div>
                        <div className="border-l border-slate-200 pl-3">
                          <span className="text-slate-400 block">Placement Risk</span>
                          <RiskLevelIndicator level={student.placementRisk.level} />
                        </div>
                        <div className="border-l border-slate-200 pl-3 text-right">
                          <span className="text-slate-400 block">Success Score</span>
                          <span className="font-mono font-bold text-sm text-blue-600">
                            {student.scoreBreakdown.overallScore.toFixed(1)} / 100
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => onSelectStudent(student)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
                      >
                        Full Profile & Notes
                      </button>
                    </div>
                  </div>

                  {/* Score Explanation & Root Causes */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
                    <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                      <div className="font-semibold text-slate-900">
                        Why This Student Was Flagged:
                      </div>
                      <ul className="space-y-1 text-slate-600 list-disc list-inside">
                        {student.academicRisk.factors.map((f, i) => (
                          <li key={`acad-${i}`}>
                            <strong className="text-slate-800">Academic:</strong> {f.indicator} (
                            {f.observedValue})
                          </li>
                        ))}
                        {student.placementRisk.factors.map((f, i) => (
                          <li key={`plcmt-${i}`}>
                            <strong className="text-slate-800">Placement:</strong> {f.indicator} (
                            {f.observedValue})
                          </li>
                        ))}
                      </ul>
                      <div className="pt-1 text-[11px] text-slate-500 border-t border-slate-200/80">
                        {student.scoreBreakdown.explanation}
                      </div>
                    </div>

                    {/* Targeted Faculty Interventions with Status Controls */}
                    <div className="lg:col-span-7 space-y-2">
                      <div className="font-semibold text-slate-900">
                        Recommended Interventions (Click to Update Status):
                      </div>
                      <div className="space-y-2">
                        {student.interventions.map((intItem) => (
                          <div
                            key={intItem.id}
                            className="border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                          >
                            <div className="space-y-0.5">
                              <div className="text-[11px] font-medium text-blue-700">
                                {intItem.category} · Trigger: {intItem.triggerRule}
                              </div>
                              <div className="font-semibold text-slate-900">{intItem.title}</div>
                              <div className="text-slate-600">{intItem.recommendedAction}</div>
                            </div>

                            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0 self-start sm:self-center">
                              {(
                                ['Planned', 'In Progress', 'Completed'] as InterventionStatus[]
                              ).map((st) => (
                                <button
                                  key={st}
                                  onClick={() =>
                                    onUpdateInterventionStatus(intItem.id, st, intItem.notes)
                                  }
                                  className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                                    intItem.status === st
                                      ? st === 'Completed'
                                        ? 'bg-emerald-600 text-white'
                                        : st === 'In Progress'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white text-slate-900 shadow-xs'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  {st}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Assigned Student List with Score Explanations */}
      {activeTab === 'assigned_students' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-3 text-right">Success Score</th>
                  <th className="py-3 px-3 text-right">CGPA / Backlogs</th>
                  <th className="py-3 px-3 text-right">Attendance</th>
                  <th className="py-3 px-3">Academic Risk</th>
                  <th className="py-3 px-3">Placement Risk</th>
                  <th className="py-3 px-4">Score & Segment Explanation</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {scopedStudents.map((s) => (
                  <tr
                    key={s.studentId}
                    onClick={() => onSelectStudent(s)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{s.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {s.studentId} · Yr {s.academicYear}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-blue-600">
                      {s.scoreBreakdown.overallScore.toFixed(1)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      <div>{s.cgpa.toFixed(2)}</div>
                      <div className="text-[11px] text-slate-500">{s.backlogs} backlogs</div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {s.attendance}%
                    </td>
                    <td className="py-3 px-3">
                      <RiskLevelIndicator level={s.academicRisk.level} />
                    </td>
                    <td className="py-3 px-3">
                      <RiskLevelIndicator level={s.placementRisk.level} />
                    </td>
                    <td className="py-3 px-4 max-w-sm">
                      <div className="font-medium text-slate-800">{s.segment.label}</div>
                      <div className="text-[11px] text-slate-500 line-clamp-2">
                        {s.scoreBreakdown.explanation}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-blue-600">
                        <span>Profile</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Intervention Board by Category */}
      {activeTab === 'intervention_board' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Faculty Intervention Action Board ({allScopedInterventions.length} Items)
              </h2>
              <p className="text-xs text-slate-500">
                Rule-derived recommendations for remedial classes, attendance follow-ups, coding practice, and aptitude training.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {allScopedInterventions.map((item) => (
              <div
                key={item.id}
                className="border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <button
                      onClick={() => onSelectStudent(item.studentRef)}
                      className="font-bold text-slate-900 hover:text-blue-600 hover:underline"
                    >
                      {item.studentName} ({item.studentId})
                    </button>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-blue-700">{item.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>Rule: {item.triggerRule}</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900">{item.title}</div>
                  <div className="text-xs text-slate-600">{item.reason}</div>
                  <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mt-1">
                    <strong>Action Plan:</strong> {item.recommendedAction}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-start lg:self-center">
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    {(['Planned', 'In Progress', 'Completed'] as InterventionStatus[]).map(
                      (st) => (
                        <button
                          key={st}
                          onClick={() =>
                            onUpdateInterventionStatus(item.id, st, item.notes)
                          }
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                            item.status === st
                              ? st === 'Completed'
                                ? 'bg-emerald-600 text-white'
                                : st === 'In Progress'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {st}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
