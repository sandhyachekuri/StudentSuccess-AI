"""
StudentSuccess AI — Scoring Engine (Pandas & NumPy).
Implements the exact weighted Student Success Score (0 to 100):
- Academic performance: 30% (normalized CGPA minus 8 pts per backlog, capped at 40 penalty)
- Attendance: 20% (attendance percentage)
- Placement readiness: 25% (30% coding + 25% aptitude + 20% communication + 25% mock interview)
- LMS activity: 10% (50% LMS activity + 50% assignment completion)
- Skills & engagement: 15% (65% technical skill + 35% extracurricular engagement)
"""

from typing import List
import numpy as np
import pandas as pd

from .models import (
    CohortSummaryStats,
    EnrichedStudentModel,
    ScoreBreakdownModel,
    ScoreComponentsModel,
    ScoreSubDetailsModel,
    StudentRecordInput,
    WeightedContributionsModel,
)

SCORE_WEIGHTS = {
    "academicPerformance": 0.30,
    "attendance": 0.20,
    "placementReadiness": 0.25,
    "lmsActivity": 0.10,
    "skillsAndEngagement": 0.15,
}


def safe_bound(val: float, min_val: float = 0.0, max_val: float = 100.0) -> float:
    """Clamps a numeric value to [min_val, max_val] using NumPy."""
    if val is None or np.isnan(val) or not np.isfinite(val):
        return min_val
    return float(np.clip(val, min_val, max_val))


def calculate_student_score(student: StudentRecordInput) -> ScoreBreakdownModel:
    """
    Calculates component scores, weighted contributions, and an evidence-based
    explanation for a single student record.
    """
    valid_cgpa = safe_bound(student.cgpa, 0.0, 10.0)
    valid_backlogs = int(max(0, min(20, student.backlogs)))

    normalized_cgpa = valid_cgpa * 10.0
    backlog_penalty = float(min(40, valid_backlogs * 8))
    academic_perf = round(safe_bound(normalized_cgpa - backlog_penalty, 0.0, 100.0), 1)

    attendance_score = round(safe_bound(student.attendance, 0.0, 100.0), 1)

    coding = safe_bound(student.codingScore, 0.0, 100.0)
    aptitude = safe_bound(student.aptitudeScore, 0.0, 100.0)
    communication = safe_bound(student.communicationScore, 0.0, 100.0)
    mock_interview = safe_bound(student.mockInterviewScore, 0.0, 100.0)
    placement_readiness = round(
        safe_bound(
            coding * 0.30 + aptitude * 0.25 + communication * 0.20 + mock_interview * 0.25,
            0.0,
            100.0,
        ),
        1,
    )

    lms_raw = safe_bound(student.lmsActivity, 0.0, 100.0)
    assign_raw = safe_bound(student.assignmentCompletion, 0.0, 100.0)
    lms_activity = round(safe_bound(lms_raw * 0.50 + assign_raw * 0.50, 0.0, 100.0), 1)

    tech_skill = safe_bound(student.technicalSkillScore, 0.0, 100.0)
    extra_skill = safe_bound(student.extracurricularScore, 0.0, 100.0)
    skills_engagement = round(
        safe_bound(tech_skill * 0.65 + extra_skill * 0.35, 0.0, 100.0), 1
    )

    w_academic = round(academic_perf * SCORE_WEIGHTS["academicPerformance"], 2)
    w_attendance = round(attendance_score * SCORE_WEIGHTS["attendance"], 2)
    w_placement = round(placement_readiness * SCORE_WEIGHTS["placementReadiness"], 2)
    w_lms = round(lms_activity * SCORE_WEIGHTS["lmsActivity"], 2)
    w_skills = round(skills_engagement * SCORE_WEIGHTS["skillsAndEngagement"], 2)

    overall_score = round(
        safe_bound(w_academic + w_attendance + w_placement + w_lms + w_skills, 0.0, 100.0),
        1,
    )

    explanation = (
        f"Calculated as {w_academic:.1f} pts from Academics (CGPA {valid_cgpa:.1f} -> "
        f"{normalized_cgpa:.0f}/100 minus {backlog_penalty:.0f} backlog penalty x 30%) + "
        f"{w_attendance:.1f} pts from Attendance ({attendance_score:.0f}% x 20%) + "
        f"{w_placement:.1f} pts from Placement Readiness ({placement_readiness:.1f}/100 x 25%) + "
        f"{w_lms:.1f} pts from LMS & Assignments ({lms_activity:.1f}/100 x 10%) + "
        f"{w_skills:.1f} pts from Skills & Engagement ({skills_engagement:.1f}/100 x 15%)."
    )

    return ScoreBreakdownModel(
        overallScore=overall_score,
        components=ScoreComponentsModel(
            academicPerformance=academic_perf,
            attendance=attendance_score,
            placementReadiness=placement_readiness,
            lmsActivity=lms_activity,
            skillsAndEngagement=skills_engagement,
        ),
        weightedContributions=WeightedContributionsModel(
            academicPerformance=w_academic,
            attendance=w_attendance,
            placementReadiness=w_placement,
            lmsActivity=w_lms,
            skillsAndEngagement=w_skills,
        ),
        subDetails=ScoreSubDetailsModel(
            normalizedCgpa=normalized_cgpa,
            backlogPenalty=backlog_penalty,
        ),
        explanation=explanation,
    )


def compute_cohort_summary_with_pandas(
    enriched_students: List[EnrichedStudentModel],
) -> CohortSummaryStats:
    """
    Uses Pandas and NumPy to aggregate institutional cohort KPIs across enriched student records.
    """
    if not enriched_students:
        return CohortSummaryStats(
            totalStudents=0,
            averageSuccessScore=0.0,
            averageCgpa=0.0,
            averageAttendance=0.0,
            averagePlacementReadiness=0.0,
            academicHighRiskCount=0,
            academicMediumRiskCount=0,
            placementHighRiskCount=0,
            placementMediumRiskCount=0,
            immediateAttentionCount=0,
        )

    df = pd.DataFrame(
        [
            {
                "overallScore": s.scoreBreakdown.overallScore,
                "cgpa": s.cgpa,
                "attendance": s.attendance,
                "placementReadiness": s.scoreBreakdown.components.placementReadiness,
                "academicRisk": s.academicRisk.level,
                "placementRisk": s.placementRisk.level,
                "immediate": s.requiresImmediateAttention,
            }
            for s in enriched_students
        ]
    )

    return CohortSummaryStats(
        totalStudents=int(len(df)),
        averageSuccessScore=round(float(np.mean(df["overallScore"])), 1),
        averageCgpa=round(float(np.mean(df["cgpa"])), 2),
        averageAttendance=round(float(np.mean(df["attendance"])), 1),
        averagePlacementReadiness=round(float(np.mean(df["placementReadiness"])), 1),
        academicHighRiskCount=int((df["academicRisk"] == "High Risk").sum()),
        academicMediumRiskCount=int((df["academicRisk"] == "Medium Risk").sum()),
        placementHighRiskCount=int((df["placementRisk"] == "High Risk").sum()),
        placementMediumRiskCount=int((df["placementRisk"] == "Medium Risk").sum()),
        immediateAttentionCount=int(df["immediate"].sum()),
    )
