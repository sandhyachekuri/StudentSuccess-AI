/**
 * Modular Data & Backend Integration Layer
 *
 * Planned Target Architecture:
 * React Frontend -> Python FastAPI Backend -> Analytics Engine (Pandas/NumPy/scikit-learn) -> Authorized Storage (Firebase + MySQL)
 *
 * Responsibility Separation:
 * 1. Firebase Authentication: Verifies user identity and issues signed JWT ID tokens with custom role claims.
 * 2. Firebase Cloud Firestore: Stores operational workflow states (intervention status logs, mentor-student notes, real-time notifications).
 * 3. MySQL Relational Database: System of record for structured academic transcripts, semester SGPA/CGPA ledgers, attendance registers, and placement assessment scores.
 * 4. Python FastAPI + Pandas/NumPy/scikit-learn: Executes batch ETL normalization, historical cohort training, and model calibration.
 * 5. Google Gemini API (via Backend Route): Generates grounded, contextual coaching summaries from structured student indicators without exposing API keys in client code.
 */

export interface ServiceIntegrationDescriptor {
  id: string;
  name: string;
  layer: 'Authentication' | 'Operational Document Store' | 'Relational Ledger' | 'Analytics API' | 'Generative AI';
  plannedTechnology: string;
  currentMode: 'Local Prototype Engine' | 'Ready for Backend Binding';
  definedResponsibility: string;
  plannedEndpointOrCollection: string;
}

export const PLANNED_ARCHITECTURE_SERVICES: ServiceIntegrationDescriptor[] = [
  {
    id: 'fastapi-analytics',
    name: 'Analytics & Scoring Engine API',
    layer: 'Analytics API',
    plannedTechnology: 'Python 3.11 · FastAPI · Pydantic · Pandas · NumPy',
    currentMode: 'Ready for Backend Binding',
    definedResponsibility:
      'Implemented in /backend (main.py, models.py, scoring.py, risk_rules.py, routes.py). Provides GET /health, GET /api/students, GET /api/students/{student_id}, POST /api/analyze, and POST /api/upload-csv with local synthetic fallback when offline.',
    plannedEndpointOrCollection: 'GET /health · GET /api/students · POST /api/analyze · POST /api/upload-csv',
  },
  {
    id: 'firebase-auth',
    name: 'Identity & Role Verification',
    layer: 'Authentication',
    plannedTechnology: 'Firebase Authentication (OIDC / Institutional SSO)',
    currentMode: 'Ready for Backend Binding',
    definedResponsibility:
      'Authenticates students, faculty, and administrators; role permissions must be verified server-side via custom claims and trusted role records.',
    plannedEndpointOrCollection: 'firebase.auth() + /users/{uid}/roleClaims',
  },
  {
    id: 'firebase-firestore',
    name: 'Intervention & Mentoring Workflow Store',
    layer: 'Operational Document Store',
    plannedTechnology: 'Firebase Cloud Firestore',
    currentMode: 'Local Prototype Engine',
    definedResponsibility:
      'Stores real-time faculty intervention statuses (Planned, In Progress, Completed), advisor notes, and student action goals without duplicating core academic transcripts.',
    plannedEndpointOrCollection: 'collections: /interventions/{id}, /facultyAssignments/{id}',
  },
  {
    id: 'mysql-reporting',
    name: 'Institutional Academic & Placement Warehouse',
    layer: 'Relational Ledger',
    plannedTechnology: 'MySQL 8.0 · SQL Reporting Views',
    currentMode: 'Ready for Backend Binding',
    definedResponsibility:
      'Authoritative relational store for registrar records, semester attendance, LMS logs, and placement test results used for SQL aggregation and accreditation reporting.',
    plannedEndpointOrCollection: 'tables: students, semester_grades, attendance_logs, placement_scores',
  },
  {
    id: 'gemini-explainer',
    name: 'Contextual Intervention Advisor',
    layer: 'Generative AI',
    plannedTechnology: 'Google Gemini API (google-genai Python SDK on FastAPI)',
    currentMode: 'Ready for Backend Binding',
    definedResponsibility:
      'Implemented in /backend/gemini_service.py using python-dotenv and os.getenv("GEMINI_API_KEY"). Synthesizes structured student indicators into personalized study plans via server-side FastAPI endpoints without exposing API keys in client code.',
    plannedEndpointOrCollection: 'GET /api/ai/status · POST /api/ai/recommendations · GET /api/students/{id}/ai-recommendations',
  },
];
