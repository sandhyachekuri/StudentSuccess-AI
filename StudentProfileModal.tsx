import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  BookOpen,
  Briefcase,
  Award,
  Clock,
  Check,
  Plus,
  UserCheck,
  TrendingUp,
  Info,
  RefreshCw,
} from 'lucide-react';
import {
  BackendAIRecommendationResponse,
  requestStudentAiRecommendations,
} from '../services/apiClient';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import {
  EnrichedStudent,
  FacultyMember,
  InterventionCategory,
  InterventionItem,
  InterventionStatus,
  RiskLevel,
  UserRole,
} from '../types/student';

interface StudentProfileModalProps {
  student: EnrichedStudent | null;
  onClose: () => void;
  userRole: UserRole;
  facultyList: FacultyMember[];
  onUpdateInterventionStatus: (
    interventionId: string,
    status: InterventionStatus,
    notes?: string
  ) => void;
  onAddCustomIntervention: (
    studentId: string,
    category: InterventionCategory,
    title: string,
    recommendedAction: string,
    priority: 'High' | 'Medium' | 'Standard'
  ) => void;
  onAssignFaculty?: (studentId: string, facultyId: string) => void;
  apiBaseUrl?: string;
}

export const RiskLevelIndicator: React.FC<{ level: RiskLevel }> = ({ level }) => {
  if (level === 'High Risk') {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-red-700 text-xs whitespace-nowrap">
        <AlertOctagon className="w-3.5 h-3.5 text-red-600 shrink-0" />
        <span>High Risk</span>
      </span>
    );
  }
  if (level === 'Medium Risk') {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 text-xs whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span>Medium Risk</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 text-xs whitespace-nowrap">
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
      <span>Low Risk</span>
    </span>
  );
};

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  student,
  onClose,
  userRole,
  facultyList,
  onUpdateInterventionStatus,
  onAddCustomIntervention,
  onAssignFaculty,
  apiBaseUrl,
}) => {
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategory, setNewCategory] = useState<InterventionCategory>('Remedial Classes');
  const [newTitle, setNewTitle] = useState('');
  const [newAction, setNewAction] = useState('');
  const [newPriority, setNewPriority] = useState<'High' | 'Medium' | 'Standard'>('High');

  // Backend Gemini AI Recommendation State
  const [aiRecommendation, setAiRecommendation] =
    useState<BackendAIRecommendationResponse | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  React.useEffect(() => {
    setAiRecommendation(null);
    setAiError(null);
    setIsLoadingAi(false);
  }, [student?.studentId]);

  if (!student) return null;

  const handleRequestBackendAi = async () => {
    setIsLoadingAi(true);
    setAiError(null);
    try {
      const response = await requestStudentAiRecommendations(
        student,
        student.segment.label,
        apiBaseUrl
      );
      setAiRecommendation(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAiError(
        msg.includes('Failed to fetch') || msg.includes('aborted')
          ? 'Could not reach the Python FastAPI backend (POST /api/ai/recommendations). Ensure FastAPI is running on port 8000 with GEMINI_API_KEY configured in .env.'
          : msg
      );
    } finally {
      setIsLoadingAi(false);
    }
  };

  const canModifyInterventions = userRole === 'admin' || userRole === 'faculty';
  const assignedFaculty = facultyList.find((f) => f.id === student.assignedFacultyId);

  const componentChartData = [
    {
      name: 'Academics (30%)',
      normalized: student.scoreBreakdown.components.academicPerformance,
      weighted: student.scoreBreakdown.weightedContributions.academicPerformance,
      maxWeight: 30,
      color: '#2563eb',
    },
    {
      name: 'Attendance (20%)',
      normalized: student.scoreBreakdown.components.attendance,
      weighted: student.scoreBreakdown.weightedContributions.attendance,
      maxWeight: 20,
      color: '#0891b2',
    },
    {
      name: 'Placement (25%)',
      normalized: student.scoreBreakdown.components.placementReadiness,
      weighted: student.scoreBreakdown.weightedContributions.placementReadiness,
      maxWeight: 25,
      color: '#7c3aed',
    },
    {
      name: 'LMS & Tasks (10%)',
      normalized: student.scoreBreakdown.components.lmsActivity,
      weighted: student.scoreBreakdown.weightedContributions.lmsActivity,
      maxWeight: 10,
      color: '#4f46e5',
    },
    {
      name: 'Skills & Extra (15%)',
      normalized: student.scoreBreakdown.components.skillsAndEngagement,
      weighted: student.scoreBreakdown.weightedContributions.skillsAndEngagement,
      maxWeight: 15,
      color: '#0d9488',
    },
  ];

  const handleCreateIntervention = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newAction.trim()) return;
    onAddCustomIntervention(
      student.studentId,
      newCategory,
      newTitle.trim(),
      newAction.trim(),
      newPriority
    );
    setNewTitle('');
    setNewAction('');
    setShowAddForm(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-profile-title"
    >
      <div className="relative w-full max-w-4xl bg-white h-full overflow-y-auto shadow-2xl border-l border-slate-200 flex flex-col">
        {/* Top Sticky Modal Header */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
              <span>{student.studentId}</span>
              <span aria-hidden="true">·</span>
              <span>{student.department}</span>
              <span aria-hidden="true">·</span>
              <span>Year {student.academicYear}</span>
            </div>
            <h2
              id="student-profile-title"
              className="text-xl font-bold text-slate-900 mt-0.5 tracking-tight"
            >
              {student.name}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-slate-500">Student Success Score</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-blue-600">
                {student.scoreBreakdown.overallScore.toFixed(1)}
                <span className="text-sm font-normal text-slate-400"> / 100</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Close student profile"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Profile Body */}
        <div className="p-6 space-y-8 flex-1">
          {/* Segment & Mentor Assignment Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs text-slate-500">Assigned Cohort Segment</div>
              <div className="text-sm font-semibold text-slate-900">{student.segment.label}</div>
              <p className="text-xs text-slate-600">{student.segment.ruleMatched}</p>
            </div>

            <div className="shrink-0 border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-4">
              <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Assigned Faculty Mentor</span>
              </div>
              {userRole === 'admin' && onAssignFaculty ? (
                <select
                  value={student.assignedFacultyId}
                  onChange={(e) => onAssignFaculty(student.studentId, e.target.value)}
                  className="text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {facultyList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.id})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-sm font-medium text-slate-900">
                  {assignedFaculty ? `${assignedFaculty.name} (${assignedFaculty.id})` : student.assignedFacultyId}
                </div>
              )}
            </div>
          </div>

          {/* Section 1: Transparent Student Success Score Breakdown */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  01. Student Success Score Breakdown
                </h3>
                <p className="text-xs text-slate-500">
                  Normalized 0–100 component scores and weighted contributions (Prototype Rule-Based Composite)
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500">
                Total: {student.scoreBreakdown.overallScore.toFixed(1)} / 100
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 space-y-3">
                {componentChartData.map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{item.name}</span>
                      <span className="font-mono tabular-nums text-slate-900">
                        <span className="text-slate-500">
                          {item.normalized.toFixed(1)}/100 →{' '}
                        </span>
                        <strong className="text-blue-700">
                          +{item.weighted.toFixed(2)} pts
                        </strong>{' '}
                        <span className="text-slate-400">(max {item.maxWeight})</span>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.max(0, item.normalized))}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Exact Calculation Trace</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {student.scoreBreakdown.explanation}
                </p>
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>Raw CGPA Base: {student.scoreBreakdown.subDetails.normalizedCgpa.toFixed(0)}/100</span>
                  <span>Backlog Penalty: -{student.scoreBreakdown.subDetails.backlogPenalty} pts</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Separate Academic & Placement Risk Assessments */}
          <section className="space-y-4">
            <div className="border-b border-slate-200 pb-2">
              <h3 className="text-base font-bold text-slate-900">
                02. Independent Risk Assessments & Contributing Factors
              </h3>
              <p className="text-xs text-slate-500">
                Academic Risk and Placement Risk are evaluated independently so high-CGPA students with weak placement readiness (or vice versa) are never masked.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Academic Risk Box */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <h4 className="text-sm font-bold text-slate-900">Academic Risk Assessment</h4>
                  </div>
                  <RiskLevelIndicator level={student.academicRisk.level} />
                </div>

                <p className="text-xs text-slate-600">{student.academicRisk.summaryExplanation}</p>

                {student.academicRisk.factors.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    <div className="text-xs font-semibold text-slate-700">
                      Contributing Academic Risk Factors:
                    </div>
                    <ul className="space-y-1.5">
                      {student.academicRisk.factors.map((f, idx) => (
                        <li
                          key={idx}
                          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-start justify-between gap-2"
                        >
                          <div>
                            <span className="font-semibold text-slate-900">{f.indicator}</span>
                            <div className="text-slate-500">Rule: {f.thresholdRule}</div>
                          </div>
                          <span className="font-mono font-semibold text-slate-800 whitespace-nowrap">
                            {f.observedValue}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="text-xs text-emerald-700 bg-emerald-50/60 border border-emerald-200 rounded-lg p-2.5">
                    No academic risk flags triggered. CGPA, attendance, and coursework meet benchmarks.
                  </div>
                )}
              </div>

              {/* Placement Risk Box */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-violet-600" />
                    <h4 className="text-sm font-bold text-slate-900">Placement Risk Assessment</h4>
                  </div>
                  <RiskLevelIndicator level={student.placementRisk.level} />
                </div>

                <p className="text-xs text-slate-600">{student.placementRisk.summaryExplanation}</p>

                {student.placementRisk.factors.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    <div className="text-xs font-semibold text-slate-700">
                      Contributing Placement Risk Factors:
                    </div>
                    <ul className="space-y-1.5">
                      {student.placementRisk.factors.map((f, idx) => (
                        <li
                          key={idx}
                          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-start justify-between gap-2"
                        >
                          <div>
                            <span className="font-semibold text-slate-900">{f.indicator}</span>
                            <div className="text-slate-500">Rule: {f.thresholdRule}</div>
                          </div>
                          <span className="font-mono font-semibold text-slate-800 whitespace-nowrap">
                            {f.observedValue}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="text-xs text-emerald-700 bg-emerald-50/60 border border-emerald-200 rounded-lg p-2.5">
                    No placement risk flags triggered. Coding, aptitude, communication, and interview scores meet targets.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Section 3: Complete Indicator Matrix & Semester Progression */}
          <section className="space-y-4">
            <div className="border-b border-slate-200 pb-2">
              <h3 className="text-base font-bold text-slate-900">
                03. Complete Student Indicator Matrix & Trajectory
              </h3>
              <p className="text-xs text-slate-500">
                All 11 quantitative academic, engagement, and placement readiness indicators
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[
                { label: 'Cumulative GPA', value: `${student.cgpa.toFixed(2)} / 10` },
                { label: 'Active Backlogs', value: `${student.backlogs}` },
                { label: 'Attendance', value: `${student.attendance}%` },
                { label: 'LMS Activity', value: `${student.lmsActivity} / 100` },
                { label: 'Assignment Completion', value: `${student.assignmentCompletion}%` },
                { label: 'Coding Score', value: `${student.codingScore} / 100` },
                { label: 'Aptitude Score', value: `${student.aptitudeScore} / 100` },
                { label: 'Communication Score', value: `${student.communicationScore} / 100` },
                { label: 'Mock Interview Score', value: `${student.mockInterviewScore} / 100` },
                { label: 'Technical Skill Score', value: `${student.technicalSkillScore} / 100` },
                { label: 'Extracurricular Score', value: `${student.extracurricularScore} / 100` },
                {
                  label: 'Placement Readiness Avg',
                  value: `${student.scoreBreakdown.components.placementReadiness.toFixed(1)} / 100`,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5"
                >
                  <div className="text-xs text-slate-500">{stat.label}</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            {student.semesterHistory && student.semesterHistory.length > 0 && (
              <div className="border border-slate-200 rounded-xl p-4 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <span>Multi-Semester Attendance & Placement Readiness Trajectory</span>
                  </div>
                  <span className="text-xs text-slate-500">0–100 Normalized Scale</span>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={student.semesterHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="sem" tick={{ fontSize: 12 }} />
                      <YAxis domain={[30, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="attendance"
                        name="Attendance %"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="placementIndex"
                        name="Placement Readiness"
                        stroke="#7c3aed"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </section>

          {/* Section 4: Recommended Interventions & Action Status */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  04. Rule-Based Intervention Plan & Status Tracking
                </h3>
                <p className="text-xs text-slate-500">
                  Targeted interventions derived from indicator deficits.{' '}
                  {canModifyInterventions
                    ? 'Update status or add faculty mentoring notes below.'
                    : 'View your assigned faculty support plan below.'}
                </p>
              </div>
              {canModifyInterventions && (
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Custom Intervention</span>
                </button>
              )}
            </div>

            {showAddForm && canModifyInterventions && (
              <form
                onSubmit={handleCreateIntervention}
                className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3"
              >
                <div className="text-xs font-bold text-slate-900">
                  Create Custom Faculty Intervention for {student.name}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Category
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as InterventionCategory)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2"
                    >
                      <option value="Remedial Classes">Remedial Classes</option>
                      <option value="Attendance Follow-Up">Attendance Follow-Up</option>
                      <option value="Coding Practice">Coding Practice</option>
                      <option value="Aptitude Training">Aptitude Training</option>
                      <option value="Communication & Mock Interviews">
                        Communication & Mock Interviews
                      </option>
                      <option value="LMS & Assignment Engagement">
                        LMS & Assignment Engagement
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Priority Level
                    </label>
                    <select
                      value={newPriority}
                      onChange={(e) =>
                        setNewPriority(e.target.value as 'High' | 'Medium' | 'Standard')
                      }
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2"
                    >
                      <option value="High">High Priority</option>
                      <option value="Medium">Medium Priority</option>
                      <option value="Standard">Standard Priority</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Intervention Title
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., Weekly Data Structures Remedial Mentoring"
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Recommended Action Plan
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={newAction}
                    onChange={(e) => setNewAction(e.target.value)}
                    placeholder="Specify concrete milestones and follow-up schedule..."
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    Save Intervention
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {student.interventions.map((item: InterventionItem) => (
                <div
                  key={item.id}
                  className="border border-slate-200 rounded-xl p-4 bg-white space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-medium text-blue-700">{item.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>Priority: {item.priority}</span>
                        <span aria-hidden="true">·</span>
                        <span>Rule: {item.triggerRule}</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-0.5">{item.title}</h4>
                    </div>

                    {/* Interactive Status Segmented Control for Faculty/Admin, Read-Only Status for Student */}
                    {canModifyInterventions ? (
                      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
                        {(['Planned', 'In Progress', 'Completed'] as InterventionStatus[]).map(
                          (st) => (
                            <button
                              key={st}
                              onClick={() =>
                                onUpdateInterventionStatus(item.id, st, item.notes)
                              }
                              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                                item.status === st
                                  ? st === 'Completed'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : st === 'In Progress'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-white text-slate-900 shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {st}
                            </button>
                          )
                        )}
                      </div>
                    ) : (
                      <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        <span>Status: {item.status}</span>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-slate-600">
                    <strong className="text-slate-800">Diagnostic Reason:</strong> {item.reason}
                  </p>
                  <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                    <strong className="text-slate-900">Recommended Action:</strong>{' '}
                    {item.recommendedAction}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500">
                    <div>
                      Assigned Mentor: <span className="text-slate-700">{item.assignedTo}</span> ·
                      Last Updated: <span className="font-mono">{item.updatedAt}</span>
                    </div>
                    {canModifyInterventions && (
                      <button
                        onClick={() => {
                          if (editingNotesId === item.id) {
                            setEditingNotesId(null);
                          } else {
                            setEditingNotesId(item.id);
                            setNoteDraft(item.notes || '');
                          }
                        }}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {item.notes ? 'Edit Advisor Note' : '+ Add Advisor Note'}
                      </button>
                    )}
                  </div>

                  {item.notes && editingNotesId !== item.id && (
                    <div className="text-xs text-slate-700 bg-blue-50/50 border border-blue-200 rounded-lg p-2.5">
                      <span className="font-semibold text-blue-950">Faculty Note: </span>
                      {item.notes}
                    </div>
                  )}

                  {editingNotesId === item.id && (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Enter faculty follow-up note or milestone date..."
                        className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5"
                      />
                      <button
                        onClick={() => {
                          onUpdateInterventionStatus(item.id, item.status, noteDraft);
                          setEditingNotesId(null);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 inline-flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Save</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Section 5: Backend Gemini AI Performance Analysis & Learning Plan */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  05. Gemini AI Contextual Analysis & Study Plan (Server-Side FastAPI)
                </h3>
                <p className="text-xs text-slate-500">
                  Calls <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">POST /api/ai/recommendations</code> on the Python FastAPI backend using server-side <code className="font-mono">GEMINI_API_KEY</code>.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRequestBackendAi}
                disabled={isLoadingAi}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAi ? 'animate-spin' : ''}`} />
                <span>
                  {isLoadingAi
                    ? 'Requesting Gemini Analysis...'
                    : aiRecommendation
                    ? 'Regenerate AI Analysis'
                    : 'Generate AI Study Plan via FastAPI'}
                </span>
              </button>
            </div>

            {aiError && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="font-bold">Backend AI Request Notice</div>
                <div>{aiError}</div>
              </div>
            )}

            {aiRecommendation && (
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 text-slate-500 font-mono">
                  <span>Model: {aiRecommendation.modelUsed}</span>
                  <span>Generated: {aiRecommendation.generatedAt}</span>
                </div>

                <div>
                  <div className="font-bold text-slate-900 mb-1">Executive Summary</div>
                  <p className="text-slate-700 leading-relaxed">
                    {aiRecommendation.executiveSummary}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1">
                    <div className="font-bold text-slate-900">Academic Analysis</div>
                    <p className="text-slate-600 leading-relaxed">
                      {aiRecommendation.academicAnalysis}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1">
                    <div className="font-bold text-slate-900">Placement Readiness Analysis</div>
                    <p className="text-slate-600 leading-relaxed">
                      {aiRecommendation.placementAnalysis}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5">
                    <div className="font-bold text-slate-900">Prioritized Action Steps</div>
                    <ul className="list-disc list-inside space-y-1 text-slate-700">
                      {aiRecommendation.prioritizedActions.map((act, i) => (
                        <li key={i}>{act}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5">
                    <div className="font-bold text-slate-900">Recommended Weekly Study Plan</div>
                    <ul className="list-disc list-inside space-y-1 text-slate-700">
                      {aiRecommendation.weeklyStudyPlan.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
