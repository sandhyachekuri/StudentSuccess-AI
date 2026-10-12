import React, { useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  Briefcase,
  Target,
  ShieldCheck,
  TrendingUp,
  RotateCcw,
  UserCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Mail,
  ChevronRight,
  Sparkles,
  BarChart3,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  Cell,
  Legend,
} from 'recharts';
import { EnrichedStudent, FacultyMember } from '../types/student';
import {
  assessAcademicRisk,
  assessPlacementRisk,
  calculateStudentSuccessScore,
} from '../engine/analyticsEngine';
import { RiskLevelIndicator } from './StudentProfileModal';

interface StudentDashboardViewProps {
  student: EnrichedStudent;
  demoStudentOptions: EnrichedStudent[];
  onChangeActiveStudentId: (studentId: string) => void;
  facultyList: FacultyMember[];
}

export const StudentDashboardView: React.FC<StudentDashboardViewProps> = ({
  student,
  facultyList,
}) => {
  // Interactive Goal / What-If Simulator state initialized from current student's indicators
  const [targetCgpa, setTargetCgpa] = useState(student.cgpa);
  const [targetBacklogs, setTargetBacklogs] = useState(student.backlogs);
  const [targetAttendance, setTargetAttendance] = useState(student.attendance);
  const [targetCoding, setTargetCoding] = useState(student.codingScore);
  const [targetAptitude, setTargetAptitude] = useState(student.aptitudeScore);
  const [targetCommunication, setTargetCommunication] = useState(student.communicationScore);
  const [targetInterview, setTargetInterview] = useState(student.mockInterviewScore);

  // Sync sliders when student changes
  React.useEffect(() => {
    setTargetCgpa(student.cgpa);
    setTargetBacklogs(student.backlogs);
    setTargetAttendance(student.attendance);
    setTargetCoding(student.codingScore);
    setTargetAptitude(student.aptitudeScore);
    setTargetCommunication(student.communicationScore);
    setTargetInterview(student.mockInterviewScore);
  }, [student]);

  const simulatedResult = useMemo(() => {
    const simulatedRecord = {
      ...student,
      cgpa: targetCgpa,
      backlogs: targetBacklogs,
      attendance: targetAttendance,
      codingScore: targetCoding,
      aptitudeScore: targetAptitude,
      communicationScore: targetCommunication,
      mockInterviewScore: targetInterview,
    };
    const score = calculateStudentSuccessScore(simulatedRecord);
    const academicRisk = assessAcademicRisk(simulatedRecord);
    const placementRisk = assessPlacementRisk(simulatedRecord);
    const delta = Number((score.overallScore - student.scoreBreakdown.overallScore).toFixed(1));
    return { score, academicRisk, placementRisk, delta };
  }, [
    student,
    targetCgpa,
    targetBacklogs,
    targetAttendance,
    targetCoding,
    targetAptitude,
    targetCommunication,
    targetInterview,
  ]);

  const mentor = facultyList.find((f) => f.id === student.assignedFacultyId);

  // Competency marks & skill scores
  const skillComparisonData = [
    { name: 'Coding Skills', score: student.codingScore, benchmark: 70, fill: '#2563eb' },
    { name: 'Aptitude Tests', score: student.aptitudeScore, benchmark: 70, fill: '#4f46e5' },
    { name: 'Communication', score: student.communicationScore, benchmark: 70, fill: '#7c3aed' },
    { name: 'Mock Interview', score: student.mockInterviewScore, benchmark: 70, fill: '#0891b2' },
    { name: 'Technical Skills', score: student.technicalSkillScore, benchmark: 70, fill: '#0d9488' },
    { name: 'Extracurriculars', score: student.extracurricularScore, benchmark: 65, fill: '#059669' },
  ];

  // Semester progression history
  const semesterTrendData = useMemo(() => {
    if (student.semesterHistory && student.semesterHistory.length > 0) {
      return student.semesterHistory.map((s) => ({
        semester: s.sem,
        SGPA: s.sgpa,
        Attendance: s.attendance,
        PlacementScore: s.placementIndex,
      }));
    }
    return [
      { semester: 'Sem 1', SGPA: Number((student.cgpa - 0.2).toFixed(2)), Attendance: student.attendance + 2, PlacementScore: 60 },
      { semester: 'Sem 2', SGPA: Number((student.cgpa - 0.1).toFixed(2)), Attendance: student.attendance + 1, PlacementScore: 65 },
      { semester: 'Sem 3', SGPA: student.cgpa, Attendance: student.attendance, PlacementScore: student.scoreBreakdown.components.placementReadiness },
      { semester: 'Current', SGPA: student.cgpa, Attendance: student.attendance, PlacementScore: student.scoreBreakdown.components.placementReadiness },
    ];
  }, [student]);

  const resetSimulator = () => {
    setTargetCgpa(student.cgpa);
    setTargetBacklogs(student.backlogs);
    setTargetAttendance(student.attendance);
    setTargetCoding(student.codingScore);
    setTargetAptitude(student.aptitudeScore);
    setTargetCommunication(student.communicationScore);
    setTargetInterview(student.mockInterviewScore);
  };

  const isAttendanceCompliant = student.attendance >= 75;

  return (
    <div className="space-y-6">
      {/* 1. Student Identity Header & Privacy Boundary */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Authenticated Student Portal · Isolated to Your Academic Profile</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back, {student.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono">
            <span className="font-bold text-slate-800">{student.studentId}</span>
            <span aria-hidden="true">·</span>
            <span>{student.department}</span>
            <span aria-hidden="true">·</span>
            <span>Year {student.academicYear} (B.Tech)</span>
            <span aria-hidden="true">·</span>
            <span>
              Academic Advisor: {mentor ? `${mentor.name}` : student.assignedFacultyId}
            </span>
          </div>
        </div>

        {/* Academic Status Badge */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3 shrink-0">
          <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-mono font-bold text-base shrink-0">
            {student.cgpa.toFixed(1)}
          </div>
          <div className="text-xs">
            <div className="font-semibold text-slate-900">Current CGPA (0–10)</div>
            <div className="text-slate-500">
              {student.backlogs === 0 ? (
                <span className="text-emerald-600 font-medium">Clear Standing (0 Backlogs)</span>
              ) : (
                <span className="text-amber-600 font-medium">{student.backlogs} Backlog(s) to clear</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Personalized Academic Insights Overview (4 KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Success Score */}
        <div className="bg-white border border-slate-200 rounded-xl p-4.5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">Personal Success Score</span>
            <Award className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold font-mono tabular-nums text-blue-600">
              {student.scoreBreakdown.overallScore.toFixed(1)}
              <span className="text-xs font-normal text-slate-400"> / 100</span>
            </span>
            <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
              {student.segment.label}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 line-clamp-2">
            {student.scoreBreakdown.explanation}
          </p>
        </div>

        {/* CGPA & Academic Standing */}
        <div className="bg-white border border-slate-200 rounded-xl p-4.5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">Academic Marks (CGPA)</span>
            <BookOpen className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {student.cgpa.toFixed(2)}
              <span className="text-xs font-normal text-slate-400"> / 10.0</span>
            </span>
            <RiskLevelIndicator level={student.academicRisk.level} />
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>Coursework Status:</span>
            <span className={`font-semibold ${student.backlogs === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {student.backlogs === 0 ? 'Regular / No Backlogs' : `${student.backlogs} Active Backlog(s)`}
            </span>
          </div>
        </div>

        {/* Attendance Compliance */}
        <div className="bg-white border border-slate-200 rounded-xl p-4.5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">Attendance & LMS Compliance</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span
              className={`text-3xl font-bold font-mono tabular-nums ${
                isAttendanceCompliant ? 'text-emerald-600' : 'text-amber-600'
              }`}
            >
              {student.attendance}%
            </span>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                isAttendanceCompliant
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {isAttendanceCompliant ? 'Statutory Compliant (&ge;75%)' : 'Below 75% Norm'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>LMS Portal Engagement:</span>
            <span className="font-mono font-semibold text-slate-700">
              {student.lmsActivity}/100 ({student.assignmentCompletion}% tasks)
            </span>
          </div>
        </div>

        {/* Placement Readiness */}
        <div className="bg-white border border-slate-200 rounded-xl p-4.5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">Placement Readiness</span>
            <Briefcase className="w-4 h-4 text-violet-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold font-mono tabular-nums text-violet-600">
              {student.scoreBreakdown.components.placementReadiness.toFixed(1)}
              <span className="text-xs font-normal text-slate-400"> / 100</span>
            </span>
            <RiskLevelIndicator level={student.placementRisk.level} />
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>Interview Readiness:</span>
            <span className="font-mono font-semibold text-slate-700">
              Mock Drill: {student.mockInterviewScore}/100
            </span>
          </div>
        </div>
      </div>

      {/* 3. Multi-Semester SGPA Trajectory & Attendance Tracking */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Semester Progression Chart */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Academic & Attendance Multi-Semester Trajectory
              </h2>
              <p className="text-xs text-slate-500">
                Your SGPA progression and attendance percentage across semesters
              </p>
            </div>
            <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
              Semester History
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={semesterTrendData} margin={{ top: 10, right: 20, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="semester" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="sgpa" domain={[4, 10]} tick={{ fontSize: 11 }} label={{ value: 'SGPA', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                <YAxis yAxisId="att" orientation="right" domain={[40, 100]} tick={{ fontSize: 11 }} label={{ value: 'Att %', angle: 90, position: 'insideRight', fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line yAxisId="sgpa" type="monotone" dataKey="SGPA" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} name="SGPA (0–10)" />
                <Line yAxisId="att" type="monotone" dataKey="Attendance" stroke="#059669" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 3 }} name="Attendance %" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
            <div className="bg-slate-50 p-2.5 rounded-lg text-center">
              <span className="text-slate-500 block text-[11px]">Cumulative CGPA</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{student.cgpa.toFixed(2)}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg text-center">
              <span className="text-slate-500 block text-[11px]">Attendance Trend</span>
              <span className={`font-mono font-bold text-sm ${student.attendance >= 75 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {student.attendance}%
              </span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg text-center">
              <span className="text-slate-500 block text-[11px]">Placement Index</span>
              <span className="font-mono font-bold text-violet-600 text-sm">
                {student.scoreBreakdown.components.placementReadiness.toFixed(1)}/100
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Competency Marks Breakdown */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Skills & Assessment Marks
              </h2>
              <p className="text-xs text-slate-500">
                Placement & domain competencies (70+ recommended for campus drives)
              </p>
            </div>
            <RiskLevelIndicator level={student.placementRisk.level} />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={skillComparisonData} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={105} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="score" name="Your Score" radius={[0, 4, 4, 0]}>
                  {skillComparisonData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        entry.score < 50
                          ? '#dc2626'
                          : entry.score < 65
                          ? '#d97706'
                          : entry.fill
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center justify-between">
            <span>Placement Readiness Target:</span>
            <span className="font-semibold text-slate-800">
              {student.scoreBreakdown.components.placementReadiness >= 70 ? 'Tier-1 Eligible' : 'Target: 70+ in Coding & Aptitude'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Personal Risk Status & Actionable Diagnostic Insights */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Personal Risk Assessment & Diagnostic Factors
            </h2>
            <p className="text-xs text-slate-500">
              Transparent review of academic compliance and career placement readiness factors
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Overall Status:</span>
            <span className="text-xs font-semibold text-slate-800">
              {student.academicRisk.level === 'High Risk' || student.placementRisk.level === 'High Risk'
                ? 'Action Required'
                : 'On Track'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Academic Risk Diagnostic */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900">Academic Standing Diagnostic</h3>
              </div>
              <RiskLevelIndicator level={student.academicRisk.level} />
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {student.academicRisk.summaryExplanation}
            </p>

            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-semibold text-slate-700">Observed Indicators:</div>
              {student.academicRisk.factors.length > 0 ? (
                student.academicRisk.factors.map((f, i) => (
                  <div
                    key={i}
                    className="text-xs p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2"
                  >
                    <span className="text-slate-800 font-medium">{f.indicator}</span>
                    <span className="font-mono text-slate-600">
                      Observed: <strong>{f.observedValue}</strong>
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs p-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>All academic indicators (CGPA, attendance, backlogs) are fully within good standing.</span>
                </div>
              )}
            </div>
          </div>

          {/* Placement Risk Diagnostic */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-violet-600" />
                <h3 className="text-xs font-bold text-slate-900">Placement Competency Diagnostic</h3>
              </div>
              <RiskLevelIndicator level={student.placementRisk.level} />
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {student.placementRisk.summaryExplanation}
            </p>

            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-semibold text-slate-700">Observed Indicators:</div>
              {student.placementRisk.factors.length > 0 ? (
                student.placementRisk.factors.map((f, i) => (
                  <div
                    key={i}
                    className="text-xs p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2"
                  >
                    <span className="text-slate-800 font-medium">{f.indicator}</span>
                    <span className="font-mono text-slate-600">
                      Observed: <strong>{f.observedValue}</strong>
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs p-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Coding, aptitude, and communication scores meet top placement benchmarks.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Recommended Improvement Actions & Assigned Faculty Advisor Plan */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">
                Recommended Improvement Actions & Advisory Roadmap
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Targeted academic and skill interventions assigned to help you improve your GPA, clearance, and placement readiness
            </p>
          </div>

          {mentor && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-xs text-blue-900 flex items-center gap-2 shrink-0">
              <UserCheck className="w-4 h-4 text-blue-700" />
              <span>
                Faculty Mentor: <strong>{mentor.name}</strong> ({mentor.email})
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {student.interventions.map((item) => (
            <div
              key={item.id}
              className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-2.5 flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                    {item.category}
                  </span>
                  <span
                    className={`font-semibold text-[11px] px-2 py-0.5 rounded-full ${
                      item.status === 'Completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'In Progress'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    Status: {item.status}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                <p className="text-xs text-slate-600">{item.reason}</p>
                <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 space-y-1">
                  <div className="font-semibold text-slate-900">Action Plan:</div>
                  <div className="text-slate-700">{item.recommendedAction}</div>
                </div>
              </div>

              {item.notes && (
                <div className="text-xs text-blue-950 bg-blue-50/80 border border-blue-200 rounded-lg p-2.5 mt-2">
                  <strong>Advisor Feedback:</strong> {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 6. Interactive Goal Simulator ("What-If" Improvement Planner) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">
                Interactive Goal Simulator (&ldquo;What-If&rdquo; Improvement Planner)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Simulate how raising attendance, clearing backlogs, or scoring higher in coding improves your Student Success Score and reduces risk.
            </p>
          </div>
          <button
            onClick={resetSimulator}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors self-start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Current Records</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Sliders */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <label htmlFor="sim-cgpa" className="font-medium text-slate-700">
                  Target CGPA
                </label>
                <span className="font-mono font-bold text-slate-900">
                  {targetCgpa.toFixed(1)} / 10.0
                </span>
              </div>
              <input
                id="sim-cgpa"
                type="range"
                min={4.5}
                max={10.0}
                step={0.1}
                value={targetCgpa}
                onChange={(e) => setTargetCgpa(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <label htmlFor="sim-backlogs" className="font-medium text-slate-700">
                  Remaining Backlogs
                </label>
                <span className="font-mono font-bold text-slate-900">{targetBacklogs}</span>
              </div>
              <input
                id="sim-backlogs"
                type="range"
                min={0}
                max={5}
                step={1}
                value={targetBacklogs}
                onChange={(e) => setTargetBacklogs(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <label htmlFor="sim-attendance" className="font-medium text-slate-700">
                  Target Attendance %
                </label>
                <span className="font-mono font-bold text-slate-900">
                  {targetAttendance}%
                </span>
              </div>
              <input
                id="sim-attendance"
                type="range"
                min={50}
                max={100}
                step={1}
                value={targetAttendance}
                onChange={(e) => setTargetAttendance(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <label htmlFor="sim-coding" className="font-medium text-slate-700">
                  Target Coding Score
                </label>
                <span className="font-mono font-bold text-slate-900">
                  {targetCoding} / 100
                </span>
              </div>
              <input
                id="sim-coding"
                type="range"
                min={25}
                max={100}
                step={1}
                value={targetCoding}
                onChange={(e) => setTargetCoding(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <label htmlFor="sim-aptitude" className="font-medium text-slate-700">
                  Target Aptitude Score
                </label>
                <span className="font-mono font-bold text-slate-900">
                  {targetAptitude} / 100
                </span>
              </div>
              <input
                id="sim-aptitude"
                type="range"
                min={25}
                max={100}
                step={1}
                value={targetAptitude}
                onChange={(e) => setTargetAptitude(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <label htmlFor="sim-interview" className="font-medium text-slate-700">
                  Target Mock Interview
                </label>
                <span className="font-mono font-bold text-slate-900">
                  {targetInterview} / 100
                </span>
              </div>
              <input
                id="sim-interview"
                type="range"
                min={25}
                max={100}
                step={1}
                value={targetInterview}
                onChange={(e) => setTargetInterview(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Simulated Outcome Card */}
          <div className="lg:col-span-5 bg-slate-900 text-white rounded-xl p-5 space-y-4 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">Simulated Student Success Score</span>
              <span
                className={`text-xs font-mono font-bold ${
                  simulatedResult.delta > 0
                    ? 'text-emerald-400'
                    : simulatedResult.delta < 0
                    ? 'text-red-400'
                    : 'text-slate-400'
                }`}
              >
                {simulatedResult.delta >= 0 ? `+${simulatedResult.delta}` : simulatedResult.delta}{' '}
                pts projected change
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold font-mono tabular-nums text-white">
                {simulatedResult.score.overallScore.toFixed(1)}
              </span>
              <span className="text-sm text-slate-400">
                / 100 (Current: {student.scoreBreakdown.overallScore.toFixed(1)})
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800 text-xs">
              <div className="bg-slate-800/80 rounded-lg p-2.5">
                <div className="text-slate-400 mb-1">Projected Academic Risk</div>
                <div className="font-semibold text-white">
                  {simulatedResult.academicRisk.level}
                </div>
              </div>
              <div className="bg-slate-800/80 rounded-lg p-2.5">
                <div className="text-slate-400 mb-1">Projected Placement Risk</div>
                <div className="font-semibold text-white">
                  {simulatedResult.placementRisk.level}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
