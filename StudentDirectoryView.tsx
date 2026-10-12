import React, { useMemo, useState } from 'react';
import {
  Search,
  ArrowUpDown,
  RotateCcw,
  Download,
  ChevronRight,
  SlidersHorizontal,
  Info,
} from 'lucide-react';
import {
  Department,
  EnrichedStudent,
  FacultyMember,
  RiskLevel,
  SegmentId,
} from '../types/student';
import { DEPARTMENTS } from '../data/syntheticStudents';
import { SEGMENT_DEFINITIONS } from '../engine/analyticsEngine';
import { RiskLevelIndicator } from './StudentProfileModal';

interface StudentDirectoryViewProps {
  students: EnrichedStudent[];
  facultyList: FacultyMember[];
  onSelectStudent: (student: EnrichedStudent) => void;
  initialSegmentFilter?: SegmentId | 'ALL';
  initialDepartmentFilter?: Department | 'ALL';
  initialAcademicRiskFilter?: RiskLevel | 'ALL';
  initialPlacementRiskFilter?: RiskLevel | 'ALL';
}

type SortField = 'overallScore' | 'cgpa' | 'attendance' | 'placementReadiness' | 'studentId';
type SortOrder = 'asc' | 'desc';

export const StudentDirectoryView: React.FC<StudentDirectoryViewProps> = ({
  students,
  facultyList,
  onSelectStudent,
  initialSegmentFilter = 'ALL',
  initialDepartmentFilter = 'ALL',
  initialAcademicRiskFilter = 'ALL',
  initialPlacementRiskFilter = 'ALL',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<Department | 'ALL'>(
    initialDepartmentFilter
  );
  const [academicRiskFilter, setAcademicRiskFilter] = useState<RiskLevel | 'ALL'>(
    initialAcademicRiskFilter
  );
  const [placementRiskFilter, setPlacementRiskFilter] = useState<RiskLevel | 'ALL'>(
    initialPlacementRiskFilter
  );
  const [segmentFilter, setSegmentFilter] = useState<SegmentId | 'ALL'>(initialSegmentFilter);
  const [yearFilter, setYearFilter] = useState<number | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<SortField>('overallScore');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Sync external filter triggers if changed
  React.useEffect(() => {
    setSegmentFilter(initialSegmentFilter);
  }, [initialSegmentFilter]);

  React.useEffect(() => {
    setDepartmentFilter(initialDepartmentFilter);
  }, [initialDepartmentFilter]);

  React.useEffect(() => {
    setAcademicRiskFilter(initialAcademicRiskFilter);
  }, [initialAcademicRiskFilter]);

  React.useEffect(() => {
    setPlacementRiskFilter(initialPlacementRiskFilter);
  }, [initialPlacementRiskFilter]);

  const filteredAndSortedStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = students.filter((s) => {
      if (
        q &&
        !s.name.toLowerCase().includes(q) &&
        !s.studentId.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (departmentFilter !== 'ALL' && s.department !== departmentFilter) {
        return false;
      }
      if (academicRiskFilter !== 'ALL' && s.academicRisk.level !== academicRiskFilter) {
        return false;
      }
      if (placementRiskFilter !== 'ALL' && s.placementRisk.level !== placementRiskFilter) {
        return false;
      }
      if (segmentFilter !== 'ALL' && s.segment.id !== segmentFilter) {
        return false;
      }
      if (yearFilter !== 'ALL' && s.academicYear !== yearFilter) {
        return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      if (sortField === 'overallScore') {
        valA = a.scoreBreakdown.overallScore;
        valB = b.scoreBreakdown.overallScore;
      } else if (sortField === 'cgpa') {
        valA = a.cgpa;
        valB = b.cgpa;
      } else if (sortField === 'attendance') {
        valA = a.attendance;
        valB = b.attendance;
      } else if (sortField === 'placementReadiness') {
        valA = a.scoreBreakdown.components.placementReadiness;
        valB = b.scoreBreakdown.components.placementReadiness;
      } else {
        valA = a.studentId;
        valB = b.studentId;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [
    students,
    searchQuery,
    departmentFilter,
    academicRiskFilter,
    placementRiskFilter,
    segmentFilter,
    yearFilter,
    sortField,
    sortOrder,
  ]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setDepartmentFilter('ALL');
    setAcademicRiskFilter('ALL');
    setPlacementRiskFilter('ALL');
    setSegmentFilter('ALL');
    setYearFilter('ALL');
    setSortField('overallScore');
    setSortOrder('desc');
  };

  const exportFilteredToCSV = () => {
    const headers = [
      'Student ID',
      'Name',
      'Department',
      'Year',
      'Success Score',
      'CGPA',
      'Backlogs',
      'Attendance %',
      'Placement Readiness',
      'Academic Risk',
      'Placement Risk',
      'Segment',
    ];
    const rows = filteredAndSortedStudents.map((s) =>
      [
        s.studentId,
        `"${s.name}"`,
        `"${s.department}"`,
        s.academicYear,
        s.scoreBreakdown.overallScore.toFixed(1),
        s.cgpa.toFixed(2),
        s.backlogs,
        s.attendance,
        s.scoreBreakdown.components.placementReadiness.toFixed(1),
        s.academicRisk.level,
        s.placementRisk.level,
        `"${s.segment.label}"`,
      ].join(',')
    );
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'studentsuccess_filtered_directory.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const avgFilteredScore =
    filteredAndSortedStudents.length > 0
      ? (
          filteredAndSortedStudents.reduce(
            (acc, s) => acc + s.scoreBreakdown.overallScore,
            0
          ) / filteredAndSortedStudents.length
        ).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6">
      {/* Directory Header & Summary Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Student Directory & Cohort Segmentation
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Search, filter, and sort across all {students.length} student records. Click any row to inspect the full diagnostic profile and manage interventions.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
          <button
            onClick={exportFilteredToCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Filtered CSV ({filteredAndSortedStudents.length})</span>
          </button>
        </div>
      </div>

      {/* Interactive Segment Quick-Filter Cards with Explicit Rule Definitions */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Data-Derived Student Segments (Click to Filter Cohort)
            </h2>
            <p className="text-xs text-slate-500">
              Each student is deterministically assigned to a segment based on academic, attendance, and placement readiness thresholds.
            </p>
          </div>
          {segmentFilter !== 'ALL' && (
            <button
              onClick={() => setSegmentFilter('ALL')}
              className="text-xs font-medium text-blue-600 hover:underline self-start sm:self-auto"
            >
              Show All Segments ({students.length})
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(Object.keys(SEGMENT_DEFINITIONS) as SegmentId[]).map((segId) => {
            const def = SEGMENT_DEFINITIONS[segId];
            const count = students.filter((s) => s.segment.id === segId).length;
            const isActive = segmentFilter === segId;

            return (
              <button
                key={segId}
                onClick={() => setSegmentFilter(isActive ? 'ALL' : segId)}
                className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                  isActive
                    ? 'bg-blue-50/70 border-blue-600 ring-1 ring-blue-600'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="w-full flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900 leading-snug">
                    {def.label}
                  </span>
                  <span className="font-mono tabular-nums text-sm font-bold text-blue-600 shrink-0">
                    {count}
                  </span>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2">{def.shortDescription}</p>
                <div className="text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-200/80 w-full">
                  Rule: {def.ruleSpecification}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Multi-Criteria Search & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Student ID (STU-2026-001) or Name..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
          </div>

          {/* Department Filter */}
          <div className="md:col-span-3">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value as Department | 'ALL')}
              aria-label="Filter by Department"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="ALL">All Departments ({DEPARTMENTS.length})</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Academic Risk Filter */}
          <div className="md:col-span-2">
            <select
              value={academicRiskFilter}
              onChange={(e) => setAcademicRiskFilter(e.target.value as RiskLevel | 'ALL')}
              aria-label="Filter by Academic Risk"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="ALL">Academic Risk: All</option>
              <option value="High Risk">Academic: High Risk</option>
              <option value="Medium Risk">Academic: Medium Risk</option>
              <option value="Low Risk">Academic: Low Risk</option>
            </select>
          </div>

          {/* Placement Risk Filter */}
          <div className="md:col-span-2">
            <select
              value={placementRiskFilter}
              onChange={(e) => setPlacementRiskFilter(e.target.value as RiskLevel | 'ALL')}
              aria-label="Filter by Placement Risk"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="ALL">Placement Risk: All</option>
              <option value="High Risk">Placement: High Risk</option>
              <option value="Medium Risk">Placement: Medium Risk</option>
              <option value="Low Risk">Placement: Low Risk</option>
            </select>
          </div>

          {/* Academic Year Filter */}
          <div className="md:col-span-1">
            <select
              value={yearFilter}
              onChange={(e) =>
                setYearFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
              }
              aria-label="Filter by Academic Year"
              className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="ALL">All Yrs</option>
              <option value={1}>Yr 1</option>
              <option value={2}>Yr 2</option>
              <option value={3}>Yr 3</option>
              <option value={4}>Yr 4</option>
            </select>
          </div>
        </div>

        {/* Active Filter Context Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Showing <strong className="font-mono text-slate-900">{filteredAndSortedStudents.length}</strong> of{' '}
              <strong className="font-mono text-slate-900">{students.length}</strong> students
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Filtered Avg Success Score:{' '}
              <strong className="font-mono text-blue-600">{avgFilteredScore}</strong> / 100
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">Sort by:</span>
            {(
              [
                { id: 'overallScore', label: 'Success Score' },
                { id: 'cgpa', label: 'CGPA' },
                { id: 'attendance', label: 'Attendance' },
                { id: 'placementReadiness', label: 'Placement Readiness' },
                { id: 'studentId', label: 'Student ID' },
              ] as { id: SortField; label: string }[]
            ).map((btn) => (
              <button
                key={btn.id}
                onClick={() => handleSort(btn.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap inline-flex items-center gap-1 ${
                  sortField === btn.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{btn.label}</span>
                {sortField === btn.id && (
                  <span className="text-[10px] opacity-80">
                    {sortOrder === 'desc' ? '↓' : '↑'}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* High-Density Student Data Grid */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredAndSortedStudents.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Info className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-base font-bold text-slate-900">
              No Student Records Match Current Filters
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Try broadening your search query, selecting &ldquo;All Departments&rdquo;, or clearing the active risk and segment filters.
            </p>
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Directory Filters</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                  <th className="py-3 px-4">Student ID & Name</th>
                  <th className="py-3 px-3">Department & Yr</th>
                  <th className="py-3 px-3 text-right">
                    <button
                      onClick={() => handleSort('overallScore')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      <span>Success Score</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <button
                      onClick={() => handleSort('cgpa')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      <span>CGPA / Backlogs</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <button
                      onClick={() => handleSort('attendance')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      <span>Attendance</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <button
                      onClick={() => handleSort('placementReadiness')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      <span>Placement Score</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3">Academic Risk</th>
                  <th className="py-3 px-3">Placement Risk</th>
                  <th className="py-3 px-4">Assigned Segment</th>
                  <th className="py-3 px-3 text-right">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredAndSortedStudents.map((student) => {
                  const mentor = facultyList.find((f) => f.id === student.assignedFacultyId);
                  return (
                    <tr
                      key={student.studentId}
                      onClick={() => onSelectStudent(student)}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {student.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {student.studentId} · Mentor: {mentor ? mentor.name.split(' ').slice(-1)[0] : student.assignedFacultyId}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        <div className="truncate max-w-[180px]" title={student.department}>
                          {student.department}
                        </div>
                        <div className="text-[11px] text-slate-400">Year {student.academicYear}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        <span className="text-sm font-bold text-slate-900">
                          {student.scoreBreakdown.overallScore.toFixed(1)}
                        </span>
                        <span className="text-slate-400 text-[11px]"> /100</span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        <div className="font-semibold text-slate-900">
                          {student.cgpa.toFixed(2)}
                        </div>
                        <div
                          className={`text-[11px] ${
                            student.backlogs > 0 ? 'text-red-600 font-semibold' : 'text-slate-400'
                          }`}
                        >
                          {student.backlogs} {student.backlogs === 1 ? 'backlog' : 'backlogs'}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        <span
                          className={`font-semibold ${
                            student.attendance < 65
                              ? 'text-red-600'
                              : student.attendance < 75
                              ? 'text-amber-600'
                              : 'text-slate-900'
                          }`}
                        >
                          {student.attendance}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        <div className="font-semibold text-slate-900">
                          {student.scoreBreakdown.components.placementReadiness.toFixed(1)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Cod {student.codingScore} · Apt {student.aptitudeScore}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <RiskLevelIndicator level={student.academicRisk.level} />
                        {student.academicRisk.factors[0] && (
                          <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                            {student.academicRisk.factors[0].indicator}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <RiskLevelIndicator level={student.placementRisk.level} />
                        {student.placementRisk.factors[0] && (
                          <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                            {student.placementRisk.factors[0].indicator}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-800 font-medium leading-snug">
                          {student.segment.label}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="inline-flex items-center gap-0.5 text-xs font-medium text-blue-600 group-hover:translate-x-0.5 transition-transform">
                          <span>View</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
