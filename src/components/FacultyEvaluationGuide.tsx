import React from 'react';
import {
  BookOpen,
  AlertTriangle,
  Layers,
  CheckCircle2,
  Users,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { RiskThresholds, SegmentId } from '../types/student';
import { SEGMENT_DEFINITIONS } from '../engine/analyticsEngine';

interface FacultyEvaluationGuideProps {
  thresholds: RiskThresholds;
  onNavigateToDashboard?: () => void;
  onNavigateToDirectory?: () => void;
}

export const FacultyEvaluationGuide: React.FC<FacultyEvaluationGuideProps> = ({
  thresholds,
  onNavigateToDashboard,
  onNavigateToDirectory,
}) => {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">
            Faculty Mentor Workspace · Evaluation & Risk Guide
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Student Performance Evaluation & At-Risk Identification Rules
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
            Essential reference for faculty mentors to understand how student performance scores are evaluated, how risk alerts are triggered, and how to identify and support at-risk mentees early.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {onNavigateToDashboard && (
            <button
              onClick={onNavigateToDashboard}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs"
            >
              <span>Back to Mentee Dashboard</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
          {onNavigateToDirectory && (
            <button
              onClick={onNavigateToDirectory}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>Student Directory</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. Evaluation Framework & Pillar Weights */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              01. Student Performance Evaluation Framework (5 Core Pillars)
            </h2>
            <p className="text-xs text-slate-500">
              The Student Success Score (0–100 scale) is a weighted combination of academic, attendance, placement, LMS, and technical indicators.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {[
            {
              title: 'Academic Performance',
              weight: '30% Weight',
              badge: 'Max 30 pts',
              color: 'border-blue-200 bg-blue-50/50 text-blue-900',
              accent: 'text-blue-700',
              formula: 'Score = clamp((CGPA × 10) - (Backlogs × 8), 0, 100)',
              description: 'Evaluates GPA progression adjusted by backlog penalty. Each active backlog deducts 8 points.',
            },
            {
              title: 'Attendance Compliance',
              weight: '20% Weight',
              badge: 'Max 20 pts',
              color: 'border-cyan-200 bg-cyan-50/50 text-cyan-900',
              accent: 'text-cyan-700',
              formula: 'Score = clamp(Attendance%, 0, 100)',
              description: '75% is the mandatory statutory minimum. Early attendance drops predict exam ineligibility and backlogs.',
            },
            {
              title: 'Placement Readiness',
              weight: '25% Weight',
              badge: 'Max 25 pts',
              color: 'border-violet-200 bg-violet-50/50 text-violet-900',
              accent: 'text-violet-700',
              formula: '0.30 Coding + 0.25 Aptitude + 0.20 Comm + 0.25 Interview',
              description: 'Combines DSA coding assessments, quantitative aptitude, verbal communication, and mock interview drills.',
            },
            {
              title: 'LMS & Coursework',
              weight: '10% Weight',
              badge: 'Max 10 pts',
              color: 'border-indigo-200 bg-indigo-50/50 text-indigo-900',
              accent: 'text-indigo-700',
              formula: '0.50 LMS Activity + 0.50 Assignment Completion',
              description: 'Continuous engagement tracking via courseware login frequency and on-time assignment submission rate.',
            },
            {
              title: 'Skills & Engagement',
              weight: '15% Weight',
              badge: 'Max 15 pts',
              color: 'border-emerald-200 bg-emerald-50/50 text-emerald-900',
              accent: 'text-emerald-700',
              formula: '0.65 Technical Skill + 0.35 Extracurricular',
              description: 'Recognizes domain engineering skill badges, hackathon participations, and student club leadership.',
            },
          ].map((pillar) => (
            <div
              key={pillar.title}
              className={`border rounded-xl p-4 space-y-2 flex flex-col justify-between ${pillar.color}`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{pillar.title}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/80 font-bold">
                    {pillar.badge}
                  </span>
                </div>
                <div className={`text-xs font-mono font-bold mt-1 ${pillar.accent}`}>
                  {pillar.weight}
                </div>
                <p className="text-[11px] text-slate-600 mt-1.5 leading-normal">
                  {pillar.description}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-200/80 font-mono text-[10px] text-slate-700">
                {pillar.formula}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. At-Risk Identification Rules & Institutional Thresholds */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              02. Institutional At-Risk Identification Rules (Active Thresholds)
            </h2>
            <p className="text-xs text-slate-500">
              How the system flags students for immediate faculty review. Each indicator contributes risk points based on active institutional policy.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Academic Risk Criteria */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Academic Risk Triggers</h3>
              <span className="text-[11px] font-mono font-medium text-slate-500">
                Policy Enforcement: Institutional
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-white border border-red-200 rounded-lg flex items-start gap-2.5">
                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                  CRITICAL (+2 pts)
                </span>
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-900">
                    CGPA &lt; {thresholds.academic.cgpaCritical} or Attendance &lt; {thresholds.academic.attendanceCritical}%
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Severe risk of academic probation or semester debarment. Requires urgent advisor meeting.
                  </div>
                </div>
              </div>

              <div className="p-3 bg-white border border-amber-200 rounded-lg flex items-start gap-2.5">
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                  WARNING (+1 pt)
                </span>
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-900">
                    CGPA &lt; {thresholds.academic.cgpaWarning} or Attendance &lt; {thresholds.academic.attendanceWarning}%
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Borderline compliance. Student requires weekly attendance check-ins and subject tutoring.
                  </div>
                </div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800">Active Backlog Escalation:</div>
                <div>
                  • 1 Backlog: +1 Academic Risk Point
                  <br />
                  • 2+ Backlogs: +2 Academic Risk Points (Automatic Critical Factor)
                </div>
              </div>
            </div>
          </div>

          {/* Placement Risk Criteria */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Placement Risk Triggers</h3>
              <span className="text-[11px] font-mono font-medium text-slate-500">
                Placement Cell Benchmarks
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-white border border-red-200 rounded-lg flex items-start gap-2.5">
                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                  CRITICAL (+2 pts)
                </span>
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-900">
                    Coding &lt; {thresholds.placement.codingCritical} · Aptitude &lt; {thresholds.placement.aptitudeCritical} · Interview &lt; {thresholds.placement.mockInterviewCritical}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Student fails company technical cutoffs. Direct enrollment into intensive bootcamp required.
                  </div>
                </div>
              </div>

              <div className="p-3 bg-white border border-amber-200 rounded-lg flex items-start gap-2.5">
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                  WARNING (+1 pt)
                </span>
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-900">
                    Coding &lt; {thresholds.placement.codingWarning} · Aptitude &lt; {thresholds.placement.aptitudeWarning} · Interview &lt; {thresholds.placement.mockInterviewWarning}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Moderate readiness. Student needs targeted problem-solving sets and peer mock interviews.
                  </div>
                </div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800">Risk Level Classification:</div>
                <div>
                  • <strong>High Risk</strong>: &ge; 4 Risk Points or 2+ Critical Factors
                  <br />
                  • <strong>Medium Risk</strong>: 1 to 3 Risk Points
                  <br />
                  • <strong>Low Risk</strong>: 0 Risk Points (No trigger conditions met)
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Cohort Segmentation to Identify Specific Needs */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              03. Student Segmentation: Diagnosing Root Causes
            </h2>
            <p className="text-xs text-slate-500">
              Every student is categorized into one of 6 behavioral quadrants to help advisors deliver targeted support rather than generic advice.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {Object.entries(SEGMENT_DEFINITIONS).map(([id, seg]) => (
            <div
              key={id}
              className="border border-slate-200 rounded-xl p-4 space-y-2 bg-slate-50/40 hover:border-blue-400 hover:bg-blue-50/20 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">{seg.label}</span>
                <span className="text-[10px] font-mono text-slate-400">ID: {id}</span>
              </div>
              <p className="text-xs text-slate-600 leading-normal">{seg.shortDescription}</p>
              <div className="pt-2 border-t border-slate-200/80 text-[11px] font-mono text-blue-700">
                Rule: {seg.ruleSpecification}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Faculty Action Protocol */}
      <section className="bg-blue-50/60 border border-blue-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-blue-950">
          <ShieldCheck className="w-4 h-4 text-blue-700" />
          <span>04. Faculty Action Protocol for At-Risk Mentees</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-700">
          <div className="bg-white border border-blue-200 rounded-lg p-3 space-y-1">
            <div className="font-bold text-blue-900">Step 1: Check Watchlist</div>
            <p className="text-[11px] text-slate-600">
              Filter by &quot;Requires Immediate Attention&quot; on your Faculty Workspace.
            </p>
          </div>
          <div className="bg-white border border-blue-200 rounded-lg p-3 space-y-1">
            <div className="font-bold text-blue-900">Step 2: Inspect Drivers</div>
            <p className="text-[11px] text-slate-600">
              Open the student profile to inspect CGPA, attendance, and placement sub-scores.
            </p>
          </div>
          <div className="bg-white border border-blue-200 rounded-lg p-3 space-y-1">
            <div className="font-bold text-blue-900">Step 3: Assign & Track</div>
            <p className="text-[11px] text-slate-600">
              Update intervention status (Planned &rarr; In Progress &rarr; Completed) and log meeting notes.
            </p>
          </div>
          <div className="bg-white border border-blue-200 rounded-lg p-3 space-y-1">
            <div className="font-bold text-blue-900">Step 4: AI Recommendations</div>
            <p className="text-[11px] text-slate-600">
              Generate personalized study and skill roadmaps using Gemini AI in the student drawer.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
