import {
  EnrichedStudent,
  InterventionItem,
  InterventionStatus,
  RiskAssessment,
  RiskFactorDetail,
  RiskLevel,
  RiskThresholds,
  ScoreBreakdown,
  SegmentAssignment,
  SegmentId,
  StudentRecord,
} from '../types/student';
import { FACULTY_MEMBERS } from '../data/syntheticStudents';

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  academic: {
    cgpaCritical: 6.0,
    cgpaWarning: 7.0,
    backlogsCritical: 2,
    backlogsWarning: 1,
    attendanceCritical: 65,
    attendanceWarning: 75,
    assignmentCritical: 60,
    assignmentWarning: 72,
  },
  placement: {
    codingCritical: 50,
    codingWarning: 65,
    aptitudeCritical: 50,
    aptitudeWarning: 65,
    communicationCritical: 50,
    communicationWarning: 65,
    mockInterviewCritical: 50,
    mockInterviewWarning: 65,
  },
};

export const SCORE_WEIGHTS = {
  academicPerformance: 0.30, // 30%
  attendance: 0.20, // 20%
  placementReadiness: 0.25, // 25%
  lmsActivity: 0.10, // 10%
  skillsAndEngagement: 0.15, // 15%
} as const;

/**
 * Safely bounds any numeric value to [min, max], handling NaN/null/undefined.
 */
export function safeBound(value: unknown, min = 0, max = 100, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, num));
}

/**
 * Calculates the transparent, weighted Student Success Score (0 to 100)
 * and all normalized component scores.
 *
 * Prototype Indicator Notice: This is an explicit, rule-based weighted composite
 * indicator for decision support, not a trained or clinically validated predictive model.
 */
export function calculateStudentSuccessScore(student: StudentRecord): ScoreBreakdown {
  // 1. Academic Performance (30% weight)
  // Normalized CGPA (0-10 -> 0-100) minus 8 points per active backlog, bounded [0, 100]
  const validCgpa = safeBound(student.cgpa, 0, 10, 0);
  const validBacklogs = Math.max(0, Math.floor(safeBound(student.backlogs, 0, 20, 0)));
  const normalizedCgpa = validCgpa * 10;
  const backlogPenalty = Math.min(40, validBacklogs * 8);
  const academicPerformance = Number(safeBound(normalizedCgpa - backlogPenalty, 0, 100).toFixed(1));

  // 2. Attendance (20% weight)
  const attendance = Number(safeBound(student.attendance, 0, 100).toFixed(1));

  // 3. Placement Readiness (25% weight)
  // Composite of Coding (30%), Aptitude (25%), Communication (20%), Mock Interview (25%)
  const coding = safeBound(student.codingScore, 0, 100);
  const aptitude = safeBound(student.aptitudeScore, 0, 100);
  const communication = safeBound(student.communicationScore, 0, 100);
  const mockInterview = safeBound(student.mockInterviewScore, 0, 100);
  const placementReadiness = Number(
    safeBound(
      coding * 0.30 + aptitude * 0.25 + communication * 0.20 + mockInterview * 0.25,
      0,
      100
    ).toFixed(1)
  );

  // 4. LMS Activity (10% weight)
  // Equal average of LMS Activity Score (50%) and Assignment Completion % (50%)
  const lmsRaw = safeBound(student.lmsActivity, 0, 100);
  const assignmentsRaw = safeBound(student.assignmentCompletion, 0, 100);
  const lmsActivity = Number(safeBound(lmsRaw * 0.5 + assignmentsRaw * 0.5, 0, 100).toFixed(1));

  // 5. Skills & Engagement (15% weight)
  // Technical Skill Score (65%) + Extracurricular Engagement Score (35%)
  const techSkill = safeBound(student.technicalSkillScore, 0, 100);
  const extraSkill = safeBound(student.extracurricularScore, 0, 100);
  const skillsAndEngagement = Number(
    safeBound(techSkill * 0.65 + extraSkill * 0.35, 0, 100).toFixed(1)
  );

  // Weighted contributions
  const weightedContributions = {
    academicPerformance: Number((academicPerformance * SCORE_WEIGHTS.academicPerformance).toFixed(2)),
    attendance: Number((attendance * SCORE_WEIGHTS.attendance).toFixed(2)),
    placementReadiness: Number((placementReadiness * SCORE_WEIGHTS.placementReadiness).toFixed(2)),
    lmsActivity: Number((lmsActivity * SCORE_WEIGHTS.lmsActivity).toFixed(2)),
    skillsAndEngagement: Number(
      (skillsAndEngagement * SCORE_WEIGHTS.skillsAndEngagement).toFixed(2)
    ),
  };

  const rawTotal =
    weightedContributions.academicPerformance +
    weightedContributions.attendance +
    weightedContributions.placementReadiness +
    weightedContributions.lmsActivity +
    weightedContributions.skillsAndEngagement;

  const overallScore = Number(safeBound(rawTotal, 0, 100).toFixed(1));

  const explanation = `Calculated as ${weightedContributions.academicPerformance.toFixed(1)} pts from Academics (CGPA ${validCgpa.toFixed(1)} → ${normalizedCgpa.toFixed(0)}/100 minus ${backlogPenalty} backlog penalty × 30%) + ${weightedContributions.attendance.toFixed(1)} pts from Attendance (${attendance}% × 20%) + ${weightedContributions.placementReadiness.toFixed(1)} pts from Placement Readiness (${placementReadiness}/100 × 25%) + ${weightedContributions.lmsActivity.toFixed(1)} pts from LMS & Assignments (${lmsActivity}/100 × 10%) + ${weightedContributions.skillsAndEngagement.toFixed(1)} pts from Skills & Engagement (${skillsAndEngagement}/100 × 15%).`;

  return {
    overallScore,
    components: {
      academicPerformance,
      attendance,
      placementReadiness,
      lmsActivity,
      skillsAndEngagement,
    },
    weightedContributions,
    subDetails: {
      normalizedCgpa,
      backlogPenalty,
    },
    explanation,
  };
}

/**
 * Evaluates independent Academic Risk based on explicit configurable thresholds.
 */
export function assessAcademicRisk(
  student: StudentRecord,
  thresholds: RiskThresholds['academic'] = DEFAULT_RISK_THRESHOLDS.academic
): RiskAssessment {
  const factors: RiskFactorDetail[] = [];
  let riskPoints = 0;

  // 1. CGPA Check
  if (student.cgpa < thresholds.cgpaCritical) {
    riskPoints += 2;
    factors.push({
      indicator: 'Low CGPA',
      observedValue: `${student.cgpa.toFixed(2)} / 10.0`,
      thresholdRule: `< ${thresholds.cgpaCritical.toFixed(1)} critical threshold`,
      severity: 'critical',
    });
  } else if (student.cgpa < thresholds.cgpaWarning) {
    riskPoints += 1;
    factors.push({
      indicator: 'Moderate CGPA Warning',
      observedValue: `${student.cgpa.toFixed(2)} / 10.0`,
      thresholdRule: `< ${thresholds.cgpaWarning.toFixed(1)} warning threshold`,
      severity: 'warning',
    });
  }

  // 2. Backlogs Check
  if (student.backlogs >= thresholds.backlogsCritical) {
    riskPoints += 2;
    factors.push({
      indicator: 'Multiple Active Backlogs',
      observedValue: `${student.backlogs} backlogs`,
      thresholdRule: `>= ${thresholds.backlogsCritical} backlogs critical threshold`,
      severity: 'critical',
    });
  } else if (student.backlogs >= thresholds.backlogsWarning) {
    riskPoints += 1;
    factors.push({
      indicator: 'Active Backlog',
      observedValue: `${student.backlogs} backlog`,
      thresholdRule: `>= ${thresholds.backlogsWarning} backlog warning threshold`,
      severity: 'warning',
    });
  }

  // 3. Attendance Check
  if (student.attendance < thresholds.attendanceCritical) {
    riskPoints += 2;
    factors.push({
      indicator: 'Severe Attendance Deficit',
      observedValue: `${student.attendance}%`,
      thresholdRule: `< ${thresholds.attendanceCritical}% critical threshold`,
      severity: 'critical',
    });
  } else if (student.attendance < thresholds.attendanceWarning) {
    riskPoints += 1;
    factors.push({
      indicator: 'Below Mandatory Attendance',
      observedValue: `${student.attendance}%`,
      thresholdRule: `< ${thresholds.attendanceWarning}% statutory threshold`,
      severity: 'warning',
    });
  }

  // 4. Assignment Completion & LMS Engagement
  const academicEngagement = Math.min(student.assignmentCompletion, student.lmsActivity);
  if (student.assignmentCompletion < thresholds.assignmentCritical || academicEngagement < 55) {
    riskPoints += 2;
    factors.push({
      indicator: 'Incomplete Assignments / Weak LMS Engagement',
      observedValue: `${student.assignmentCompletion}% assignments · ${student.lmsActivity}/100 LMS`,
      thresholdRule: `Assignments < ${thresholds.assignmentCritical}% or LMS < 55`,
      severity: 'critical',
    });
  } else if (
    student.assignmentCompletion < thresholds.assignmentWarning ||
    student.lmsActivity < 65
  ) {
    riskPoints += 1;
    factors.push({
      indicator: 'Moderate Assignment / LMS Lag',
      observedValue: `${student.assignmentCompletion}% assignments · ${student.lmsActivity}/100 LMS`,
      thresholdRule: `Assignments < ${thresholds.assignmentWarning}% or LMS < 65`,
      severity: 'warning',
    });
  }

  let level: RiskLevel = 'Low Risk';
  if (riskPoints >= 4 || factors.filter((f) => f.severity === 'critical').length >= 2) {
    level = 'High Risk';
  } else if (riskPoints >= 2 || factors.length >= 1) {
    level = 'Medium Risk';
  }

  const summaryExplanation =
    factors.length === 0
      ? 'Meets all academic performance, attendance, and coursework completion thresholds.'
      : `Flagged as ${level} (${riskPoints} risk points) due to: ${factors
          .map((f) => `${f.indicator} (${f.observedValue})`)
          .join('; ')}.`;

  return {
    level,
    riskPoints,
    factors,
    summaryExplanation,
  };
}

/**
 * Evaluates independent Placement Risk based on explicit configurable thresholds.
 */
export function assessPlacementRisk(
  student: StudentRecord,
  thresholds: RiskThresholds['placement'] = DEFAULT_RISK_THRESHOLDS.placement
): RiskAssessment {
  const factors: RiskFactorDetail[] = [];
  let riskPoints = 0;

  // 1. Coding Score
  if (student.codingScore < thresholds.codingCritical) {
    riskPoints += 2;
    factors.push({
      indicator: 'Low Coding Assessment Score',
      observedValue: `${student.codingScore} / 100`,
      thresholdRule: `< ${thresholds.codingCritical} critical threshold`,
      severity: 'critical',
    });
  } else if (student.codingScore < thresholds.codingWarning) {
    riskPoints += 1;
    factors.push({
      indicator: 'Developing Coding Proficiency',
      observedValue: `${student.codingScore} / 100`,
      thresholdRule: `< ${thresholds.codingWarning} readiness threshold`,
      severity: 'warning',
    });
  }

  // 2. Aptitude Score
  if (student.aptitudeScore < thresholds.aptitudeCritical) {
    riskPoints += 2;
    factors.push({
      indicator: 'Low Quantitative/Analytical Aptitude',
      observedValue: `${student.aptitudeScore} / 100`,
      thresholdRule: `< ${thresholds.aptitudeCritical} critical threshold`,
      severity: 'critical',
    });
  } else if (student.aptitudeScore < thresholds.aptitudeWarning) {
    riskPoints += 1;
    factors.push({
      indicator: 'Moderate Aptitude Readiness',
      observedValue: `${student.aptitudeScore} / 100`,
      thresholdRule: `< ${thresholds.aptitudeWarning} readiness threshold`,
      severity: 'warning',
    });
  }

  // 3. Communication Score
  if (student.communicationScore < thresholds.communicationCritical) {
    riskPoints += 2;
    factors.push({
      indicator: 'Low Professional Communication Score',
      observedValue: `${student.communicationScore} / 100`,
      thresholdRule: `< ${thresholds.communicationCritical} critical threshold`,
      severity: 'critical',
    });
  } else if (student.communicationScore < thresholds.communicationWarning) {
    riskPoints += 1;
    factors.push({
      indicator: 'Moderate Communication Readiness',
      observedValue: `${student.communicationScore} / 100`,
      thresholdRule: `< ${thresholds.communicationWarning} readiness threshold`,
      severity: 'warning',
    });
  }

  // 4. Mock Interview Score
  if (student.mockInterviewScore < thresholds.mockInterviewCritical) {
    riskPoints += 2;
    factors.push({
      indicator: 'Low Mock Interview Performance',
      observedValue: `${student.mockInterviewScore} / 100`,
      thresholdRule: `< ${thresholds.mockInterviewCritical} critical threshold`,
      severity: 'critical',
    });
  } else if (student.mockInterviewScore < thresholds.mockInterviewWarning) {
    riskPoints += 1;
    factors.push({
      indicator: 'Moderate Mock Interview Score',
      observedValue: `${student.mockInterviewScore} / 100`,
      thresholdRule: `< ${thresholds.mockInterviewWarning} readiness threshold`,
      severity: 'warning',
    });
  }

  let level: RiskLevel = 'Low Risk';
  if (riskPoints >= 4 || factors.filter((f) => f.severity === 'critical').length >= 2) {
    level = 'High Risk';
  } else if (riskPoints >= 2 || factors.length >= 1) {
    level = 'Medium Risk';
  }

  const summaryExplanation =
    factors.length === 0
      ? 'Meets all career readiness benchmarks across coding, aptitude, communication, and mock interviews.'
      : `Flagged as ${level} (${riskPoints} risk points) due to: ${factors
          .map((f) => `${f.indicator} (${f.observedValue})`)
          .join('; ')}.`;

  return {
    level,
    riskPoints,
    factors,
    summaryExplanation,
  };
}

export const SEGMENT_DEFINITIONS: Record<
  SegmentId,
  { label: string; shortDescription: string; ruleSpecification: string }
> = {
  balanced_high_performers: {
    label: 'Balanced High Performers',
    shortDescription: 'Strong academic standing, high attendance, and high placement readiness.',
    ruleSpecification:
      'Academic Score >= 75, Placement Readiness >= 75, Attendance >= 80%, and 0 Backlogs.',
  },
  strong_academics_low_placement: {
    label: 'Strong Academics, Low Placement Readiness',
    shortDescription: 'Excels in university coursework and CGPA but lags in coding, aptitude, or interview tests.',
    ruleSpecification:
      'Academic Score >= 72 and CGPA >= 7.5, but Placement Readiness Score < 62.',
  },
  good_placement_weak_academics: {
    label: 'Good Placement Readiness, Weak Academics',
    shortDescription: 'Strong practical coding and interview skills, but low CGPA or active backlogs risk eligibility.',
    ruleSpecification:
      'Placement Readiness >= 70, while Academic Score < 68 or Active Backlogs >= 1.',
  },
  low_attendance_academic_concerns: {
    label: 'Low Attendance with Academic Concerns',
    shortDescription: 'Attendance below 75% coupled with declining coursework completion or CGPA.',
    ruleSpecification:
      'Attendance < 75% and (Academic Score < 70 or Backlogs >= 1 or Assignment Completion < 70%).',
  },
  multi_indicator_support: {
    label: 'Students Needing Multi-Indicator Support',
    shortDescription: 'Concurrent high academic and placement risk requiring coordinated faculty mentoring.',
    ruleSpecification:
      '(High Academic Risk AND High Placement Risk) OR Overall Student Success Score < 58.',
  },
  steady_developing_cohort: {
    label: 'Steady Developing Cohort',
    shortDescription: 'Consistent moderate performers progressing without dual critical risk flags.',
    ruleSpecification:
      'Moderate scores (58–75 range) not triggered by specialized imbalance or multi-crisis rules.',
  },
};

/**
 * Assigns a student to a data-derived segment and returns the exact rule matched.
 */
export function assignStudentSegment(
  student: StudentRecord,
  score: ScoreBreakdown,
  academicRisk: RiskAssessment,
  placementRisk: RiskAssessment
): SegmentAssignment {
  const { academicPerformance, attendance, placementReadiness } = score.components;

  // 1. Multi-Indicator Support Needed (highest urgency)
  if (
    (academicRisk.level === 'High Risk' && placementRisk.level === 'High Risk') ||
    score.overallScore < 58
  ) {
    return {
      id: 'multi_indicator_support',
      label: SEGMENT_DEFINITIONS.multi_indicator_support.label,
      shortDescription: SEGMENT_DEFINITIONS.multi_indicator_support.shortDescription,
      ruleMatched: `Matched because Overall Score is ${score.overallScore} (< 58 threshold) or both Academic Risk (${academicRisk.level}) and Placement Risk (${placementRisk.level}) are High.`,
    };
  }

  // 2. Balanced High Performers
  if (
    academicPerformance >= 75 &&
    placementReadiness >= 75 &&
    attendance >= 80 &&
    student.backlogs === 0
  ) {
    return {
      id: 'balanced_high_performers',
      label: SEGMENT_DEFINITIONS.balanced_high_performers.label,
      shortDescription: SEGMENT_DEFINITIONS.balanced_high_performers.shortDescription,
      ruleMatched: `Matched because Academic Score (${academicPerformance}) >= 75, Placement Readiness (${placementReadiness}) >= 75, Attendance (${attendance}%) >= 80%, and Backlogs = 0.`,
    };
  }

  // 3. Strong Academics, Low Placement Readiness
  if (academicPerformance >= 72 && student.cgpa >= 7.5 && placementReadiness < 62) {
    return {
      id: 'strong_academics_low_placement',
      label: SEGMENT_DEFINITIONS.strong_academics_low_placement.label,
      shortDescription: SEGMENT_DEFINITIONS.strong_academics_low_placement.shortDescription,
      ruleMatched: `Matched because Academic Score (${academicPerformance}) >= 72 & CGPA (${student.cgpa}) >= 7.5, while Placement Readiness (${placementReadiness}) < 62.`,
    };
  }

  // 4. Good Placement Readiness, Weak Academics
  if (placementReadiness >= 70 && (academicPerformance < 68 || student.backlogs >= 1)) {
    return {
      id: 'good_placement_weak_academics',
      label: SEGMENT_DEFINITIONS.good_placement_weak_academics.label,
      shortDescription: SEGMENT_DEFINITIONS.good_placement_weak_academics.shortDescription,
      ruleMatched: `Matched because Placement Readiness (${placementReadiness}) >= 70, while Academic Score (${academicPerformance}) < 68 or Backlogs (${student.backlogs}) >= 1.`,
    };
  }

  // 5. Low Attendance with Academic Concerns
  if (
    attendance < 75 &&
    (academicPerformance < 70 || student.backlogs >= 1 || student.assignmentCompletion < 70)
  ) {
    return {
      id: 'low_attendance_academic_concerns',
      label: SEGMENT_DEFINITIONS.low_attendance_academic_concerns.label,
      shortDescription: SEGMENT_DEFINITIONS.low_attendance_academic_concerns.shortDescription,
      ruleMatched: `Matched because Attendance (${attendance}%) < 75% with Academic Score (${academicPerformance}) < 70 or Backlogs (${student.backlogs}) >= 1.`,
    };
  }

  // 6. Steady Developing Cohort
  return {
    id: 'steady_developing_cohort',
    label: SEGMENT_DEFINITIONS.steady_developing_cohort.label,
    shortDescription: SEGMENT_DEFINITIONS.steady_developing_cohort.shortDescription,
    ruleMatched: `Matched as balanced mid-tier progression (Academic: ${academicPerformance}, Placement: ${placementReadiness}, Attendance: ${attendance}%).`,
  };
}

/**
 * Generates rule-based intervention recommendations from actual student indicators
 * and merges any session status updates from faculty/admin.
 */
export function generateInterventionsForStudent(
  student: StudentRecord,
  statusOverrides: Record<string, { status: InterventionStatus; notes?: string; updatedAt: string }>
): InterventionItem[] {
  const items: InterventionItem[] = [];
  const mentor =
    FACULTY_MEMBERS.find((f) => f.id === student.assignedFacultyId)?.name || 'Assigned Faculty Mentor';

  const buildItem = (
    suffix: string,
    category: InterventionItem['category'],
    title: string,
    reason: string,
    triggerRule: string,
    recommendedAction: string,
    priority: InterventionItem['priority']
  ): InterventionItem => {
    const id = `INT-${student.studentId}-${suffix}`;
    const override = statusOverrides[id];
    return {
      id,
      studentId: student.studentId,
      category,
      title,
      reason,
      triggerRule,
      recommendedAction,
      priority,
      status: override ? override.status : 'Planned',
      notes: override?.notes,
      assignedTo: mentor,
      updatedAt: override ? override.updatedAt : '2026-10-10',
    };
  };

  // Rule 1: Low Attendance (< 75%)
  if (student.attendance < 75) {
    items.push(
      buildItem(
        'ATT',
        'Attendance Follow-Up',
        'Faculty Follow-Up & Attendance Recovery Plan',
        `Overall attendance is ${student.attendance}% (below the 75% mandatory threshold).`,
        'Attendance < 75%',
        'Conduct 1-on-1 advisor counseling, verify medical/personal barriers, and set a weekly 90% attendance target.',
        student.attendance < 65 ? 'High' : 'Medium'
      )
    );
  }

  // Rule 2: Backlogs (> 0) or Low CGPA (< 6.5)
  if (student.backlogs > 0 || student.cgpa < 6.5) {
    items.push(
      buildItem(
        'REM',
        'Remedial Classes',
        'Subject-Specific Remedial Classes & Backlog Clearance',
        `Student has ${student.backlogs} active backlog(s) and a CGPA of ${student.cgpa.toFixed(2)}.`,
        'Backlogs >= 1 or CGPA < 6.5',
        'Enroll in department remedial tutorial batch and pair with a senior peer tutor for supplementary exam preparation.',
        student.backlogs >= 2 || student.cgpa < 6.0 ? 'High' : 'Medium'
      )
    );
  }

  // Rule 3: Low Coding Score (< 65)
  if (student.codingScore < 65) {
    items.push(
      buildItem(
        'COD',
        'Coding Practice',
        'Structured Coding Practice & Data Structures Lab Plan',
        `Coding assessment score is ${student.codingScore}/100, below placement readiness target.`,
        'Coding Score < 65/100',
        'Assign weekly 5-problem algorithmic problem sets and mandatory participation in Friday coding lab.',
        student.codingScore < 50 ? 'High' : 'Medium'
      )
    );
  }

  // Rule 4: Low Aptitude Score (< 65)
  if (student.aptitudeScore < 65) {
    items.push(
      buildItem(
        'APT',
        'Aptitude Training',
        'Quantitative & Logical Aptitude Training Module',
        `Aptitude score is ${student.aptitudeScore}/100, impacting initial screening test clearance.`,
        'Aptitude Score < 65/100',
        'Complete timed quantitative and logical reasoning mock drills twice a week on the campus portal.',
        student.aptitudeScore < 50 ? 'High' : 'Medium'
      )
    );
  }

  // Rule 5: Low Communication or Mock Interview (< 65)
  if (student.communicationScore < 65 || student.mockInterviewScore < 65) {
    items.push(
      buildItem(
        'COM',
        'Communication & Mock Interviews',
        'Communication Clinic & Panel Mock Interviews',
        `Communication (${student.communicationScore}/100) or Mock Interview (${student.mockInterviewScore}/100) is below benchmark.`,
        'Communication < 65 or Mock Interview < 65',
        'Schedule two recorded mock interviews with placement cell feedback and weekly group discussion sessions.',
        student.communicationScore < 50 || student.mockInterviewScore < 50 ? 'High' : 'Medium'
      )
    );
  }

  // Rule 6: Low LMS Activity (< 65) or Assignment Completion (< 72%)
  if (student.lmsActivity < 65 || student.assignmentCompletion < 72) {
    items.push(
      buildItem(
        'LMS',
        'LMS & Assignment Engagement',
        'LMS Engagement & Coursework Submission Follow-Up',
        `LMS activity (${student.lmsActivity}/100) and assignment completion (${student.assignmentCompletion}%) show disengagement.`,
        'LMS Activity < 65 or Assignment Completion < 72%',
        'Enable automated LMS deadline reminders and review pending module submissions with course instructor.',
        student.assignmentCompletion < 60 ? 'High' : 'Medium'
      )
    );
  }

  // If no deficits triggered, provide an enrichment goal for high performers
  if (items.length === 0) {
    items.push(
      buildItem(
        'ADV',
        'Coding Practice',
        'Advanced Capstone & Tier-1 Product Interview Prep',
        `Strong all-round indicators (CGPA ${student.cgpa.toFixed(1)}, Coding ${student.codingScore}/100).`,
        'All core indicators above risk thresholds',
        'Nominate for peer mentoring leadership, research elective, and competitive product-company mock panels.',
        'Standard'
      )
    );
  }

  return items;
}

/**
 * Enriches raw student records with calculated Student Success Score,
 * independent Academic & Placement Risk assessments, Segment, and Interventions.
 */
export function enrichStudentDataset(
  records: StudentRecord[],
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS,
  interventionOverrides: Record<
    string,
    { status: InterventionStatus; notes?: string; updatedAt: string }
  > = {},
  customInterventions: InterventionItem[] = []
): EnrichedStudent[] {
  return records.map((student) => {
    const scoreBreakdown = calculateStudentSuccessScore(student);
    const academicRisk = assessAcademicRisk(student, thresholds.academic);
    const placementRisk = assessPlacementRisk(student, thresholds.placement);
    const segment = assignStudentSegment(student, scoreBreakdown, academicRisk, placementRisk);
    const ruleInterventions = generateInterventionsForStudent(student, interventionOverrides);
    const extraForStudent = customInterventions
      .filter((c) => c.studentId === student.studentId)
      .map((c) => {
        const override = interventionOverrides[c.id];
        return override
          ? { ...c, status: override.status, notes: override.notes, updatedAt: override.updatedAt }
          : c;
      });

    const interventions = [...extraForStudent, ...ruleInterventions];
    const requiresImmediateAttention =
      academicRisk.level === 'High Risk' ||
      placementRisk.level === 'High Risk' ||
      scoreBreakdown.overallScore < 58;

    return {
      ...student,
      scoreBreakdown,
      academicRisk,
      placementRisk,
      segment,
      interventions,
      requiresImmediateAttention,
    };
  });
}
