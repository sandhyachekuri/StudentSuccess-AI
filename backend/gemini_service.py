"""
StudentSuccess AI — Secure Backend Gemini API Service.
- Loads environment variables from `.env` using `python-dotenv`.
- Reads the API key exclusively on the backend via `os.getenv("GEMINI_API_KEY")`.
- Uses the official Google Gen AI Python SDK (`google-genai`, imported as `from google import genai`).
- Never logs, returns, or exposes `GEMINI_API_KEY` in responses or error messages.
"""

from datetime import datetime, timezone
import json
import os
import re
from typing import Optional

from dotenv import load_dotenv
from fastapi import HTTPException

from .models import (
    AIRecommendationResponse,
    AIStatusResponse,
    EnrichedStudentModel,
)

# Load local .env file securely on backend startup
load_dotenv()

GEMINI_MODEL_NAME = "gemini-3.8-flash"

PLACEHOLDER_KEYS = {
    "",
    "MY_GEMINI_API_KEY",
    "YOUR_GEMINI_API_KEY",
    "REPLACE_WITH_GEMINI_API_KEY",
    "NONE",
    "NULL",
}


def _get_validated_api_key() -> Optional[str]:
    """
    Reads GEMINI_API_KEY exclusively from the backend environment.
    Returns None if missing or still set to a placeholder value.
    Never returns the key to callers outside this module's SDK initialization.
    """
    raw_key = os.getenv("GEMINI_API_KEY")
    if not raw_key:
        return None
    cleaned = raw_key.strip().strip('"').strip("'")
    if cleaned.upper() in PLACEHOLDER_KEYS or len(cleaned) < 12:
        return None
    return cleaned


def _sanitize_error_message(message: str, api_key: Optional[str] = None) -> str:
    """
    Ensures the API key or any Google API key pattern (AIza...) is scrubbed
    from exception messages before logging or returning an HTTP error.
    """
    if not message:
        return "An unexpected error occurred while communicating with the Gemini API."
    sanitized = message
    if api_key:
        sanitized = sanitized.replace(api_key, "[REDACTED_API_KEY]")
    sanitized = re.sub(r"AIza[0-9A-Za-z\-_]{20,50}", "[REDACTED_API_KEY]", sanitized)
    return sanitized


def get_gemini_service_status() -> AIStatusResponse:
    """
    Returns whether GEMINI_API_KEY is configured on the server without
    ever exposing the key value.
    """
    api_key = _get_validated_api_key()
    is_configured = api_key is not None
    return AIStatusResponse(
        configured=is_configured,
        service="Google Gen AI Python SDK (google-genai)",
        model=GEMINI_MODEL_NAME,
        message=(
            "GEMINI_API_KEY is securely configured on the FastAPI backend."
            if is_configured
            else "GEMINI_API_KEY is not configured or is set to a placeholder in .env."
        ),
    )


def generate_student_ai_recommendations(
    enriched_student: EnrichedStudentModel,
    focus_area: Optional[str] = None,
) -> AIRecommendationResponse:
    """
    Calls the Gemini API from the Python FastAPI backend using the official
    `google-genai` SDK (`from google import genai`) to produce grounded,
    personalized academic and placement recommendations for a student.
    """
    api_key = _get_validated_api_key()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail=(
                "Gemini AI service is not configured on the backend. "
                "Set a valid GEMINI_API_KEY in your backend .env file or hosting environment secrets."
            ),
        )

    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "The official Google Gen AI Python SDK ('google-genai') is not installed. "
                "Run 'pip install -r requirements.txt' in your Python environment."
            ),
        ) from exc

    academic_factors = (
        "; ".join(
            f"{f.indicator} ({f.observedValue})"
            for f in enriched_student.academicRisk.factors
        )
        or "None (meets all academic thresholds)"
    )
    placement_factors = (
        "; ".join(
            f"{f.indicator} ({f.observedValue})"
            for f in enriched_student.placementRisk.factors
        )
        or "None (meets all placement thresholds)"
    )

    prompt = f"""
Analyze the following university student record from StudentSuccess AI and generate a grounded,
evidence-based performance analysis and personalized improvement plan.

Student Profile:
- Student ID: {enriched_student.studentId}
- Name: {enriched_student.name}
- Department: {enriched_student.department} (Academic Year {enriched_student.academicYear})
- Overall Student Success Score: {enriched_student.scoreBreakdown.overallScore}/100
- Assigned Segment: {enriched_student.segment.label} ({enriched_student.segment.ruleMatched})
- Requested Focus Area: {focus_area or "Comprehensive Academic & Placement Improvement"}

Component Scores (0-100 scale):
- Academic Performance (30% weight): {enriched_student.scoreBreakdown.components.academicPerformance}/100 (CGPA: {enriched_student.cgpa}/10.0, Active Backlogs: {enriched_student.backlogs})
- Attendance (20% weight): {enriched_student.scoreBreakdown.components.attendance}%
- Placement Readiness (25% weight): {enriched_student.scoreBreakdown.components.placementReadiness}/100 (Coding: {enriched_student.codingScore}, Aptitude: {enriched_student.aptitudeScore}, Communication: {enriched_student.communicationScore}, Mock Interview: {enriched_student.mockInterviewScore})
- LMS & Assignments (10% weight): {enriched_student.scoreBreakdown.components.lmsActivity}/100 (LMS Activity: {enriched_student.lmsActivity}/100, Assignment Completion: {enriched_student.assignmentCompletion}%)
- Skills & Engagement (15% weight): {enriched_student.scoreBreakdown.components.skillsAndEngagement}/100 (Technical Skill: {enriched_student.technicalSkillScore}/100, Extracurricular: {enriched_student.extracurricularScore}/100)

Independent Risk Assessments:
- Academic Risk: {enriched_student.academicRisk.level} — Factors: {academic_factors}
- Placement Risk: {enriched_student.placementRisk.level} — Factors: {placement_factors}

Return a JSON object with these exact keys:
- "executiveSummary": A concise 2-3 sentence summary referencing the student's actual scores.
- "academicAnalysis": Specific diagnostic commentary on CGPA, backlogs, attendance, and LMS coursework.
- "placementAnalysis": Specific diagnostic commentary on coding, aptitude, communication, and mock interviews.
- "prioritizedActions": Array of 3 to 4 concrete, measurable intervention steps for the student and faculty mentor.
- "weeklyStudyPlan": Array of 3 to 4 structured weekly study/practice blocks tailored to the student's weakest indicators.
""".strip()

    try:
        client = genai.Client(
            api_key=api_key,
            http_options={"headers": {"User-Agent": "aistudio-build"}},
        )

        response = client.models.generate_content(
            model=GEMINI_MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=(
                    "You are an academic advisor and campus placement analytics specialist. "
                    "Base every recommendation strictly on the provided numeric student indicators. "
                    "Always respond with valid JSON matching the requested schema."
                ),
                response_mime_type="application/json",
                temperature=0.3,
            ),
        )

        raw_text = (response.text or "").strip()
        if not raw_text:
            raise ValueError("Gemini returned an empty response payload.")

        parsed = json.loads(raw_text)

        return AIRecommendationResponse(
            studentId=enriched_student.studentId,
            studentName=enriched_student.name,
            modelUsed=GEMINI_MODEL_NAME,
            generatedAt=datetime.now(timezone.utc).isoformat(),
            executiveSummary=str(
                parsed.get(
                    "executiveSummary",
                    "Personalized analysis generated from current student indicators.",
                )
            ),
            academicAnalysis=str(
                parsed.get(
                    "academicAnalysis",
                    enriched_student.academicRisk.summaryExplanation,
                )
            ),
            placementAnalysis=str(
                parsed.get(
                    "placementAnalysis",
                    enriched_student.placementRisk.summaryExplanation,
                )
            ),
            prioritizedActions=[
                str(item)
                for item in parsed.get("prioritizedActions", [])
                if str(item).strip()
            ][:5]
            or [i.recommendedAction for i in enriched_student.interventions],
            weeklyStudyPlan=[
                str(item)
                for item in parsed.get("weeklyStudyPlan", [])
                if str(item).strip()
            ][:5]
            or [
                "Mon/Wed: 90 mins core subject problem sets & backlog review",
                "Tue/Thu: 60 mins timed DSA coding & quantitative aptitude drills",
                "Friday: 45 mins mock interview & communication practice with mentor",
            ],
        )
    except HTTPException:
        raise
    except Exception as exc:
        safe_err = _sanitize_error_message(str(exc), api_key)
        raise HTTPException(
            status_code=502,
            detail=f"Gemini API request failed: {safe_err}",
        ) from exc
