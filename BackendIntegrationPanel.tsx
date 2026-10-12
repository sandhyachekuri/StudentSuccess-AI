import React, { useState } from 'react';
import {
  Server,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Play,
  Terminal,
  Search,
} from 'lucide-react';
import {
  analyzeCohortViaBackend,
  BackendAnalyzeResponse,
  BackendConnectionState,
  BackendHealthResponse,
  checkBackendAiStatus,
  checkBackendHealth,
  fetchStudentByIdFromBackend,
  fetchStudentsFromBackend,
  getConfiguredApiBaseUrl,
} from '../services/apiClient';
import { EnrichedStudent, RiskThresholds, StudentRecord } from '../types/student';

interface BackendIntegrationPanelProps {
  apiBaseUrl: string;
  onChangeApiBaseUrl: (url: string) => void;
  connectionState: BackendConnectionState;
  healthInfo: BackendHealthResponse | null;
  lastError: string | null;
  onCheckHealth: () => Promise<void>;
  onSyncStudentsFromBackend: (records: StudentRecord[]) => void;
  activeStudents: StudentRecord[];
  thresholds: RiskThresholds;
}

export const BackendIntegrationPanel: React.FC<BackendIntegrationPanelProps> = ({
  apiBaseUrl,
  onChangeApiBaseUrl,
  connectionState,
  healthInfo,
  lastError,
  onCheckHealth,
  onSyncStudentsFromBackend,
  activeStudents,
  thresholds,
}) => {
  const [isLoadingAction, setIsLoadingAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [singleStudentId, setSingleStudentId] = useState('STU-2026-001');
  const [singleStudentResult, setSingleStudentResult] =
    useState<EnrichedStudent | null>(null);
  const [analyzeSummary, setAnalyzeSummary] = useState<
    BackendAnalyzeResponse['summary'] | null
  >(null);

  const effectiveUrl = getConfiguredApiBaseUrl(apiBaseUrl);

  const handleFetchAllStudents = async () => {
    setIsLoadingAction('fetch-all');
    setActionMessage(null);
    try {
      const students = await fetchStudentsFromBackend(undefined, effectiveUrl);
      onSyncStudentsFromBackend(students);
      setActionMessage({
        type: 'success',
        text: `GET /api/students succeeded: Loaded ${students.length} enriched student records from Python FastAPI.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionMessage({
        type: 'error',
        text: `GET /api/students failed (${msg}). Continuing with local synthetic dataset fallback.`,
      });
    } finally {
      setIsLoadingAction(null);
    }
  };

  const handleFetchSingleStudent = async () => {
    if (!singleStudentId.trim()) return;
    setIsLoadingAction('fetch-one');
    setActionMessage(null);
    setSingleStudentResult(null);
    try {
      const result = await fetchStudentByIdFromBackend(
        singleStudentId.trim(),
        effectiveUrl
      );
      setSingleStudentResult(result);
      setActionMessage({
        type: 'success',
        text: `GET /api/students/${singleStudentId.trim()} succeeded: Score ${result.scoreBreakdown.overallScore.toFixed(
          1
        )}/100 (${result.academicRisk.level} Academic · ${result.placementRisk.level} Placement).`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionMessage({
        type: 'error',
        text: `GET /api/students/${singleStudentId.trim()} failed: ${msg}`,
      });
    } finally {
      setIsLoadingAction(null);
    }
  };

  const handleRunBackendAnalyze = async () => {
    setIsLoadingAction('analyze');
    setActionMessage(null);
    setAnalyzeSummary(null);
    try {
      const response = await analyzeCohortViaBackend(
        activeStudents,
        thresholds,
        effectiveUrl
      );
      setAnalyzeSummary(response.summary);
      setActionMessage({
        type: 'success',
        text: `POST /api/analyze succeeded: Validated & scored ${response.summary.totalStudents} records via FastAPI + Pandas + NumPy (Avg Score: ${response.summary.averageSuccessScore}/100).`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionMessage({
        type: 'error',
        text: `POST /api/analyze failed (${msg}). Local TypeScript engine remains active.`,
      });
    } finally {
      setIsLoadingAction(null);
    }
  };

  const handleCheckAiStatus = async () => {
    setIsLoadingAction('ai-status');
    setActionMessage(null);
    try {
      const status = await checkBackendAiStatus(effectiveUrl);
      setActionMessage({
        type: status.configured ? 'success' : 'info',
        text: `GET /api/ai/status (${status.model}): ${status.message}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionMessage({
        type: 'error',
        text: `GET /api/ai/status failed (${msg}). Ensure FastAPI is running on port 8000.`,
      });
    } finally {
      setIsLoadingAction(null);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Python FastAPI Backend Integration & Live Endpoint Console
            </h2>
          </div>
          <p className="text-xs text-slate-600">
            Test live calls to <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">GET /health</code>,{' '}
            <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">GET /api/students</code>,{' '}
            <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">GET /api/students/&#123;id&#125;</code>,{' '}
            <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">POST /api/analyze</code>, and{' '}
            <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">POST /api/upload-csv</code>. When FastAPI is not running, the app automatically uses the built-in synthetic dataset.
          </p>
        </div>

        {/* Honest Connection Status Indicator */}
        <div className="flex items-center gap-2 shrink-0">
          {connectionState === 'connected' ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>FastAPI Connected ({healthInfo?.activeStudentsCount ?? 56} records)</span>
            </span>
          ) : connectionState === 'checking' ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
              <span>Checking FastAPI /health...</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>
                {connectionState === 'unavailable'
                  ? 'FastAPI Offline — Local Synthetic Fallback Active'
                  : 'FastAPI Not Launched — Local Synthetic Cohort Active'}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Base URL Configuration & Health Check */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
        <div className="lg:col-span-5">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Configured API Base URL (<code className="font-mono">VITE_API_BASE_URL</code>)
          </label>
          <input
            type="url"
            value={apiBaseUrl}
            onChange={(e) => onChangeApiBaseUrl(e.target.value)}
            placeholder="http://localhost:8000"
            className="w-full font-mono text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
          />
        </div>

        <div className="lg:col-span-7 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onCheckHealth}
            disabled={connectionState === 'checking'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                connectionState === 'checking' ? 'animate-spin' : ''
              }`}
            />
            <span>GET /health</span>
          </button>

          <button
            type="button"
            onClick={handleFetchAllStudents}
            disabled={isLoadingAction !== null}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 text-blue-600" />
            <span>
              {isLoadingAction === 'fetch-all'
                ? 'Loading...'
                : 'GET /api/students (Sync Cohort)'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleRunBackendAnalyze}
            disabled={isLoadingAction !== null}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 text-violet-600" />
            <span>
              {isLoadingAction === 'analyze'
                ? 'Analyzing...'
                : `POST /api/analyze (${activeStudents.length} records)`}
            </span>
          </button>

          <button
            type="button"
            onClick={handleCheckAiStatus}
            disabled={isLoadingAction !== null}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {isLoadingAction === 'ai-status'
                ? 'Checking AI...'
                : 'GET /api/ai/status (Gemini Key Check)'}
            </span>
          </button>
        </div>
      </div>

      {/* Single Student Endpoint Test Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-medium text-slate-700 whitespace-nowrap">
            Test Single Student Endpoint:
          </span>
          <input
            type="text"
            value={singleStudentId}
            onChange={(e) => setSingleStudentId(e.target.value)}
            placeholder="STU-2026-001"
            className="font-mono text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 w-40"
          />
          <button
            type="button"
            onClick={handleFetchSingleStudent}
            disabled={isLoadingAction !== null}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            {isLoadingAction === 'fetch-one'
              ? 'Fetching...'
              : `GET /api/students/${singleStudentId || '{id}'}`}
          </button>
        </div>

        {singleStudentResult && (
          <div className="text-xs font-mono text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
            <strong>{singleStudentResult.name}</strong> · Score:{' '}
            <strong className="text-blue-600">
              {singleStudentResult.scoreBreakdown.overallScore.toFixed(1)}
            </strong>{' '}
            · Segment: {singleStudentResult.segment.label}
          </div>
        )}
      </div>

      {/* Status / Error / Result Feedback */}
      {(lastError || actionMessage || analyzeSummary) && (
        <div className="space-y-2">
          {lastError && connectionState === 'unavailable' && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <strong>FastAPI Health Check Notice:</strong> Could not reach{' '}
              <code className="font-mono">{effectiveUrl}/health</code> ({lastError}). Start the Python FastAPI server using the commands below to enable live API calls. Until then, the local TypeScript calculation engine and 56-student synthetic dataset remain fully operational.
            </div>
          )}

          {actionMessage && (
            <div
              className={`p-3 rounded-lg border text-xs ${
                actionMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : actionMessage.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              {actionMessage.text}
            </div>
          )}

          {analyzeSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs">
                <div className="text-slate-500">Analyzed Cohort</div>
                <div className="font-mono font-bold text-slate-900 mt-0.5">
                  {analyzeSummary.totalStudents} students
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs">
                <div className="text-slate-500">Avg Success Score</div>
                <div className="font-mono font-bold text-blue-600 mt-0.5">
                  {analyzeSummary.averageSuccessScore.toFixed(1)} / 100
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs">
                <div className="text-slate-500">Academic High Risk</div>
                <div className="font-mono font-bold text-red-600 mt-0.5">
                  {analyzeSummary.academicHighRiskCount}
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs">
                <div className="text-slate-500">Placement High Risk</div>
                <div className="font-mono font-bold text-violet-600 mt-0.5">
                  {analyzeSummary.placementHighRiskCount}
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs">
                <div className="text-slate-500">Immediate Attention</div>
                <div className="font-mono font-bold text-slate-900 mt-0.5">
                  {analyzeSummary.immediateAttentionCount}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Local Setup & Run Commands Reference */}
      <div className="bg-slate-900 text-slate-100 rounded-xl p-4 space-y-2 text-xs">
        <div className="flex items-center justify-between text-slate-300 font-semibold">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-blue-400" />
            <span>How to Run the Python FastAPI Backend Locally</span>
          </div>
          <span className="font-mono text-[11px] text-slate-400">
            /backend/main.py · requirements.txt
          </span>
        </div>
        <pre className="font-mono text-[11px] text-slate-200 overflow-x-auto leading-relaxed">
{`python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload`}
        </pre>
      </div>
    </section>
  );
};
