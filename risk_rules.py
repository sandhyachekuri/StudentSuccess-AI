"""
StudentSuccess AI — Independent Academic & Placement Risk Rules,
Cohort Segmentation, and Rule-Based Intervention Recommendations.
"""

from typing import List
from .models import (
    AcademicThresholdsModel,
    EnrichedStudentModel,
    InterventionItemModel,
    PlacementThresholdsModel,
    RiskAssessmentModel,
    RiskFactorDetailModel,
    RiskLevelLiteral,
    RiskThresholdsModel,
    ScoreBreakdownModel,
    SegmentAssignmentModel,
    StudentRecordInput,
)
from .scoring import calculate_student_score

FACULTY_NAMES = {
    "FAC-101": "Dr. Arindam Chatterjee",
    "FAC-102": "Prof. Meenakshi Iyer",
    "FAC-103": "Dr. Vikramaditya Rao",
    "FAC-104": "Prof. Nupur Deshmukh",
    "FAC-105": "Dr. Harpreet Singh Gill",
}


def assess_academic_risk(
    student: StudentRecordInput,
    thresholds: AcademicThresholdsModel = AcademicThresholdsModel(),
) -> RiskAssessmentModel:
    factors: List[RiskFactorDetailModel] = []
    risk_points = 0

    # 1. CGPA Check
    if student.cgpa < thresholds.cgpaCritical:
        risk_points += 2
        factors.append(
            RiskFactorDetailModel(
                indicator="Low CGPA",
                observedValue=f"{student.cgpa:.2f} / 10.0",
                thresholdRule=f"< {thresholds.cgpaCritical:.1f} critical threshold",
                severity="critical",
            )
        )
    elif student.cgpa < thresholds.cgpaWarning:
        risk_points += 1
        factors.append(
            RiskFactorDetailModel(
                indicator="Moderate CGPA Warning",
                observedValue=f"{student.cgpa:.2f} / 10.0",
                thresholdRule=f"< {thresholds.cgpaWarning:.1f} warning threshold",
                severity="warning",
            )
        )

    # 2. Backlogs Check
    if student.backlogs >= thresholds.backlogsCritical:
        risk_points += 2
        factors.append(
            RiskFactorDetailModel(
                indicator="Multiple Active Backlogs",
                observedValue=f"{student.backlogs} backlogs",
                thresholdRule=f">= {thresholds.backlogsCritical} backlogs critical threshold",
                severity="critical",
            )
        )
    elif student.backlogs >= thresholds.backlogsWarning:
        risk_points += 1
        factors.append(
            RiskFactorDetailModel(
                indicator="Active Backlog",
                observedValue=f"{student.backlogs} backlog",
                thresholdRule=f">= {thresholds.backlogsWarning} backlog warning threshold",
                severity="warning",
            )
        )

    # 3. Attendance Check
    if student.attendance < thresholds.attendanceCritical:
        risk_points += 2
        factors.append(
            RiskFactorDetailModel(
                indicator="Severe Attendance Deficit",
                observedValue=f"{student.attendance:.0f}%",
                thresholdRule=f"< {thresholds.attendanceCritical:.0f}% critical threshold",
                severity="critical",
            )
        )
    elif student.attendance < thresholds.attendanceWarning:
        risk_points += 1
        factors.append(
            RiskFactorDetailModel(
                indicator="Below Mandatory Attendance",
                observedValue=f"{student.attendance:.0f}%",
                thresholdRule=f"< {thresholds.attendanceWarning:.0f}% statutory threshold",
                severity="warning",
            )
        )

    # 4. Assignment Completion & LMS Engagement
    academic_engagement = min(student.assignmentCompletion, student.lmsActivity)
    if student.assignmentCompletion < thresholds.assignmentCritical or academic_engagement < 55:
        risk_points += 2
        factors.append(
            RiskFactorDetailModel(
                indicator="Incomplete Assignments / Weak LMS Engagement",
                observedValue=f"{student.assignmentCompletion:.0f}% assignments · {student.lmsActivity:.0f}/100 LMS",
                thresholdRule=f"Assignments < {thresholds.assignmentCritical:.0f}% or LMS < 55",
                severity="critical",
            )
        )
    elif student.assignmentCompletion < thresholds.assignmentWarning or student.lmsActivity < 65:
        risk_points += 1
        factors.append(
            RiskFactorDetailModel(
                indicator="Moderate Assignment / LMS Lag",
                observedValue=f"{student.assignmentCompletion:.0f}% assignments · {student.lmsActivity:.0f}/100 LMS",
                thresholdRule=f"Assignments < {thresholds.assignmentWarning:.0f}% or LMS < 65",
                severity="warning",
            )
        )

    critical_count = sum(1 for f in factors if f.severity == "critical")
    level: RiskLevelLiteral = "Low Risk"
    if risk_points >= 4 or critical_count >= 2:
        level = "High Risk"
    elif risk_points >= 2 or len(factors) >= 1:
        level = "Medium Risk"

    if not factors:
        summary = "Meets all academic performance, attendance, and coursework completion thresholds."
    else:
        details = "; ".join(f"{f.indicator} ({f.observedValue})" for f in factors)
        summary = f"Flagged as {level} ({risk_points} risk points) due to: {details}."

    return RiskAssessmentModel(
        level=level,
        riskPoints=risk_points,
        factors=factors,
        summaryExplanation=summary,
    )


def assess_placement_risk(
    student: StudentRecordInput,
    thresholds: PlacementThresholdsModel = PlacementThresholdsModel(),
) -> RiskAssessmentModel:
    factors: List[RiskFactorDetailModel] = []
    risk_points = 0

    # 1. Coding Score
    if student.codingScore < thresholds.codingCritical:
        risk_points += 2
        factors.append(
            RiskFactorDetailModel(
                indicator="Low Coding Assessment Score",
                observedValue=f"{student.codingScore:.0f} / 100",
                thresholdRule=f"< {thresholds.codingCritical:.0f} critical threshold",
                severity="critical",
            )
        )
    elif student.codingScore < thresholds.codingWarning:
        risk_points += 1
        factors.append(
            RiskFactorDetailModel(
                indicator="Developing Coding Proficiency",
                observedValue=f"{student.codingScore:.0f} / 100",
                thresholdRule=f"< {thresholds.codingWarning:.0f} readiness threshold",
                severity="warning",
            )
        )

    # 2. Aptitude Score
    if student.aptitudeScore < thresholds.aptitudeCritical:
        risk_points += 2
        factors.append(
            RiskFactorDetailModel(
                indicator="Low Quantitative/Analytical Aptitude",
                observedValue=f"{student.aptitudeScore:.0f} / 100",
                thresholdRule=f"< {thresholds.aptitudeCritical:.0f} critical threshold",
                severity="critical",
            )
        )
    elif student.aptitudeScore < thresholds.aptitudeWarning:
        risk_points += 1
        factors.append(
            RiskFactorDetailModel(
                indicator="Moderate Aptitude Readiness",
                observedValue=f"{student.aptitudeScore:.0f} / 100",
                thresholdRule=f"< {thresholds.aptitudeWarning:.0f} readiness threshold",
                severity="warning",
            )
        )

    # 3. Communication Score
    if student.communicationScore < thresholds.communicationCritical:
        risk_points += 2
        factors.append(
            RiskFactorDetailModel(
                indicator="Low Professional Communication Score",
                observedValue=f"{student.communicationScore:.0f} / 100",
                thresholdRule=f"< {thresholds.communicationCritical:.0f} critical threshold",
                severity="critical",
            )
        )
    elif student.communicationScore < thresholds.communicationWarning:
        risk_points += 1
        factors.append(
            RiskFactorDetailModel(
                indicator="Moderate Communication Readiness",
                observedValue=f"{student.communicationScore:.0f} / 100",
                thresholdRule=f"< {thresholds.communicationWarning:.0f} readiness threshold",
                severity="warning",
            )
        )

    # 4. Mock Interview Score
    if student.mockInterviewScore < thresholds.mockInterviewCritical:
        risk_points += 2
        factors.append(
            RiskFactorDetailModel(
                indicator="Low Mock Interview Performance",
                observedValue=f"{student.mockInterviewScore:.0f} / 100",
                thresholdRule=f"< {thresholds.mockInterviewCritical:.0f} critical threshold",
                severity="critical",
            )
        )
    elif student.mockInterviewScore < thresholds.mockInterviewWarning:
        risk_points += 1
        factors.append(
            RiskFactorDetailModel(
                indicator="Moderate Mock Interview Score",
                observedValue=f"{student.mockInterviewScore:.0f} / 100",
                thresholdRule=f"< {thresholds.mockInterviewWarning:.0f} readiness threshold",
                severity="warning",
            )
        )

    critical_count = sum(1 for f in factors if f.severity == "critical")
    level: RiskLevelLiteral = "Low Risk"
    if risk_points >= 4 or critical_count >= 2:
        level = "High Risk"
    elif risk_points >= 2 or len(factors) >= 1:
        level = "Medium Risk"

    if not factors:
        summary = "Meets all career readiness benchmarks across coding, aptitude, communication, and mock interviews."
    else:
        details = "; ".join(f"{f.indicator} ({f.observedValue})" for f in factors)
        summary = f"Flagged as {level} ({risk_points} risk points) due to: {details}."

    return RiskAssessmentModel(
        level=level,
        riskPoints=risk_points,
        factors=factors,
        summaryExplanation=summary,
    )


def assign_student_segment(
    student: StudentRecordInput,
    score: ScoreBreakdownModel,
    academic_risk: RiskAssessmentModel,
    placement_risk: RiskAssessmentModel,
) -> SegmentAssignmentModel:
    acad = score.components.academicPerformance
    att = score.components.attendance
    plcmt = score.components.placementReadiness

    if (
        academic_risk.level == "High Risk" and placement_risk.level == "High Risk"
    ) or score.overallScore < 58:
        return SegmentAssignmentModel(
            id="multi_indicator_support",
            label="Students Needing Multi-Indicator Support",
            shortDescription="Concurrent high academic and placement risk requiring coordinated faculty mentoring.",
            ruleMatched=(
                f"Matched because Overall Score is {score.overallScore} (< 58 threshold) "
                f"or both Academic Risk ({academic_risk.level}) and Placement Risk ({placement_risk.level}) are High."
            ),
        )

    if acad >= 75 and plcmt >= 75 and att >= 80 and student.backlogs == 0:
        return SegmentAssignmentModel(
            id="balanced_high_performers",
            label="Balanced High Performers",
            shortDescription="Strong academic standing, high attendance, and high placement readiness.",
            ruleMatched=(
                f"Matched because Academic Score ({acad}) >= 75, Placement Readiness ({plcmt}) >= 75, "
                f"Attendance ({att:.0f}%) >= 80%, and Backlogs = 0."
            ),
        )

    if acad >= 72 and student.cgpa >= 7.5 and plcmt < 62:
        return SegmentAssignmentModel(
            id="strong_academics_low_placement",
            label="Strong Academics, Low Placement Readiness",
            shortDescription="Excels in university coursework and CGPA but lags in coding, aptitude, or interview tests.",
            ruleMatched=(
                f"Matched because Academic Score ({acad}) >= 72 & CGPA ({student.cgpa}) >= 7.5, "
                f"while Placement Readiness ({plcmt}) < 62."
            ),
        )

    if plcmt >= 70 and (acad < 68 or student.backlogs >= 1):
        return SegmentAssignmentModel(
            id="good_placement_weak_academics",
            label="Good Placement Readiness, Weak Academics",
            shortDescription="Strong practical coding and interview skills, but low CGPA or active backlogs risk eligibility.",
            ruleMatched=(
                f"Matched because Placement Readiness ({plcmt}) >= 70, while Academic Score ({acad}) < 68 "
                f"or Backlogs ({student.backlogs}) >= 1."
            ),
        )

    if att < 75 and (acad < 70 or student.backlogs >= 1 or student.assignmentCompletion < 70):
        return SegmentAssignmentModel(
            id="low_attendance_academic_concerns",
            label="Low Attendance with Academic Concerns",
            shortDescription="Attendance below 75% coupled with declining coursework completion or CGPA.",
            ruleMatched=(
                f"Matched because Attendance ({att:.0f}%) < 75% with Academic Score ({acad}) < 70 "
                f"or Backlogs ({student.backlogs}) >= 1."
            ),
        )

    return SegmentAssignmentModel(
        id="steady_developing_cohort",
        label="Steady Developing Cohort",
        shortDescription="Consistent moderate performers progressing without dual critical risk flags.",
        ruleMatched=(
            f"Matched as balanced mid-tier progression (Academic: {acad}, "
            f"Placement: {plcmt}, Attendance: {att:.0f}%)."
        ),
    )


def generate_interventions_for_student(
    student: StudentRecordInput,
) -> List[InterventionItemModel]:
    items: List[InterventionItemModel] = []
    mentor = FACULTY_NAMES.get(student.assignedFacultyId or "FAC-101", "Assigned Faculty Mentor")

    def make_item(
        suffix: str,
        category: str,
        title: str,
        reason: str,
        trigger: str,
        action: str,
        priority: str,
    ) -> InterventionItemModel:
        return InterventionItemModel(
            id=f"INT-{student.studentId}-{suffix}",
            studentId=student.studentId,
            category=category,
            title=title,
            reason=reason,
            triggerRule=trigger,
            recommendedAction=action,
            priority=priority,  # type: ignore[arg-type]
            status="Planned",
            assignedTo=mentor,
            updatedAt="2026-10-12",
        )

    if student.attendance < 75:
        items.append(
            make_item(
                "ATT",
                "Attendance Follow-Up",
                "Faculty Follow-Up & Attendance Recovery Plan",
                f"Overall attendance is {student.attendance:.0f}% (below the 75% mandatory threshold).",
                "Attendance < 75%",
                "Conduct 1-on-1 advisor counseling, verify medical/personal barriers, and set a weekly 90% attendance target.",
                "High" if student.attendance < 65 else "Medium",
            )
        )

    if student.backlogs > 0 or student.cgpa < 6.5:
        items.append(
            make_item(
                "REM",
                "Remedial Classes",
                "Subject-Specific Remedial Classes & Backlog Clearance",
                f"Student has {student.backlogs} active backlog(s) and a CGPA of {student.cgpa:.2f}.",
                "Backlogs >= 1 or CGPA < 6.5",
                "Enroll in department remedial tutorial batch and pair with a senior peer tutor for supplementary exam preparation.",
                "High" if (student.backlogs >= 2 or student.cgpa < 6.0) else "Medium",
            )
        )

    if student.codingScore < 65:
        items.append(
            make_item(
                "COD",
                "Coding Practice",
                "Structured Coding Practice & Data Structures Lab Plan",
                f"Coding assessment score is {student.codingScore:.0f}/100, below placement readiness target.",
                "Coding Score < 65/100",
                "Assign weekly 5-problem algorithmic problem sets and mandatory participation in Friday coding lab.",
                "High" if student.codingScore < 50 else "Medium",
            )
        )

    if student.aptitudeScore < 65:
        items.append(
            make_item(
                "APT",
                "Aptitude Training",
                "Quantitative & Logical Aptitude Training Module",
                f"Aptitude score is {student.aptitudeScore:.0f}/100, impacting initial screening test clearance.",
                "Aptitude Score < 65/100",
                "Complete timed quantitative and logical reasoning mock drills twice a week on the campus portal.",
                "High" if student.aptitudeScore < 50 else "Medium",
            )
        )

    if student.communicationScore < 65 or student.mockInterviewScore < 65:
        items.append(
            make_item(
                "COM",
                "Communication & Mock Interviews",
                "Communication Clinic & Panel Mock Interviews",
                f"Communication ({student.communicationScore:.0f}/100) or Mock Interview ({student.mockInterviewScore:.0f}/100) is below benchmark.",
                "Communication < 65 or Mock Interview < 65",
                "Schedule two recorded mock interviews with placement cell feedback and weekly group discussion sessions.",
                "High"
                if (student.communicationScore < 50 or student.mockInterviewScore < 50)
                else "Medium",
            )
        )

    if student.lmsActivity < 65 or student.assignmentCompletion < 72:
        items.append(
            make_item(
                "LMS",
                "LMS & Assignment Engagement",
                "LMS Engagement & Coursework Submission Follow-Up",
                f"LMS activity ({student.lmsActivity:.0f}/100) and assignment completion ({student.assignmentCompletion:.0f}%) show disengagement.",
                "LMS Activity < 65 or Assignment Completion < 72%",
                "Enable automated LMS deadline reminders and review pending module submissions with course instructor.",
                "High" if student.assignmentCompletion < 60 else "Medium",
            )
        )

    if not items:
        items.append(
            make_item(
                "ADV",
                "Coding Practice",
                "Advanced Capstone & Tier-1 Product Interview Prep",
                f"Strong all-round indicators (CGPA {student.cgpa:.1f}, Coding {student.codingScore:.0f}/100).",
                "All core indicators above risk thresholds",
                "Nominate for peer mentoring leadership, research elective, and competitive product-company mock panels.",
                "Standard",
            )
        )

    return items


def enrich_student_record(
    student: StudentRecordInput,
    thresholds: RiskThresholdsModel = RiskThresholdsModel(),
) -> EnrichedStudentModel:
    score_breakdown = calculate_student_score(student)
    academic_risk = assess_academic_risk(student, thresholds.academic)
    placement_risk = assess_placement_risk(student, thresholds.placement)
    segment = assign_student_segment(student, score_breakdown, academic_risk, placement_risk)
    interventions = generate_interventions_for_student(student)
    requires_immediate = (
        academic_risk.level == "High Risk"
        or placement_risk.level == "High Risk"
        or score_breakdown.overallScore < 58
    )

    return EnrichedStudentModel(
        **student.model_dump(),
        scoreBreakdown=score_breakdown,
        academicRisk=academic_risk,
        placementRisk=placement_risk,
        segment=segment,
        interventions=interventions,
        requiresImmediateAttention=requires_immediate,
    )
