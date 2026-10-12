import React, { useMemo, useState } from 'react';
import {
  Users,
  Award,
  AlertOctagon,
  Briefcase,
  Upload,
  UserCheck,
  ShieldCheck,
  ChevronRight,
  SlidersHorizontal,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  Department,
  EnrichedStudent,
  FacultyMember,
  InterventionStatus,
  RiskLevel,
  SegmentId,
  StudentRecord,
} from '../types/student';
import { DEPARTMENTS } from '../data/syntheticStudents';
import { SEGMENT_DEFINITIONS } from '../engine/analyticsEngine';
import { RiskLevelIndicator } from './StudentProfileModal';
import { AdminUserManagementPanel } from './AdminUserManagementPanel';

interface AdminDashboardViewProps {
  students: EnrichedStudent[];
  facultyList: FacultyMember[];
  onSelectStudent: (student: EnrichedStudent) => void;
  onNavigateToDirectoryWithFilter: (opts: {
    segment?: SegmentId | 'ALL';
    department?: Department | 'ALL';
    academicRisk?: RiskLevel | 'ALL';
    placementRisk?: RiskLevel | 'ALL';
  }) => void;
  onNavigateToImport: () => void;
  onAssignFaculty: (studentId: string, facultyId: string) => void;
  onUpdateInterventionStatus: (
    interventionId: string,
    status: InterventionStatus,
    notes?: string
  ) => void;
  apiBaseUrl?: string;
  onCohortDataSynced?: (
    dbStudents: StudentRecord[],
    dbFaculty: FacultyMember[]
  ) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  students,
  facultyList,
  onSelectStudent,
  onNavigateToDirectoryWithFilter,
  onNavigateToImport,
  onAssignFaculty,
  onUpdateInterventionStatus,
  apiBaseUrl,
  onCohortDataSynced,
}) => {
  const [selectedDept, setSelectedDept] = useState<Department | 'ALL'>('ALL');
  const [selectedYear, setSelectedYear] = useState<number | 'ALL'>('ALL');
  const [activeAdminSection, setActiveAdminSection] = useState<
    'analytics' | 'interventions' | 'users'
  >('analytics');

  // Slice active dataset by global dashboard filters so every KPI and chart updates consistently
  const activeCohort = useMemo(() => {
    return students.filter((s) => {
      if (selectedDept !== 'ALL' && s.department !== selectedDept) return false;
      if (selectedYear !== 'ALL' && s.academicYear !== selectedYear) return false;
      return true;
    });
  }, [students, selectedDept, selectedYear]);

  // 1. College-Wide KPIs
  const kpis = useMemo(() => {
    const total = activeCohort.length;
    if (total === 0) {
      return {
        total: 0,
        avgScore: 0,
        avgCgpa: 0,
        avgAttendance: 0,
        academicHighRisk: 0,
        academicMediumRisk: 0,
        placementHighRisk: 0,
        placementMediumRisk: 0,
        totalInterventions: 0,
        completedInterventions: 0,
        inProgressInterventions: 0,
      };
    }

    const sumScore = activeCohort.reduce((acc, s) => acc + s.scoreBreakdown.overallScore, 0);
    const sumCgpa = activeCohort.reduce((acc, s) => acc + s.cgpa, 0);
    const sumAtt = activeCohort.reduce((acc, s) => acc + s.attendance, 0);

    const academicHighRisk = activeCohort.filter(
      (s) => s.academicRisk.level === 'High Risk'
    ).length;
    const academicMediumRisk = activeCohort.filter(
      (s) => s.academicRisk.level === 'Medium Risk'
    ).length;
    const placementHighRisk = activeCohort.filter(
      (s) => s.placementRisk.level === 'High Risk'
    ).length;
    const placementMediumRisk = activeCohort.filter(
      (s) => s.placementRisk.level === 'Medium Risk'
    ).length;

    const allInterventions = activeCohort.flatMap((s) => s.interventions);

    return {
      total,
      avgScore: Number((sumScore / total).toFixed(1)),
      avgCgpa: Number((sumCgpa / total).toFixed(2)),
      avgAttendance: Number((sumAtt / total).toFixed(1)),
      academicHighRisk,
      academicMediumRisk,
      placementHighRisk,
      placementMediumRisk,
      totalInterventions: allInterventions.length,
      completedInterventions: allInterventions.filter((i) => i.status === 'Completed').length,
      inProgressInterventions: allInterventions.filter((i) => i.status === 'In Progress').length,
    };
  }, [activeCohort]);

  // Chart 1: Academic Performance (CGPA) Distribution
  const academicDistributionData = useMemo(() => {
    const brackets = [
      { range: '< 6.0 (Critical)', min: 0, max: 5.99, count: 0, fill: '#dc2626' },
      { range: '6.0–6.9 (Warning)', min: 6.0, max: 6.99, count: 0, fill: '#d97706' },
      { range: '7.0–7.9 (Good)', min: 7.0, max: 7.99, count: 0, fill: '#2563eb' },
      { range: '8.0–8.9 (Strong)', min: 8.0, max: 8.99, count: 0, fill: '#4f46e5' },
      { range: '9.0–10.0 (Distinction)', min: 9.0, max: 10.0, count: 0, fill: '#059669' },
    ];
    activeCohort.forEach((s) => {
      const b = brackets.find((br) => s.cgpa >= br.min && s.cgpa <= br.max);
      if (b) b.count += 1;
    });
    return brackets;
  }, [activeCohort]);

  // Chart 2: Attendance Distribution
  const attendanceDistributionData = useMemo(() => {
    const brackets = [
      { range: '< 65% (Critical)', min: 0, max: 64.99, count: 0, fill: '#dc2626' },
      { range: '65–74% (Below Norm)', min: 65, max: 74.99, count: 0, fill: '#d97706' },
      { range: '75–84% (Compliant)', min: 75, max: 84.99, count: 0, fill: '#2563eb' },
      { range: '85–100% (Exemplary)', min: 85, max: 100, count: 0, fill: '#059669' },
    ];
    activeCohort.forEach((s) => {
      const b = brackets.find((br) => s.attendance >= br.min && s.attendance <= br.max);
      if (b) b.count += 1;
    });
    return brackets;
  }, [activeCohort]);

  // Chart 3: Placement Readiness Distribution
  const placementDistributionData = useMemo(() => {
    const brackets = [
      { range: '< 50 (High Risk)', min: 0, max: 49.99, count: 0, fill: '#dc2626' },
      { range: '50–64 (Needs Prep)', min: 50, max: 64.99, count: 0, fill: '#d97706' },
      { range: '65–79 (Career Ready)', min: 65, max: 79.99, count: 0, fill: '#7c3aed' },
      { range: '80–100 (Tier-1 Ready)', min: 80, max: 100, count: 0, fill: '#059669' },
    ];
    activeCohort.forEach((s) => {
      const score = s.scoreBreakdown.components.placementReadiness;
      const b = brackets.find((br) => score >= br.min && score <= br.max);
      if (b) b.count += 1;
    });
    return brackets;
  }, [activeCohort]);

  // Chart 4: Dual Risk Distribution (Academic vs Placement Risk)
  const riskComparisonData = useMemo(() => {
    const levels: RiskLevel[] = ['High Risk', 'Medium Risk', 'Low Risk'];
    return levels.map((lvl) => ({
      level: lvl,
      AcademicRisk: activeCohort.filter((s) => s.academicRisk.level === lvl).length,
      PlacementRisk: activeCohort.filter((s) => s.placementRisk.level === lvl).length,
    }));
  }, [activeCohort]);

  // Chart 5: Department Comparisons
  const departmentComparisonData = useMemo(() => {
    return DEPARTMENTS.map((dept) => {
      const deptStudents = students.filter(
        (s) =>
          s.department === dept &&
          (selectedYear === 'ALL' || s.academicYear === selectedYear)
      );
      const count = deptStudents.length || 1;
      const avgSuccess =
        deptStudents.reduce((acc, s) => acc + s.scoreBreakdown.overallScore, 0) / count;
      const avgAcademic =
        deptStudents.reduce((acc, s) => acc + s.scoreBreakdown.components.academicPerformance, 0) /
        count;
      const avgPlacement =
        deptStudents.reduce((acc, s) => acc + s.scoreBreakdown.components.placementReadiness, 0) /
        count;
      const avgAttendance =
        deptStudents.reduce((acc, s) => acc + s.attendance, 0) / count;

      return {
        shortDept:
          dept === 'Computer Science & Engineering'
            ? 'CSE'
            : dept === 'Data Science & AI'
            ? 'DS & AI'
            : dept === 'Electronics & Communication'
            ? 'ECE'
            : dept === 'Information Technology'
            ? 'IT'
            : 'Mech',
        fullDept: dept,
        studentCount: deptStudents.length,
        SuccessScore: Number(avgSuccess.toFixed(1)),
        AcademicScore: Number(avgAcademic.toFixed(1)),
        PlacementScore: Number(avgPlacement.toFixed(1)),
        Attendance: Number(avgAttendance.toFixed(1)),
      };
    });
  }, [students, selectedYear]);

  // Chart 6: Student Segmentation Data
  const segmentationChartData = useMemo(() => {
    return (Object.keys(SEGMENT_DEFINITIONS) as SegmentId[]).map((segId) => {
      const count = activeCohort.filter((s) => s.segment.id === segId).length;
      const pct = activeCohort.length > 0 ? Math.round((count / activeCohort.length) * 100) : 0;
      return {
        id: segId,
        label: SEGMENT_DEFINITIONS[segId].label,
        shortLabel:
          segId === 'balanced_high_performers'
            ? 'Balanced High'
            : segId === 'strong_academics_low_placement'
            ? 'Strong Acad / Low Plcmt'
            : segId === 'good_placement_weak_academics'
            ? 'Good Plcmt / Weak Acad'
            : segId === 'low_attendance_academic_concerns'
            ? 'Low Attendance & Acad'
            : segId === 'multi_indicator_support'
            ? 'Multi-Indicator Risk'
            : 'Steady Developing',
        count,
        pct,
        rule: SEGMENT_DEFINITIONS[segId].ruleSpecification,
      };
    });
  }, [activeCohort]);

  // Chart 7: Academic Performance vs Placement Readiness Scatter
  const scatterData = useMemo(() => {
    return activeCohort.map((s) => ({
      studentId: s.studentId,
      name: s.name,
      academicScore: s.scoreBreakdown.components.academicPerformance,
      placementScore: s.scoreBreakdown.components.placementReadiness,
      overallScore: s.scoreBreakdown.overallScore,
      segment: s.segment.label,
      highRisk:
        s.academicRisk.level === 'High Risk' || s.placementRisk.level === 'High Risk',
    }));
  }, [activeCohort]);

  // Priority At-Risk Students list
  const atRiskStudents = useMemo(() => {
    return [...activeCohort]
      .filter(
        (s) =>
          s.academicRisk.level === 'High Risk' ||
          s.placementRisk.level === 'High Risk' ||
          s.scoreBreakdown.overallScore < 60
      )
      .sort((a, b) => a.scoreBreakdown.overallScore - b.scoreBreakdown.overallScore);
  }, [activeCohort]);

  return (
    <div className="space-y-6">
      {/* Top Executive Header & Cohort Slicers */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-blue-600">
            College Administration · Institutional Intelligence Console
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Smart Campus Student Success Overview
          </h1>
        </div>

        {/* Interactive Cohort Slicer + Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value as Department | 'ALL')}
              aria-label="Filter Dashboard by Department"
              className="text-xs font-medium text-slate-800 bg-transparent focus:outline-none"
            >
              <option value="ALL">All Departments ({students.length})</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <select
            value={selectedYear}
            onChange={(e) =>
              setSelectedYear(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
            }
            aria-label="Filter Dashboard by Academic Year"
            className="text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none"
          >
            <option value="ALL">All Academic Years</option>
            <option value={1}>Year 1 Cohort</option>
            <option value={2}>Year 2 Cohort</option>
            <option value={3}>Year 3 Cohort</option>
            <option value={4}>Year 4 (Graduating)</option>
          </select>

          <button
            onClick={onNavigateToImport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV Dataset</span>
          </button>
        </div>
      </div>

      {/* Executive KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Active Student Cohort</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {kpis.total}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Avg Attendance: {kpis.avgAttendance}%
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Avg Student Success Score</span>
            <Award className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-blue-600">
              {kpis.avgScore.toFixed(1)}
              <span className="text-xs font-normal text-slate-400"> / 100</span>
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Avg CGPA: {kpis.avgCgpa}
            </span>
          </div>
        </div>

        <button
          onClick={() =>
            onNavigateToDirectoryWithFilter({
              department: selectedDept,
              academicRisk: 'High Risk',
            })
          }
          className="text-left bg-white border border-slate-200 hover:border-red-300 rounded-xl p-4 flex flex-col justify-between transition-colors group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 w-full">
            <span>Academic High Risk</span>
            <AlertOctagon className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between w-full">
            <span className="text-2xl font-bold font-mono tabular-nums text-red-600">
              {kpis.academicHighRisk}
            </span>
            <span className="text-xs text-amber-700 font-mono">
              +{kpis.academicMediumRisk} Medium Risk →
            </span>
          </div>
        </button>

        <button
          onClick={() =>
            onNavigateToDirectoryWithFilter({
              department: selectedDept,
              placementRisk: 'High Risk',
            })
          }
          className="text-left bg-white border border-slate-200 hover:border-violet-300 rounded-xl p-4 flex flex-col justify-between transition-colors group"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 w-full">
            <span>Placement High Risk</span>
            <Briefcase className="w-4 h-4 text-violet-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between w-full">
            <span className="text-2xl font-bold font-mono tabular-nums text-violet-600">
              {kpis.placementHighRisk}
            </span>
            <span className="text-xs text-amber-700 font-mono">
              +{kpis.placementMediumRisk} Medium Risk →
            </span>
          </div>
        </button>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Active Interventions</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {kpis.totalInterventions}
            </span>
            <span className="text-xs text-emerald-700 font-mono">
              {kpis.completedInterventions} Done · {kpis.inProgressInterventions} Active
            </span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs within Admin Console */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl w-fit">
        <button
          onClick={() => setActiveAdminSection('analytics')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeAdminSection === 'analytics'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Campus Analytics & At-Risk Overview
        </button>
        <button
          onClick={() => setActiveAdminSection('interventions')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeAdminSection === 'interventions'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Faculty Assignment & Intervention Monitoring ({kpis.totalInterventions})
        </button>
        <button
          onClick={() => setActiveAdminSection('users')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeAdminSection === 'users'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          User & Role Governance (Firebase Ready)
        </button>
      </div>

      {activeAdminSection === 'analytics' && (
        <div className="space-y-6">
          {/* Row 1: Department Comparison + Independent Risk Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Department-Wise Performance Comparisons
                  </h2>
                  <p className="text-xs text-slate-500">
                    Average Student Success Score, Academic Component, and Placement Readiness by Department
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-400">0–100 Scale</span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="shortDept" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar
                      dataKey="SuccessScore"
                      name="Avg Success Score"
                      fill="#1e293b"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="AcademicScore"
                      name="Academic Score"
                      fill="#2563eb"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="PlacementScore"
                      name="Placement Readiness"
                      fill="#7c3aed"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Separate Academic vs. Placement Risk Distribution
                </h2>
                <p className="text-xs text-slate-500">
                  Independent risk assessments across the active {kpis.total}-student cohort
                </p>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={riskComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="level" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar
                      dataKey="AcademicRisk"
                      name="Academic Risk Count"
                      fill="#2563eb"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="PlacementRisk"
                      name="Placement Risk Count"
                      fill="#7c3aed"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 2: Three Pillar Distributions (Academics, Attendance, Placement Readiness) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Academic Performance Distribution */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Academic Performance (CGPA) Distribution
                </h2>
                <p className="text-xs text-slate-500">
                  Student count across CGPA risk and merit brackets
                </p>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={academicDistributionData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="range"
                      width={118}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip />
                    <Bar dataKey="count" name="Students" radius={[0, 4, 4, 0]}>
                      {academicDistributionData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Attendance Distribution */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Attendance Compliance Distribution
                </h2>
                <p className="text-xs text-slate-500">
                  75% is the mandatory institutional attendance threshold
                </p>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceDistributionData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="range"
                      width={118}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip />
                    <Bar dataKey="count" name="Students" radius={[0, 4, 4, 0]}>
                      {attendanceDistributionData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Placement Readiness Distribution */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Placement Readiness Distribution
                </h2>
                <p className="text-xs text-slate-500">
                  Composite of Coding, Aptitude, Communication & Mock Interview
                </p>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={placementDistributionData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="range"
                      width={118}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip />
                    <Bar dataKey="count" name="Students" radius={[0, 4, 4, 0]}>
                      {placementDistributionData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 3: Academic Performance vs Placement Readiness Scatter + Student Segmentation */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Academic Performance vs. Placement Readiness Matrix
                  </h2>
                  <p className="text-xs text-slate-500">
                    Dashed reference lines at 70/100 divide the cohort into 4 actionable intervention quadrants
                  </p>
                </div>
                <span className="text-xs text-slate-500">
                  Red = High Risk · Blue = Moderate/Low Risk
                </span>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      type="number"
                      dataKey="academicScore"
                      name="Academic Score"
                      domain={[20, 100]}
                      tick={{ fontSize: 11 }}
                      label={{
                        value: 'Academic Performance Score (0–100)',
                        position: 'insideBottom',
                        offset: -5,
                        fontSize: 11,
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="placementScore"
                      name="Placement Readiness"
                      domain={[20, 100]}
                      tick={{ fontSize: 11 }}
                      label={{
                        value: 'Placement Readiness (0–100)',
                        angle: -90,
                        position: 'insideLeft',
                        fontSize: 11,
                      }}
                    />
                    <ZAxis type="number" dataKey="overallScore" range={[50, 140]} />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length > 0) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-lg space-y-1">
                              <div className="font-bold">
                                {data.name} ({data.studentId})
                              </div>
                              <div>Segment: {data.segment}</div>
                              <div className="font-mono">
                                Academic: {data.academicScore} · Placement: {data.placementScore} ·
                                Overall: {data.overallScore}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine x={70} stroke="#64748b" strokeDasharray="4 4" />
                    <ReferenceLine y={70} stroke="#64748b" strokeDasharray="4 4" />
                    <Scatter name="Students" data={scatterData}>
                      {scatterData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.highRisk ? '#dc2626' : '#2563eb'}
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Student Segmentation Breakdown
                </h2>
                <p className="text-xs text-slate-500">
                  Click any segment row to filter the Student Directory by that segment
                </p>
              </div>

              <div className="space-y-2.5">
                {segmentationChartData.map((seg) => (
                  <button
                    key={seg.id}
                    onClick={() =>
                      onNavigateToDirectoryWithFilter({
                        department: selectedDept,
                        segment: seg.id,
                      })
                    }
                    className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition-colors space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900">{seg.label}</span>
                      <span className="font-mono tabular-nums font-bold text-blue-600">
                        {seg.count} ({seg.pct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${Math.max(4, seg.pct)}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{seg.rule}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 4: At-Risk Student Priority Watchlist */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Priority At-Risk Student Watchlist ({atRiskStudents.length} Flagged)
                </h2>
                <p className="text-xs text-slate-500">
                  Students flagged with High Academic Risk, High Placement Risk, or Overall Score below 60. Click any student to view full diagnostic factors and assign interventions.
                </p>
              </div>
              <button
                onClick={() =>
                  onNavigateToDirectoryWithFilter({
                    department: selectedDept,
                  })
                }
                className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1 shrink-0"
              >
                <span>Open Full Student Directory</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3 text-right">Success Score</th>
                    <th className="py-3 px-3">Academic Risk & Primary Factor</th>
                    <th className="py-3 px-3">Placement Risk & Primary Factor</th>
                    <th className="py-3 px-3">Assigned Faculty Mentor</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {atRiskStudents.slice(0, 12).map((s) => {
                    const mentor = facultyList.find((f) => f.id === s.assignedFacultyId);
                    return (
                      <tr
                        key={s.studentId}
                        onClick={() => onSelectStudent(s)}
                        className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{s.name}</div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {s.studentId} · Year {s.academicYear}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600">{s.department}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                          {s.scoreBreakdown.overallScore.toFixed(1)}
                        </td>
                        <td className="py-3 px-3">
                          <RiskLevelIndicator level={s.academicRisk.level} />
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {s.academicRisk.factors[0]
                              ? `${s.academicRisk.factors[0].indicator} (${s.academicRisk.factors[0].observedValue})`
                              : 'Within threshold'}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <RiskLevelIndicator level={s.placementRisk.level} />
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {s.placementRisk.factors[0]
                              ? `${s.placementRisk.factors[0].indicator} (${s.placementRisk.factors[0].observedValue})`
                              : 'Within threshold'}
                          </div>
                        </td>
                        <td
                          className="py-3 px-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <select
                            value={s.assignedFacultyId}
                            onChange={(e) => onAssignFaculty(s.studentId, e.target.value)}
                            aria-label={`Assign mentor for ${s.name}`}
                            className="text-xs bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-slate-800"
                          >
                            {facultyList.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-xs font-medium text-blue-600 hover:underline">
                            Inspect & Intervene →
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeAdminSection === 'interventions' && (
        <div className="space-y-6">
          {/* Faculty Load & Intervention Progress Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Faculty Mentor Allocation & Intervention Completion Matrix
              </h2>
              <p className="text-xs text-slate-500">
                Monitor assigned mentee counts, high-risk caseloads, and intervention status across faculty advisors.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                    <th className="py-3 px-4">Faculty Advisor</th>
                    <th className="py-3 px-3">Department & Specialization</th>
                    <th className="py-3 px-3 text-right">Assigned Mentees</th>
                    <th className="py-3 px-3 text-right">Immediate Attention</th>
                    <th className="py-3 px-3 text-right">Planned</th>
                    <th className="py-3 px-3 text-right">In Progress</th>
                    <th className="py-3 px-4 text-right">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {facultyList.map((fac) => {
                    const mentees = students.filter((s) => s.assignedFacultyId === fac.id);
                    const highUrgency = mentees.filter((s) => s.requiresImmediateAttention).length;
                    const facInterventions = mentees.flatMap((s) => s.interventions);
                    const planned = facInterventions.filter((i) => i.status === 'Planned').length;
                    const inProg = facInterventions.filter(
                      (i) => i.status === 'In Progress'
                    ).length;
                    const completed = facInterventions.filter(
                      (i) => i.status === 'Completed'
                    ).length;

                    return (
                      <tr key={fac.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{fac.name}</div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {fac.id} · {fac.email}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-slate-800">{fac.department}</div>
                          <div className="text-[11px] text-slate-500">{fac.specialization}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold">
                          {mentees.length}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-red-600">
                          {highUrgency}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">
                          {planned}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-blue-600">
                          {inProg}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-600">
                          {completed}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Intervention Queue Across Active Cohort */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Institutional Intervention Queue (Session-Persisted Status Controls)
              </h2>
              <p className="text-xs text-slate-500">
                Authorized administrators and faculty can update intervention statuses directly below.
              </p>
            </div>

            <div className="space-y-2.5">
              {activeCohort
                .filter((s) => s.requiresImmediateAttention)
                .slice(0, 10)
                .map((student) => {
                  const primaryInt = student.interventions[0];
                  if (!primaryInt) return null;
                  return (
                    <div
                      key={primaryInt.id}
                      className="border border-slate-200 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <button
                            onClick={() => onSelectStudent(student)}
                            className="font-bold text-slate-900 hover:text-blue-600 hover:underline"
                          >
                            {student.name} ({student.studentId})
                          </button>
                          <span aria-hidden="true">·</span>
                          <span>{student.department}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-blue-700 font-medium">{primaryInt.category}</span>
                        </div>
                        <div className="text-xs font-semibold text-slate-800">
                          {primaryInt.title}:{' '}
                          <span className="font-normal text-slate-600">{primaryInt.reason}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                          {(['Planned', 'In Progress', 'Completed'] as InterventionStatus[]).map(
                            (st) => (
                              <button
                                key={st}
                                onClick={() =>
                                  onUpdateInterventionStatus(
                                    primaryInt.id,
                                    st,
                                    primaryInt.notes
                                  )
                                }
                                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                                  primaryInt.status === st
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
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {activeAdminSection === 'users' && (
        <AdminUserManagementPanel
          apiBaseUrl={apiBaseUrl}
          facultyList={facultyList}
          onCohortDataSynced={onCohortDataSynced}
        />
      )}
    </div>
  );
};
