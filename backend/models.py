"""
Pydantic Data Models & Validation Schemas for StudentSuccess AI Backend.
Enforces strict field validation and numeric range bounds:
- CGPA: 0.0 to 10.0
- Backlogs: Integer >= 0
- Attendance & percentage/assessment scores: 0.0 to 100.0
"""

from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator


DepartmentLiteral = Literal[
    "Computer Science & Engineering",
    "Data Science & AI",
    "Electronics & Communication",
    "Information Technology",
    "Mechanical Engineering",
]

RiskLevelLiteral = Literal["Low Risk", "Medium Risk", "High Risk"]

SegmentIdLiteral = Literal[
    "balanced_high_performers",
    "strong_academics_low_placement",
    "good_placement_weak_academics",
    "low_attendance_academic_concerns",
    "multi_indicator_support",
    "steady_developing_cohort",
]

InterventionStatusLiteral = Literal["Planned", "In Progress", "Completed"]


class SemesterHistoryPoint(BaseModel):
    sem: str
    sgpa: float = Field(..., ge=0.0, le=10.0)
    attendance: float = Field(..., ge=0.0, le=100.0)
    placementIndex: float = Field(..., ge=0.0, le=100.0)


class StudentRecordInput(BaseModel):
    studentId: str = Field(..., min_length=1, description="Unique student identifier")
    name: str = Field(..., min_length=2, description="Full student name")
    department: DepartmentLiteral
    academicYear: int = Field(..., ge=1, le=4, description="Academic year (1 to 4)")
    cgpa: float = Field(..., ge=0.0, le=10.0, description="CGPA on a 0-10 scale")
    backlogs: int = Field(..., ge=0, le=20, description="Number of active backlogs")
    attendance: float = Field(..., ge=0.0, le=100.0, description="Overall attendance percentage (0-100)")
    lmsActivity: float = Field(..., ge=0.0, le=100.0, description="LMS activity score (0-100)")
    assignmentCompletion: float = Field(
        ..., ge=0.0, le=100.0, description="Assignment completion percentage (0-100)"
    )
    codingScore: float = Field(..., ge=0.0, le=100.0, description="Coding score (0-100)")
    aptitudeScore: float = Field(..., ge=0.0, le=100.0, description="Aptitude score (0-100)")
    communicationScore: float = Field(
        ..., ge=0.0, le=100.0, description="Communication score (0-100)"
    )
    mockInterviewScore: float = Field(
        ..., ge=0.0, le=100.0, description="Mock interview score (0-100)"
    )
    technicalSkillScore: float = Field(
        ..., ge=0.0, le=100.0, description="Technical skill score (0-100)"
    )
    extracurricularScore: float = Field(
        ..., ge=0.0, le=100.0, description="Extracurricular engagement score (0-100)"
    )
    assignedFacultyId: Optional[str] = Field(default="FAC-101")
    semesterHistory: Optional[List[SemesterHistoryPoint]] = None

    @field_validator("studentId", "name")
    @classmethod
    def must_not_be_blank(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Field cannot be empty or whitespace")
        return cleaned


class ScoreComponentsModel(BaseModel):
    academicPerformance: float = Field(..., ge=0.0, le=100.0)
    attendance: float = Field(..., ge=0.0, le=100.0)
    placementReadiness: float = Field(..., ge=0.0, le=100.0)
    lmsActivity: float = Field(..., ge=0.0, le=100.0)
    skillsAndEngagement: float = Field(..., ge=0.0, le=100.0)


class WeightedContributionsModel(BaseModel):
    academicPerformance: float = Field(..., ge=0.0, le=30.0)
    attendance: float = Field(..., ge=0.0, le=20.0)
    placementReadiness: float = Field(..., ge=0.0, le=25.0)
    lmsActivity: float = Field(..., ge=0.0, le=10.0)
    skillsAndEngagement: float = Field(..., ge=0.0, le=15.0)


class ScoreSubDetailsModel(BaseModel):
    normalizedCgpa: float
    backlogPenalty: float


class ScoreBreakdownModel(BaseModel):
    overallScore: float = Field(..., ge=0.0, le=100.0)
    components: ScoreComponentsModel
    weightedContributions: WeightedContributionsModel
    subDetails: ScoreSubDetailsModel
    explanation: str


class RiskFactorDetailModel(BaseModel):
    indicator: str
    observedValue: str
    thresholdRule: str
    severity: Literal["critical", "warning"]


class RiskAssessmentModel(BaseModel):
    level: RiskLevelLiteral
    riskPoints: int
    factors: List[RiskFactorDetailModel]
    summaryExplanation: str


class SegmentAssignmentModel(BaseModel):
    id: SegmentIdLiteral
    label: str
    shortDescription: str
    ruleMatched: str


class InterventionItemModel(BaseModel):
    id: str
    studentId: str
    category: str
    title: str
    reason: str
    triggerRule: str
    recommendedAction: str
    priority: Literal["High", "Medium", "Standard"]
    status: InterventionStatusLiteral
    assignedTo: str
    updatedAt: str
    notes: Optional[str] = None


class EnrichedStudentModel(StudentRecordInput):
    scoreBreakdown: ScoreBreakdownModel
    academicRisk: RiskAssessmentModel
    placementRisk: RiskAssessmentModel
    segment: SegmentAssignmentModel
    interventions: List[InterventionItemModel]
    requiresImmediateAttention: bool


class AcademicThresholdsModel(BaseModel):
    cgpaCritical: float = 6.0
    cgpaWarning: float = 7.0
    backlogsCritical: int = 2
    backlogsWarning: int = 1
    attendanceCritical: float = 65.0
    attendanceWarning: float = 75.0
    assignmentCritical: float = 60.0
    assignmentWarning: float = 72.0


class PlacementThresholdsModel(BaseModel):
    codingCritical: float = 50.0
    codingWarning: float = 65.0
    aptitudeCritical: float = 50.0
    aptitudeWarning: float = 65.0
    communicationCritical: float = 50.0
    communicationWarning: float = 65.0
    mockInterviewCritical: float = 50.0
    mockInterviewWarning: float = 65.0


class RiskThresholdsModel(BaseModel):
    academic: AcademicThresholdsModel = Field(default_factory=AcademicThresholdsModel)
    placement: PlacementThresholdsModel = Field(default_factory=PlacementThresholdsModel)


class AnalyzeCohortRequest(BaseModel):
    students: List[StudentRecordInput]
    thresholds: Optional[RiskThresholdsModel] = None


class CohortSummaryStats(BaseModel):
    totalStudents: int
    averageSuccessScore: float
    averageCgpa: float
    averageAttendance: float
    averagePlacementReadiness: float
    academicHighRiskCount: int
    academicMediumRiskCount: int
    placementHighRiskCount: int
    placementMediumRiskCount: int
    immediateAttentionCount: int


class AnalyzeCohortResponse(BaseModel):
    summary: CohortSummaryStats
    students: List[EnrichedStudentModel]


class CSVValidationErrorModel(BaseModel):
    rowNumber: int
    studentId: str
    field: str
    value: str
    message: str


class CSVUploadResponse(BaseModel):
    isValidStructure: bool
    missingColumns: List[str]
    totalRowsRead: int
    validCount: int
    errorCount: int
    errors: List[CSVValidationErrorModel]
    validRecords: List[EnrichedStudentModel]


class AIStatusResponse(BaseModel):
    configured: bool
    service: str
    model: str
    message: str


class AIRecommendationRequest(BaseModel):
    student: StudentRecordInput
    focusArea: Optional[str] = Field(
        default=None,
        description="Optional focus area such as academics, attendance, or placement readiness",
    )


class AIRecommendationResponse(BaseModel):
    studentId: str
    studentName: str
    modelUsed: str
    generatedAt: str
    executiveSummary: str
    academicAnalysis: str
    placementAnalysis: str
    prioritizedActions: List[str]
    weeklyStudyPlan: List[str]


UserRoleLiteral = Literal["admin", "faculty", "student"]


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, description="Institutional user email")
    password: str = Field(..., min_length=4, description="Account password")
    role: Optional[UserRoleLiteral] = Field(
        default=None, description="Selected role tab on login page"
    )
    rememberMe: bool = Field(default=False, description="Extend session token TTL")


class AuthenticatedUserModel(BaseModel):
    id: str
    email: str
    name: str
    title: str
    role: UserRoleLiteral
    department: Optional[str] = None
    linkedFacultyId: Optional[str] = None
    linkedStudentId: Optional[str] = None
    isActive: bool = True
    firebaseUid: Optional[str] = None
    authProvider: Optional[str] = "sqlite_pbkdf2"
    accountStatus: Optional[str] = "active"
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    redirectTo: str


class FirebaseLoginRequest(BaseModel):
    idToken: str = Field(..., min_length=10, description="Firebase ID token obtained after client sign-in")
    role: Optional[UserRoleLiteral] = None
    rememberMe: bool = False


class ProvisionUserRequest(BaseModel):
    role: UserRoleLiteral
    email: str = Field(..., min_length=3)
    name: str = Field(..., min_length=2)
    initialPassword: str = Field(..., min_length=6)
    title: Optional[str] = None
    department: Optional[DepartmentLiteral] = None
    firebaseUid: Optional[str] = None
    # Faculty-specific fields
    linkedFacultyId: Optional[str] = None
    designation: Optional[str] = None
    specialization: Optional[str] = None
    # Student-specific fields
    linkedStudentId: Optional[str] = None
    academicYear: Optional[int] = Field(default=3, ge=1, le=4)
    cgpa: Optional[float] = Field(default=7.5, ge=0.0, le=10.0)
    backlogs: Optional[int] = Field(default=0, ge=0, le=20)
    attendance: Optional[float] = Field(default=82.0, ge=0.0, le=100.0)
    lmsActivity: Optional[float] = Field(default=76.0, ge=0.0, le=100.0)
    assignmentCompletion: Optional[float] = Field(default=80.0, ge=0.0, le=100.0)
    codingScore: Optional[float] = Field(default=70.0, ge=0.0, le=100.0)
    aptitudeScore: Optional[float] = Field(default=72.0, ge=0.0, le=100.0)
    communicationScore: Optional[float] = Field(default=74.0, ge=0.0, le=100.0)
    mockInterviewScore: Optional[float] = Field(default=70.0, ge=0.0, le=100.0)
    technicalSkillScore: Optional[float] = Field(default=72.0, ge=0.0, le=100.0)
    extracurricularScore: Optional[float] = Field(default=68.0, ge=0.0, le=100.0)
    assignedFacultyId: Optional[str] = Field(default="FAC-101")


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    role: Optional[UserRoleLiteral] = None
    department: Optional[DepartmentLiteral] = None
    firebaseUid: Optional[str] = None
    newPassword: Optional[str] = None
    cgpa: Optional[float] = Field(default=None, ge=0.0, le=10.0)
    attendance: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    backlogs: Optional[int] = Field(default=None, ge=0, le=20)


class UpdateUserStatusRequest(BaseModel):
    isActive: bool


class LoginResponse(BaseModel):
    accessToken: str
    tokenType: str = "Bearer"
    expiresAt: str
    rememberMe: bool
    redirectTo: str
    user: AuthenticatedUserModel


class AuthMeResponse(BaseModel):
    user: AuthenticatedUserModel
    expiresAt: str
    rememberMe: bool


class LogoutResponse(BaseModel):
    status: str
    message: str


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=3)
    role: Optional[UserRoleLiteral] = None


class ForgotPasswordResponse(BaseModel):
    status: str
    email: str
    message: str


