export type Department =
  | 'Computer Science & Engineering'
  | 'Data Science & AI'
  | 'Electronics & Communication'
  | 'Information Technology'
  | 'Mechanical Engineering';

export type AcademicYear = 1 | 2 | 3 | 4;

export type RiskLevel = 'Low Risk' | 'Medium Risk' | 'High Risk';

export type SegmentId =
  | 'balanced_high_performers'
  | 'strong_academics_low_placement'
  | 'good_placement_weak_academics'
  | 'low_attendance_academic_concerns'
  | 'multi_indicator_support'
  | 'steady_developing_cohort';

export type InterventionStatus = 'Planned' | 'In Progress' | 'Completed';

export type InterventionCategory =
  | 'Attendance Follow-Up'
  | 'Remedial Classes'
  | 'Coding Practice'
  | 'Aptitude Training'
  | 'Communication & Mock Interviews'
  | 'LMS & Assignment Engagement';

export type UserRole = 'admin' | 'faculty' | 'student';

export interface StudentRecord {
  studentId: string;
  name: string;
  department: Department;
  academicYear: AcademicYear;
  cgpa: number; // 0.0 to 10.0
  backlogs: number; // integer >= 0
  attendance: number; // 0 to 100
  lmsActivity: number; // 0 to 100
  assignmentCompletion: number; // 0 to 100
  codingScore: number; // 0 to 100
  aptitudeScore: number; // 0 to 100
  communicationScore: number; // 0 to 100
  mockInterviewScore: number; // 0 to 100
  technicalSkillScore: number; // 0 to 100
  extracurricularScore: number; // 0 to 100
  assignedFacultyId: string;
  semesterHistory?: {
    sem: string;
    sgpa: number;
    attendance: number;
    placementIndex: number;
  }[];
}

export interface ScoreBreakdown {
  overallScore: number;
  components: {
    academicPerformance: number;
    attendance: number;
    placementReadiness: number;
    lmsActivity: number;
    skillsAndEngagement: number;
  };
  weightedContributions: {
    academicPerformance: number; // max 30
    attendance: number; // max 20
    placementReadiness: number; // max 25
    lmsActivity: number; // max 10
    skillsAndEngagement: number; // max 15
  };
  subDetails: {
    normalizedCgpa: number;
    backlogPenalty: number;
  };
  explanation: string;
}

export interface RiskFactorDetail {
  indicator: string;
  observedValue: string;
  thresholdRule: string;
  severity: 'critical' | 'warning';
}

export interface RiskAssessment {
  level: RiskLevel;
  riskPoints: number;
  factors: RiskFactorDetail[];
  summaryExplanation: string;
}

export interface SegmentAssignment {
  id: SegmentId;
  label: string;
  shortDescription: string;
  ruleMatched: string;
}

export interface InterventionItem {
  id: string;
  studentId: string;
  category: InterventionCategory;
  title: string;
  reason: string;
  triggerRule: string;
  recommendedAction: string;
  priority: 'High' | 'Medium' | 'Standard';
  status: InterventionStatus;
  assignedTo: string;
  updatedAt: string;
  notes?: string;
}

export interface EnrichedStudent extends StudentRecord {
  scoreBreakdown: ScoreBreakdown;
  academicRisk: RiskAssessment;
  placementRisk: RiskAssessment;
  segment: SegmentAssignment;
  interventions: InterventionItem[];
  requiresImmediateAttention: boolean;
}

export interface RiskThresholds {
  academic: {
    cgpaCritical: number;
    cgpaWarning: number;
    backlogsCritical: number;
    backlogsWarning: number;
    attendanceCritical: number;
    attendanceWarning: number;
    assignmentCritical: number;
    assignmentWarning: number;
  };
  placement: {
    codingCritical: number;
    codingWarning: number;
    aptitudeCritical: number;
    aptitudeWarning: number;
    communicationCritical: number;
    communicationWarning: number;
    mockInterviewCritical: number;
    mockInterviewWarning: number;
  };
}

export interface FacultyMember {
  id: string;
  name: string;
  department: Department;
  designation: string;
  email: string;
  specialization: string;
}

export interface DemoAccount {
  id: string;
  role: UserRole;
  name: string;
  title: string;
  email: string;
  department?: Department;
  linkedFacultyId?: string;
  linkedStudentId?: string;
  authStatusLabel: string;
}

export interface CSVValidationError {
  rowNumber: number;
  studentId: string;
  field: string;
  value: string;
  message: string;
}

export interface CSVParseResult {
  isValidStructure: boolean;
  missingColumns: string[];
  validRecords: StudentRecord[];
  errors: CSVValidationError[];
  totalRowsRead: number;
}
