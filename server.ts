import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { INITIAL_SYNTHETIC_STUDENTS } from './src/data/syntheticStudents';
import {
  DEFAULT_RISK_THRESHOLDS,
  enrichStudentDataset,
} from './src/engine/analyticsEngine';
import {
  InterventionItem,
  RiskFactorDetail,
  RiskThresholds,
  StudentRecord,
} from './src/types/student';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  title: string;
  role: 'admin' | 'faculty' | 'student';
  department?: string | null;
  linkedFacultyId?: string | null;
  linkedStudentId?: string | null;
  redirectTo: string;
}

interface AuthSessionPayload {
  user: AuthenticatedUser;
  expiresAt: string;
  rememberMe: boolean;
}

// Active server-side student store initialized with the 56 deterministic records
let activeStudentStore: StudentRecord[] = [...INITIAL_SYNTHETIC_STUDENTS];

/**
 * Invokes the Python SQLite authentication & user management engine (`backend/auth_db.py`)
 * against `backend/studentsuccess.db`.
 */
function invokePythonAuthDb(
  command:
    | 'login'
    | 'firebase-login'
    | 'me'
    | 'logout'
    | 'forgot-password'
    | 'list-users'
    | 'provision-user'
    | 'update-user'
    | 'set-user-status'
    | 'migrate',
  payload: Record<string, unknown>
): { status: number; body: Record<string, any> } {
  const result = spawnSync('python3', ['-m', 'backend.auth_db', command], {
    cwd: __dirname,
    input: JSON.stringify(payload),
    encoding: 'utf-8',
    timeout: 10000,
  });

  if (result.error || result.status !== 0) {
    return {
      status: 500,
      body: {
        detail: 'Authentication database engine encountered an internal error.',
      },
    };
  }

  try {
    const parsed = JSON.parse(result.stdout.trim());
    return {
      status: typeof parsed.status === 'number' ? parsed.status : 500,
      body: parsed.body || {},
    };
  } catch {
    return {
      status: 500,
      body: { detail: 'Failed to parse response from Python SQLite auth engine.' },
    };
  }
}

function syncSqliteStudentsIntoMemory(): void {
  const { status, body } = invokePythonAuthDb('list-users', {});
  if (status !== 200 || !Array.isArray(body.dbStudents)) return;

  const existingById = new Map<string, number>();
  activeStudentStore.forEach((s, idx) =>
    existingById.set(s.studentId.toUpperCase(), idx)
  );

  for (const raw of body.dbStudents as StudentRecord[]) {
    if (!raw || !raw.studentId) continue;
    const key = raw.studentId.toUpperCase();
    const existingIdx = existingById.get(key);
    if (existingIdx !== undefined) {
      activeStudentStore[existingIdx] = {
        ...activeStudentStore[existingIdx],
        ...raw,
      };
    } else {
      activeStudentStore.push(raw);
      existingById.set(key, activeStudentStore.length - 1);
    }
  }
}

function getValidatedGeminiKey(): string | null {
  const raw = process.env.GEMINI_API_KEY;
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^["']|["']$/g, '');
  const placeholders = new Set([
    '',
    'MY_GEMINI_API_KEY',
    'YOUR_GEMINI_API_KEY',
    'REPLACE_WITH_GEMINI_API_KEY',
    'NONE',
    'NULL',
  ]);
  if (placeholders.has(cleaned.toUpperCase()) || cleaned.length < 12) {
    return null;
  }
  return cleaned;
}

function sanitizeErrorMessage(msg: string, apiKey: string | null): string {
  if (!msg) return 'An unexpected error occurred while communicating with Gemini.';
  let out = msg;
  if (apiKey) {
    out = out.split(apiKey).join('[REDACTED_API_KEY]');
  }
  return out.replace(/AIza[0-9A-Za-z\-_]{20,50}/g, '[REDACTED_API_KEY]');
}

function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization || '';
  const { status, body } = invokePythonAuthDb('me', { token: authHeader });
  if (status !== 200 || !body.user) {
    res.status(status).json(body);
    return;
  }
  (req as any).authSession = body as AuthSessionPayload;
  next();
}

function requireRoles(...allowedRoles: Array<'admin' | 'faculty' | 'student'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    requireAuth(req, res, () => {
      const session = (req as any).authSession as AuthSessionPayload;
      if (!allowedRoles.includes(session.user.role)) {
        res.status(403).json({
          detail: `Access denied: Role '${session.user.role.toUpperCase()}' is not authorized for this endpoint. Required role(s): ${allowedRoles
            .map((r) => r.toUpperCase())
            .join(', ')}.`,
        });
        return;
      }
      next();
    });
  };
}

async function startServer() {
  // Ensure SQLite database and seed accounts are initialized on startup
  invokePythonAuthDb('me', { token: '' });

  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // ============================================================================
  // 1. AUTHENTICATION ENDPOINTS (Backed by SQLite `backend/studentsuccess.db`)
  // ============================================================================

  app.post('/auth/login', (req: Request, res: Response) => {
    const { email, password, role, rememberMe } = req.body || {};
    const { status, body } = invokePythonAuthDb('login', {
      email,
      password,
      role,
      rememberMe: Boolean(rememberMe),
    });
    res.status(status).json(body);
  });

  app.post('/auth/firebase-login', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization || '';
    const { idToken, role, rememberMe } = req.body || {};
    const effectiveToken = authHeader || idToken || '';
    const { status, body } = invokePythonAuthDb('firebase-login', {
      idToken: effectiveToken,
      role,
      rememberMe: Boolean(rememberMe),
    });
    res.status(status).json(body);
  });

  app.post('/auth/logout', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization || '';
    const { status, body } = invokePythonAuthDb('logout', { token: authHeader });
    res.status(status).json(body);
  });

  app.get('/auth/me', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization || '';
    const { status, body } = invokePythonAuthDb('me', { token: authHeader });
    res.status(status).json(body);
  });

  app.post('/auth/forgot-password', (req: Request, res: Response) => {
    const { email, role } = req.body || {};
    const { status, body } = invokePythonAuthDb('forgot-password', { email, role });
    res.status(status).json(body);
  });

  // ============================================================================
  // 2. HEALTH & GEMINI AI STATUS ENDPOINTS
  // ============================================================================

  app.get('/health', (_req: Request, res: Response) => {
    const geminiConfigured = getValidatedGeminiKey() !== null;
    res.json({
      status: 'ok',
      service: 'StudentSuccess AI Backend (SQLite Auth + Analytics API)',
      engine: 'Python SQLite Auth (`backend/auth_db.py`) · FastAPI-Compatible API',
      activeStudentsCount: activeStudentStore.length,
      geminiConfigured,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/ai/status', (_req: Request, res: Response) => {
    const configured = getValidatedGeminiKey() !== null;
    res.json({
      configured,
      service: 'Google Gen AI SDK (Server-Side)',
      model: 'gemini-3.8-flash',
      message: configured
        ? 'GEMINI_API_KEY is securely configured on the backend.'
        : 'GEMINI_API_KEY is not configured or is set to a placeholder in .env.',
    });
  });

  // ============================================================================
  // 3. ROLE-PROTECTED STUDENT & ANALYTICS ENDPOINTS
  // ============================================================================

  app.get('/api/students', requireAuth, (req: Request, res: Response) => {
    syncSqliteStudentsIntoMemory();
    const session = (req as any).authSession as AuthSessionPayload;
    const enrichedAll = enrichStudentDataset(
      activeStudentStore,
      DEFAULT_RISK_THRESHOLDS
    );

    // Student role isolation: Students only receive their own academic record
    if (session.user.role === 'student') {
      const ownId = (session.user.linkedStudentId || '').trim().toUpperCase();
      const ownOnly = enrichedAll.filter(
        (s) => s.studentId.toUpperCase() === ownId
      );
      res.json(ownOnly);
      return;
    }

    let filtered = enrichedAll;
    const { department, academic_risk, placement_risk, segment, search } = req.query;

    if (typeof department === 'string' && department !== 'ALL') {
      filtered = filtered.filter((s) => s.department === department);
    }
    if (typeof academic_risk === 'string' && academic_risk !== 'ALL') {
      filtered = filtered.filter((s) => s.academicRisk.level === academic_risk);
    }
    if (typeof placement_risk === 'string' && placement_risk !== 'ALL') {
      filtered = filtered.filter((s) => s.placementRisk.level === placement_risk);
    }
    if (typeof segment === 'string' && segment !== 'ALL') {
      filtered = filtered.filter((s) => s.segment.id === segment);
    }
    if (typeof search === 'string' && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.studentId.toLowerCase().includes(q)
      );
    }

    res.json(filtered);
  });

  app.get('/api/students/:studentId', requireAuth, (req: Request, res: Response) => {
    syncSqliteStudentsIntoMemory();
    const session = (req as any).authSession as AuthSessionPayload;
    const targetId = (req.params.studentId || '').trim().toUpperCase();

    // Enforce Student record ownership isolation
    if (session.user.role === 'student') {
      const ownId = (session.user.linkedStudentId || '').trim().toUpperCase();
      if (ownId !== targetId) {
        res.status(403).json({
          detail: `Access denied: Student account (${session.user.email}) is only authorized to access academic record '${ownId}', not '${targetId}'.`,
        });
        return;
      }
    }

    const found = activeStudentStore.find(
      (s) => s.studentId.toUpperCase() === targetId
    );
    if (!found) {
      res.status(404).json({
        detail: `Student with ID '${req.params.studentId}' was not found in the active dataset.`,
      });
      return;
    }

    // Enforce Faculty scope: assigned mentee or same department
    if (session.user.role === 'faculty') {
      const facId = (session.user.linkedFacultyId || '').trim().toUpperCase();
      const facDept = (session.user.department || '').trim().toLowerCase();
      const matchesMentor =
        Boolean(facId) && found.assignedFacultyId.trim().toUpperCase() === facId;
      const matchesDept =
        Boolean(facDept) && found.department.trim().toLowerCase() === facDept;
      if (!matchesMentor && !matchesDept) {
        res.status(403).json({
          detail: `Access denied: Faculty member (${session.user.email}) is not authorized to access student '${targetId}' outside their assigned mentees or department.`,
        });
        return;
      }
    }

    res.json(enrichStudentDataset([found], DEFAULT_RISK_THRESHOLDS)[0]);
  });

  // ============================================================================
  // 3B. ADMIN DYNAMIC USER MANAGEMENT ENDPOINTS (Protected by requireRoles('admin'))
  // ============================================================================

  app.get(
    '/api/admin/users',
    requireRoles('admin'),
    (req: Request, res: Response) => {
      const { search, role, status } = req.query;
      const result = invokePythonAuthDb('list-users', {
        search: typeof search === 'string' ? search : undefined,
        role: typeof role === 'string' ? role : undefined,
        status: typeof status === 'string' ? status : undefined,
      });
      res.status(result.status).json(result.body);
    }
  );

  app.post(
    '/api/admin/users',
    requireRoles('admin'),
    (req: Request, res: Response) => {
      const session = (req as any).authSession as AuthSessionPayload;
      const result = invokePythonAuthDb('provision-user', {
        actor: session.user,
        data: req.body || {},
      });
      if (result.status === 201 || result.status === 200) {
        syncSqliteStudentsIntoMemory();
      }
      res.status(result.status).json(result.body);
    }
  );

  app.put(
    '/api/admin/users/:userId',
    requireRoles('admin'),
    (req: Request, res: Response) => {
      const session = (req as any).authSession as AuthSessionPayload;
      const result = invokePythonAuthDb('update-user', {
        actor: session.user,
        userId: req.params.userId,
        data: req.body || {},
      });
      if (result.status === 200) {
        syncSqliteStudentsIntoMemory();
      }
      res.status(result.status).json(result.body);
    }
  );

  app.patch(
    '/api/admin/users/:userId/status',
    requireRoles('admin'),
    (req: Request, res: Response) => {
      const session = (req as any).authSession as AuthSessionPayload;
      const result = invokePythonAuthDb('set-user-status', {
        actor: session.user,
        userId: req.params.userId,
        isActive: Boolean(req.body?.isActive),
      });
      res.status(result.status).json(result.body);
    }
  );

  app.post(
    '/api/analyze',
    requireRoles('admin', 'faculty'),
    (req: Request, res: Response) => {
      const studentsInput = Array.isArray(req.body?.students)
        ? (req.body.students as StudentRecord[])
        : activeStudentStore;
      const thresholds: RiskThresholds =
        req.body?.thresholds || DEFAULT_RISK_THRESHOLDS;

      const enriched = enrichStudentDataset(studentsInput, thresholds);
      const total = enriched.length;
      const avgScore =
        total > 0
          ? enriched.reduce((a, b) => a + b.scoreBreakdown.overallScore, 0) / total
          : 0;
      const avgCgpa =
        total > 0 ? enriched.reduce((a, b) => a + b.cgpa, 0) / total : 0;
      const avgAtt =
        total > 0 ? enriched.reduce((a, b) => a + b.attendance, 0) / total : 0;
      const avgPlacement =
        total > 0
          ? enriched.reduce(
              (a, b) => a + b.scoreBreakdown.components.placementReadiness,
              0
            ) / total
          : 0;

      res.json({
        summary: {
          totalStudents: total,
          averageSuccessScore: Number(avgScore.toFixed(1)),
          averageCgpa: Number(avgCgpa.toFixed(2)),
          averageAttendance: Number(avgAtt.toFixed(1)),
          averagePlacementReadiness: Number(avgPlacement.toFixed(1)),
          academicHighRiskCount: enriched.filter(
            (s) => s.academicRisk.level === 'High Risk'
          ).length,
          academicMediumRiskCount: enriched.filter(
            (s) => s.academicRisk.level === 'Medium Risk'
          ).length,
          placementHighRiskCount: enriched.filter(
            (s) => s.placementRisk.level === 'High Risk'
          ).length,
          placementMediumRiskCount: enriched.filter(
            (s) => s.placementRisk.level === 'Medium Risk'
          ).length,
          immediateAttentionCount: enriched.filter(
            (s) => s.requiresImmediateAttention
          ).length,
        },
        students: enriched,
      });
    }
  );

  app.post(
    '/api/ai/recommendations',
    requireAuth,
    async (req: Request, res: Response) => {
      const session = (req as any).authSession as AuthSessionPayload;
      const studentInput = req.body?.student as StudentRecord | undefined;
      const focusArea = req.body?.focusArea as string | undefined;

      if (!studentInput || !studentInput.studentId) {
        res.status(400).json({ detail: 'Valid student record is required.' });
        return;
      }

      // Enforce student ownership isolation
      if (session.user.role === 'student') {
        const ownId = (session.user.linkedStudentId || '').trim().toUpperCase();
        if (ownId !== studentInput.studentId.trim().toUpperCase()) {
          res.status(403).json({
            detail: `Access denied: Students may only request AI recommendations for their own record (${ownId}).`,
          });
          return;
        }
      }

      const apiKey = getValidatedGeminiKey();
      if (!apiKey) {
        res.status(503).json({
          detail:
            'Gemini AI service is not configured on the backend. Set a valid GEMINI_API_KEY in your backend .env file or hosting environment secrets.',
        });
        return;
      }

      const enriched = enrichStudentDataset([studentInput], DEFAULT_RISK_THRESHOLDS)[0];
      const academicFactors =
        enriched.academicRisk.factors
          .map((f: RiskFactorDetail) => `${f.indicator} (${f.observedValue})`)
          .join('; ') || 'None (meets all academic thresholds)';
      const placementFactors =
        enriched.placementRisk.factors
          .map((f: RiskFactorDetail) => `${f.indicator} (${f.observedValue})`)
          .join('; ') || 'None (meets all placement thresholds)';

      const prompt = `
Analyze the following university student record from StudentSuccess AI and generate a grounded,
evidence-based performance analysis and personalized improvement plan.

Student Profile:
- Student ID: ${enriched.studentId}
- Name: ${enriched.name}
- Department: ${enriched.department} (Academic Year ${enriched.academicYear})
- Overall Student Success Score: ${enriched.scoreBreakdown.overallScore}/100
- Assigned Segment: ${enriched.segment.label} (${enriched.segment.ruleMatched})
- Requested Focus Area: ${focusArea || 'Comprehensive Academic & Placement Improvement'}

Component Scores (0-100 scale):
- Academic Performance (30% weight): ${enriched.scoreBreakdown.components.academicPerformance}/100 (CGPA: ${enriched.cgpa}/10.0, Active Backlogs: ${enriched.backlogs})
- Attendance (20% weight): ${enriched.scoreBreakdown.components.attendance}%
- Placement Readiness (25% weight): ${enriched.scoreBreakdown.components.placementReadiness}/100 (Coding: ${enriched.codingScore}, Aptitude: ${enriched.aptitudeScore}, Communication: ${enriched.communicationScore}, Mock Interview: ${enriched.mockInterviewScore})
- LMS & Assignments (10% weight): ${enriched.scoreBreakdown.components.lmsActivity}/100
- Skills & Engagement (15% weight): ${enriched.scoreBreakdown.components.skillsAndEngagement}/100

Independent Risk Assessments:
- Academic Risk: ${enriched.academicRisk.level} — Factors: ${academicFactors}
- Placement Risk: ${enriched.placementRisk.level} — Factors: ${placementFactors}

Return a JSON object with these exact keys:
- "executiveSummary": A concise 2-3 sentence summary referencing the student's actual scores.
- "academicAnalysis": Specific diagnostic commentary on CGPA, backlogs, attendance, and LMS coursework.
- "placementAnalysis": Specific diagnostic commentary on coding, aptitude, communication, and mock interviews.
- "prioritizedActions": Array of 3 to 4 concrete, measurable intervention steps.
- "weeklyStudyPlan": Array of 3 to 4 structured weekly study/practice blocks.
`.trim();

      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            systemInstruction:
              'You are an academic advisor and campus placement analytics specialist. Base every recommendation strictly on the provided numeric student indicators. Always respond with valid JSON.',
            responseMimeType: 'application/json',
            temperature: 0.3,
          },
        });

        const rawText = (response.text || '').trim();
        const parsed = JSON.parse(rawText);

        res.json({
          studentId: enriched.studentId,
          studentName: enriched.name,
          modelUsed: 'gemini-3.8-flash',
          generatedAt: new Date().toISOString(),
          executiveSummary: String(
            parsed.executiveSummary ||
              'Personalized analysis generated from current student indicators.'
          ),
          academicAnalysis: String(
            parsed.academicAnalysis || enriched.academicRisk.summaryExplanation
          ),
          placementAnalysis: String(
            parsed.placementAnalysis || enriched.placementRisk.summaryExplanation
          ),
          prioritizedActions: Array.isArray(parsed.prioritizedActions)
            ? parsed.prioritizedActions.map(String).slice(0, 5)
            : enriched.interventions.map((i: InterventionItem) => i.recommendedAction),
          weeklyStudyPlan: Array.isArray(parsed.weeklyStudyPlan)
            ? parsed.weeklyStudyPlan.map(String).slice(0, 5)
            : [
                'Mon/Wed: 90 mins core subject problem sets & backlog review',
                'Tue/Thu: 60 mins timed DSA coding & quantitative aptitude drills',
                'Friday: 45 mins mock interview & communication practice with mentor',
              ],
        });
      } catch (err) {
        const safeErr = sanitizeErrorMessage(
          err instanceof Error ? err.message : String(err),
          apiKey
        );
        res.status(502).json({
          detail: `Gemini API request failed: ${safeErr}`,
        });
      }
    }
  );

  // ============================================================================
  // 4. VITE MIDDLEWARE / SPA FALLBACK FOR CLIENT ROUTES (/admin/dashboard, etc.)
  // ============================================================================

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: process.env.DISABLE_HMR === 'true' ? null : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StudentSuccess AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
