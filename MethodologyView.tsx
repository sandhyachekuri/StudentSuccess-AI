import React from 'react';
import {
  BookOpen,
  Calculator,
  AlertTriangle,
  Layers,
  Database,
  ShieldAlert,
  RotateCcw,
  Server,
} from 'lucide-react';
import { RiskThresholds, StudentRecord } from '../types/student';
import {
  DEFAULT_RISK_THRESHOLDS,
  SEGMENT_DEFINITIONS,
} from '../engine/analyticsEngine';
import { PLANNED_ARCHITECTURE_SERVICES } from '../services/dataService';
import {
  BackendConnectionState,
  BackendHealthResponse,
} from '../services/apiClient';
import { BackendIntegrationPanel } from './BackendIntegrationPanel';

interface MethodologyViewProps {
  thresholds: RiskThresholds;
  onUpdateThresholds: (newThresholds: RiskThresholds) => void;
  onResetThresholds: () => void;
  apiBaseUrl: string;
  onChangeApiBaseUrl: (url: string) => void;
  backendConnectionState: BackendConnectionState;
  backendHealthInfo: BackendHealthResponse | null;
  backendLastError: string | null;
  onCheckBackendHealth: () => Promise<void>;
  onSyncStudentsFromBackend: (records: StudentRecord[]) => void;
  activeStudents: StudentRecord[];
}

export const MethodologyView: React.FC<MethodologyViewProps> = ({
  thresholds,
  onUpdateThresholds,
  onResetThresholds,
  apiBaseUrl,
  onChangeApiBaseUrl,
  backendConnectionState,
  backendHealthInfo,
  backendLastError,
  onCheckBackendHealth,
  onSyncStudentsFromBackend,
  activeStudents,
}) => {
  const handleAcademicChange = (
    key: keyof RiskThresholds['academic'],
    value: number
  ) => {
    onUpdateThresholds({
      ...thresholds,
      academic: {
        ...thresholds.academic,
        [key]: value,
      },
    });
  };

  const handlePlacementChange = (
    key: keyof RiskThresholds['placement'],
    value: number
  ) => {
    onUpdateThresholds({
      ...thresholds,
      placement: {
        ...thresholds.placement,
        [key]: value,
      },
    });
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <div className="text-xs font-medium text-blue-600">
          KPMG in India — HacXLerate 2026 · System Specification & Transparency Documentation
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
          Analytical Methodology, Risk Rules & Target Architecture
        </h1>
        <p className="text-sm text-slate-600 mt-1 max-w-3xl">
          Complete technical specification of the Student Success Score formula, independent Academic and Placement risk thresholds, cohort segmentation rules, and the modular integration architecture.
        </p>
      </div>

      {/* 1. Problem Statement & Integrated Data Categories */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">
            01. Problem Statement & Unified Student Data Categories
          </h2>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Higher education institutions often store student records in disconnected silos—registrar transcripts in ERP databases, attendance in department spreadsheets, LMS logs in courseware, and mock interview or coding scores in placement cell trackers. As a result, high-CGPA students who lack coding or communication skills fail placement drives unexpectedly, while students with early attendance drops accumulate backlogs before faculty mentors are alerted.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
          {[
            {
              pillar: 'Academic Performance',
              weight: '30% Weight',
              fields: 'CGPA (0–10 scale), Active Backlog Count, Multi-Semester SGPA Trajectory',
            },
            {
              pillar: 'Attendance Compliance',
              weight: '20% Weight',
              fields: 'Overall Attendance Percentage (0–100%) relative to 75% statutory requirement',
            },
            {
              pillar: 'Placement Readiness',
              weight: '25% Weight',
              fields: 'Coding Assessment (30%), Aptitude (25%), Communication (20%), Mock Interview (25%)',
            },
            {
              pillar: 'LMS & Coursework',
              weight: '10% Weight',
              fields: 'LMS Portal Activity Score (50%) and Timely Assignment Completion % (50%)',
            },
            {
              pillar: 'Skills & Engagement',
              weight: '15% Weight',
              fields: 'Domain Technical Skill Score (65%) and Extracurricular Engagement (35%)',
            },
          ].map((item) => (
            <div
              key={item.pillar}
              className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5"
            >
              <div className="text-xs font-bold text-slate-900">{item.pillar}</div>
              <div className="text-xs font-mono font-semibold text-blue-600">{item.weight}</div>
              <p className="text-[11px] text-slate-600 leading-normal">{item.fields}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Student Success Score Formula */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <Calculator className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">
            02. Student Success Score Formula & Normalization (0–100 Scale)
          </h2>
        </div>

        <p className="text-xs text-slate-600">
          Every raw indicator is normalized and clamped to a bounded <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">[0, 100]</code> scale prior to applying the weighted linear combination:
        </p>

        <div className="bg-slate-900 text-slate-100 font-mono text-xs rounded-xl p-4 space-y-2 overflow-x-auto">
          <div>
            AcademicScore = clamp((CGPA × 10) - min(40, Backlogs × 8), 0, 100)
          </div>
          <div>AttendanceScore = clamp(AttendancePercentage, 0, 100)</div>
          <div>
            PlacementScore = clamp(0.30 × Coding + 0.25 × Aptitude + 0.20 × Communication + 0.25 × MockInterview, 0, 100)
          </div>
          <div>
            LMSScore = clamp(0.50 × LMSActivity + 0.50 × AssignmentCompletion, 0, 100)
          </div>
          <div>
            SkillsScore = clamp(0.65 × TechnicalSkill + 0.35 × Extracurricular, 0, 100)
          </div>
          <div className="pt-2 border-t border-slate-700 text-blue-300 font-bold">
            StudentSuccessScore = 0.30 × AcademicScore + 0.20 × AttendanceScore + 0.25 × PlacementScore + 0.10 × LMSScore + 0.15 × SkillsScore
          </div>
        </div>
      </section>

      {/* 3. Configurable Independent Academic & Placement Risk Rules */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                03. Separate Academic & Placement Risk Rules (Interactive Threshold Configuration)
              </h2>
              <p className="text-xs text-slate-500">
                Each indicator triggers +2 risk points if below the Critical threshold, or +1 risk point if below the Warning threshold. Total points &ge; 4 (or 2+ critical factors) = High Risk; 1–3 points = Medium Risk; 0 points = Low Risk.
              </p>
            </div>
          </div>

          <button
            onClick={onResetThresholds}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0 self-start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Default Thresholds</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Academic Threshold Controls */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-900">
              Academic Risk Thresholds (Live Configurable)
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1">CGPA Critical (&lt;)</label>
                <input
                  type="number"
                  step="0.1"
                  min={4.0}
                  max={9.0}
                  value={thresholds.academic.cgpaCritical}
                  onChange={(e) =>
                    handleAcademicChange('cgpaCritical', Number(e.target.value))
                  }
                  className="w-full font-mono bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">CGPA Warning (&lt;)</label>
                <input
                  type="number"
                  step="0.1"
                  min={4.5}
                  max={9.5}
                  value={thresholds.academic.cgpaWarning}
                  onChange={(e) =>
                    handleAcademicChange('cgpaWarning', Number(e.target.value))
                  }
                  className="w-full font-mono bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Attendance Critical % (&lt;)</label>
                <input
                  type="number"
                  min={40}
                  max={90}
                  value={thresholds.academic.attendanceCritical}
                  onChange={(e) =>
                    handleAcademicChange('attendanceCritical', Number(e.target.value))
                  }
                  className="w-full font-mono bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Attendance Warning % (&lt;)</label>
                <input
                  type="number"
                  min={50}
                  max={95}
                  value={thresholds.academic.attendanceWarning}
                  onChange={(e) =>
                    handleAcademicChange('attendanceWarning', Number(e.target.value))
                  }
                  className="w-full font-mono bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                />
              </div>
            </div>
          </div>

          {/* Placement Threshold Controls */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-900">
              Placement Risk Thresholds (Live Configurable)
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1">Coding Critical (&lt;)</label>
                <input
                  type="number"
                  min={20}
                  max={85}
                  value={thresholds.placement.codingCritical}
                  onChange={(e) =>
                    handlePlacementChange('codingCritical', Number(e.target.value))
                  }
                  className="w-full font-mono bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Coding Warning (&lt;)</label>
                <input
                  type="number"
                  min={30}
                  max={90}
                  value={thresholds.placement.codingWarning}
                  onChange={(e) =>
                    handlePlacementChange('codingWarning', Number(e.target.value))
                  }
                  className="w-full font-mono bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Aptitude Critical (&lt;)</label>
                <input
                  type="number"
                  min={20}
                  max={85}
                  value={thresholds.placement.aptitudeCritical}
                  onChange={(e) =>
                    handlePlacementChange('aptitudeCritical', Number(e.target.value))
                  }
                  className="w-full font-mono bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Mock Interview Critical (&lt;)</label>
                <input
                  type="number"
                  min={20}
                  max={85}
                  value={thresholds.placement.mockInterviewCritical}
                  onChange={(e) =>
                    handlePlacementChange('mockInterviewCritical', Number(e.target.value))
                  }
                  className="w-full font-mono bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Segmentation & Intervention Logic */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <Layers className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">
            04. Cohort Segmentation & Rule-Based Intervention Mapping
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(SEGMENT_DEFINITIONS).map(([id, seg]) => (
            <div
              key={id}
              className="border border-slate-200 rounded-lg p-3.5 space-y-1 bg-slate-50/40"
            >
              <div className="text-xs font-bold text-slate-900">{seg.label}</div>
              <p className="text-xs text-slate-600">{seg.shortDescription}</p>
              <div className="text-[11px] font-mono text-blue-700 pt-1">
                Rule: {seg.ruleSpecification}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Live FastAPI Backend Integration Console */}
      <BackendIntegrationPanel
        apiBaseUrl={apiBaseUrl}
        onChangeApiBaseUrl={onChangeApiBaseUrl}
        connectionState={backendConnectionState}
        healthInfo={backendHealthInfo}
        lastError={backendLastError}
        onCheckHealth={onCheckBackendHealth}
        onSyncStudentsFromBackend={onSyncStudentsFromBackend}
        activeStudents={activeStudents}
        thresholds={thresholds}
      />

      {/* 5. Future Backend Integration & Responsibility Matrix */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <Server className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">
            05. Planned Full-Stack Architecture & Database Responsibility Boundaries
          </h2>
        </div>

        <p className="text-xs text-slate-600">
          Pipeline Flow: <strong>React TypeScript Frontend</strong> → <strong>Python FastAPI Backend</strong> → <strong>Pandas / NumPy / scikit-learn Analytics Services</strong> → <strong>Authorized Storage (Firebase Cloud Firestore + MySQL)</strong>.
        </p>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
              <tr>
                <th className="py-2.5 px-3">Subsystem Layer</th>
                <th className="py-2.5 px-3">Technology Stack</th>
                <th className="py-2.5 px-3">Current Prototype State</th>
                <th className="py-2.5 px-3">Defined Responsibility (Zero Redundant Duplication)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {PLANNED_ARCHITECTURE_SERVICES.map((svc) => (
                <tr key={svc.id}>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{svc.name}</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-blue-700">
                    {svc.plannedTechnology}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                    {svc.currentMode}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">{svc.definedResponsibility}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. Synthetic Data & Prototype Limitations Disclosure */}
      <section className="bg-amber-50/70 border border-amber-200 rounded-xl p-5 space-y-2">
        <div className="flex items-center gap-2 text-sm font-bold text-amber-950">
          <ShieldAlert className="w-4 h-4 text-amber-700" />
          <span>06. Synthetic Data Notice & Predictive Validation Requirements</span>
        </div>
        <p className="text-xs text-amber-900 leading-relaxed">
          All 56 built-in student profiles in this prototype are 100% synthetic and deterministically generated for demonstration at KPMG HacXLerate 2026. No real student PII is used. Furthermore, the current Student Success Score and Risk Assessments are transparent, rule-based decision-support indicators—not a trained machine learning prediction model. Before deploying supervised scikit-learn models in production, models must be trained and audited on multi-year historical graduation and placement cohorts, evaluated for precision/recall across departments, and governed by human-in-the-loop faculty review.
        </p>
      </section>
    </div>
  );
};
