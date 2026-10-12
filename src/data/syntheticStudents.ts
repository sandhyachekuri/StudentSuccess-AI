import { DemoAccount, Department, FacultyMember, StudentRecord } from '../types/student';

export const DEPARTMENTS: Department[] = [
  'Computer Science & Engineering',
  'Data Science & AI',
  'Electronics & Communication',
  'Information Technology',
  'Mechanical Engineering',
];

export const FACULTY_MEMBERS: FacultyMember[] = [
  {
    id: 'FAC-101',
    name: 'Dr. Arindam Chatterjee',
    department: 'Computer Science & Engineering',
    designation: 'Professor & Academic Advisor',
    email: 'a.chatterjee@smartcampus.edu.in',
    specialization: 'Algorithms & Systems Architecture',
  },
  {
    id: 'FAC-102',
    name: 'Prof. Meenakshi Iyer',
    department: 'Data Science & AI',
    designation: 'Associate Professor',
    email: 'm.iyer@smartcampus.edu.in',
    specialization: 'Statistical Learning & Data Engineering',
  },
  {
    id: 'FAC-103',
    name: 'Dr. Vikramaditya Rao',
    department: 'Electronics & Communication',
    designation: 'Associate Professor & Placement Coordinator',
    email: 'v.rao@smartcampus.edu.in',
    specialization: 'Embedded Systems & Signal Processing',
  },
  {
    id: 'FAC-104',
    name: 'Prof. Nupur Deshmukh',
    department: 'Information Technology',
    designation: 'Assistant Professor',
    email: 'n.deshmukh@smartcampus.edu.in',
    specialization: 'Cloud Computing & Full-Stack Engineering',
  },
  {
    id: 'FAC-105',
    name: 'Dr. Harpreet Singh Gill',
    department: 'Mechanical Engineering',
    designation: 'Professor & Student Welfare Mentor',
    email: 'h.gill@smartcampus.edu.in',
    specialization: 'CAD/CAM & Industrial Automation',
  },
];

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: 'DEMO-ADMIN',
    role: 'admin',
    name: 'Dr. Rajeshwari Menon',
    title: 'Dean of Academics & Institutional Effectiveness',
    email: 'dean.academics@smartcampus.edu.in',
    authStatusLabel: 'Synthetic Demo Session (Unauthenticated Prototype)',
  },
  {
    id: 'DEMO-FACULTY-1',
    role: 'faculty',
    name: 'Dr. Arindam Chatterjee',
    title: 'Faculty Mentor · CSE & Cross-Cohort Advisor',
    email: 'a.chatterjee@smartcampus.edu.in',
    department: 'Computer Science & Engineering',
    linkedFacultyId: 'FAC-101',
    authStatusLabel: 'Synthetic Demo Session (Faculty Scope: FAC-101)',
  },
  {
    id: 'DEMO-FACULTY-2',
    role: 'faculty',
    name: 'Prof. Meenakshi Iyer',
    title: 'Faculty Mentor · Data Science & AI',
    email: 'm.iyer@smartcampus.edu.in',
    department: 'Data Science & AI',
    linkedFacultyId: 'FAC-102',
    authStatusLabel: 'Synthetic Demo Session (Faculty Scope: FAC-102)',
  },
  {
    id: 'DEMO-STUDENT-1',
    role: 'student',
    name: 'Aarav Sharma (STU-2026-001)',
    title: 'B.Tech Year 4 · Computer Science & Engineering',
    email: 'aarav.sharma@student.smartcampus.edu.in',
    department: 'Computer Science & Engineering',
    linkedStudentId: 'STU-2026-001',
    authStatusLabel: 'Synthetic Demo Session (Student Scope: STU-2026-001)',
  },
  {
    id: 'DEMO-STUDENT-2',
    role: 'student',
    name: 'Rohan Kulkarni (STU-2026-002)',
    title: 'B.Tech Year 4 · Computer Science & Engineering',
    email: 'rohan.kulkarni@student.smartcampus.edu.in',
    department: 'Computer Science & Engineering',
    linkedStudentId: 'STU-2026-002',
    authStatusLabel: 'Synthetic Demo Session (Student Scope: STU-2026-002)',
  },
  {
    id: 'DEMO-STUDENT-3',
    role: 'student',
    name: 'Sneha Nair (STU-2026-004)',
    title: 'B.Tech Year 3 · Electronics & Communication',
    email: 'sneha.nair@student.smartcampus.edu.in',
    department: 'Electronics & Communication',
    linkedStudentId: 'STU-2026-004',
    authStatusLabel: 'Synthetic Demo Session (Student Scope: STU-2026-004)',
  },
];

// Curated archetype seeds + deterministic cohort generation for 56 total students
const FIRST_NAMES = [
  'Aarav', 'Rohan', 'Priya', 'Sneha', 'Karthik', 'Ananya', 'Devansh', 'Ishita',
  'Siddharth', 'Meera', 'Aditya', 'Tanvi', 'Vikram', 'Pooja', 'Nikhil', 'Kavya',
  'Arjun', 'Riya', 'Pranav', 'Divya', 'Harsh', 'Neha', 'Varun', 'Shruti',
  'Akash', 'Aditi', 'Gaurav', 'Simran', 'Yash', 'Bhavya', 'Tushar', 'Mansi',
  'Kunal', 'Swati', 'Rahul', 'Kritika', 'Manish', 'Pallavi', 'Saurabh', 'Anjali',
  'Deepak', 'Nandini', 'Abhishek', 'Sakshi', 'Vivek', 'Aishwarya', 'Mayank', 'Chaitra',
  'Rishabh', 'vaishnavi', 'chirag', 'Madhuri', 'Shashank', 'Aparna', 'Tejas', 'Zoya',
];

const LAST_NAMES = [
  'Sharma', 'Kulkarni', 'Patel', 'Nair', 'Subramanian', 'Chatterjee', 'Verma', 'Reddy',
  'Joshi', 'Menon', 'Gupta', 'Deshmukh', 'Malhotra', 'Krishnan', 'Bhatia', 'Rao',
  'Mehta', 'Sen', 'kapoor', 'Agarwal', 'Tiwari', 'Bansal', 'Chauhan', 'Iyer',
  'Pillai', 'Saxena', 'Mishra', 'Gowda', 'Shetty', 'Pandey', 'kaur', 'Dubey',
  'Choudhury', 'kale', 'bose', 'Srinivasan', 'Thakur', 'Hegde', 'Parekh', 'Gill',
  'Pathak', 'Nambiar', 'Upadhyay', 'Venkatesh', 'Mahajan', 'Gokhale', 'Sengupta', 'Bhatt',
  'Ranganathan', 'Kamat', 'rastogi', ' Kulkarni', 'Narayanan', 'Dutta', 'Bhardwaj', 'Khan',
];

function capitalizeName(s: string): string {
  const trimmed = s.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function buildSemesterHistory(cgpa: number, attendance: number, placementAvg: number) {
  const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));
  return [
    {
      sem: 'Sem 1',
      sgpa: Number(clamp(cgpa - 0.3, 4.2, 9.9).toFixed(2)),
      attendance: Math.round(clamp(attendance + 4, 48, 99)),
      placementIndex: Math.round(clamp(placementAvg - 8, 25, 96)),
    },
    {
      sem: 'Sem 2',
      sgpa: Number(clamp(cgpa - 0.15, 4.2, 9.9).toFixed(2)),
      attendance: Math.round(clamp(attendance + 2, 48, 99)),
      placementIndex: Math.round(clamp(placementAvg - 5, 25, 96)),
    },
    {
      sem: 'Sem 3',
      sgpa: Number(clamp(cgpa - 0.05, 4.2, 9.9).toFixed(2)),
      attendance: Math.round(clamp(attendance - 1, 48, 99)),
      placementIndex: Math.round(clamp(placementAvg - 2, 25, 98)),
    },
    {
      sem: 'Current',
      sgpa: Number(cgpa.toFixed(2)),
      attendance: Math.round(attendance),
      placementIndex: Math.round(placementAvg),
    },
  ];
}

// Explicit archetypes for the first 12 students so every segment and risk combination is immediately visible
const EXPLICIT_STUDENTS: StudentRecord[] = [
  {
    // Archetype 1: Strong Academics, Low Placement Readiness
    studentId: 'STU-2026-001',
    name: 'Aarav Sharma',
    department: 'Computer Science & Engineering',
    academicYear: 4,
    cgpa: 8.9,
    backlogs: 0,
    attendance: 91,
    lmsActivity: 88,
    assignmentCompletion: 94,
    codingScore: 46,
    aptitudeScore: 52,
    communicationScore: 48,
    mockInterviewScore: 44,
    technicalSkillScore: 76,
    extracurricularScore: 68,
    assignedFacultyId: 'FAC-101',
  },
  {
    // Archetype 2: Low Attendance with Academic Concerns & Multi-Indicator Risk
    studentId: 'STU-2026-002',
    name: 'Rohan Kulkarni',
    department: 'Computer Science & Engineering',
    academicYear: 4,
    cgpa: 5.6,
    backlogs: 3,
    attendance: 58,
    lmsActivity: 49,
    assignmentCompletion: 54,
    codingScore: 42,
    aptitudeScore: 47,
    communicationScore: 58,
    mockInterviewScore: 45,
    technicalSkillScore: 51,
    extracurricularScore: 44,
    assignedFacultyId: 'FAC-101',
  },
  {
    // Archetype 3: Balanced High Performer
    studentId: 'STU-2026-003',
    name: 'Priya Patel',
    department: 'Data Science & AI',
    academicYear: 4,
    cgpa: 9.4,
    backlogs: 0,
    attendance: 95,
    lmsActivity: 94,
    assignmentCompletion: 98,
    codingScore: 91,
    aptitudeScore: 89,
    communicationScore: 87,
    mockInterviewScore: 90,
    technicalSkillScore: 92,
    extracurricularScore: 84,
    assignedFacultyId: 'FAC-102',
  },
  {
    // Archetype 4: Good Placement Readiness, Weak Academics
    studentId: 'STU-2026-004',
    name: 'Sneha Nair',
    department: 'Electronics & Communication',
    academicYear: 3,
    cgpa: 6.2,
    backlogs: 2,
    attendance: 76,
    lmsActivity: 68,
    assignmentCompletion: 71,
    codingScore: 84,
    aptitudeScore: 81,
    communicationScore: 85,
    mockInterviewScore: 82,
    technicalSkillScore: 83,
    extracurricularScore: 79,
    assignedFacultyId: 'FAC-103',
  },
  {
    // Archetype 5: Low Attendance with Academic Concerns
    studentId: 'STU-2026-005',
    name: 'Karthik Subramanian',
    department: 'Information Technology',
    academicYear: 3,
    cgpa: 6.5,
    backlogs: 1,
    attendance: 62,
    lmsActivity: 58,
    assignmentCompletion: 63,
    codingScore: 71,
    aptitudeScore: 68,
    communicationScore: 66,
    mockInterviewScore: 67,
    technicalSkillScore: 70,
    extracurricularScore: 61,
    assignedFacultyId: 'FAC-104',
  },
  {
    // Archetype 6: Strong Academics, Low Placement Readiness
    studentId: 'STU-2026-006',
    name: 'Ananya Chatterjee',
    department: 'Data Science & AI',
    academicYear: 4,
    cgpa: 8.7,
    backlogs: 0,
    attendance: 89,
    lmsActivity: 91,
    assignmentCompletion: 92,
    codingScore: 54,
    aptitudeScore: 58,
    communicationScore: 45,
    mockInterviewScore: 47,
    technicalSkillScore: 79,
    extracurricularScore: 72,
    assignedFacultyId: 'FAC-102',
  },
  {
    // Archetype 7: Multi-Indicator Support Needed
    studentId: 'STU-2026-007',
    name: 'Devansh Verma',
    department: 'Mechanical Engineering',
    academicYear: 2,
    cgpa: 5.3,
    backlogs: 4,
    attendance: 55,
    lmsActivity: 42,
    assignmentCompletion: 48,
    codingScore: 38,
    aptitudeScore: 44,
    communicationScore: 46,
    mockInterviewScore: 39,
    technicalSkillScore: 45,
    extracurricularScore: 52,
    assignedFacultyId: 'FAC-105',
  },
  {
    // Archetype 8: Balanced High Performer
    studentId: 'STU-2026-008',
    name: 'Ishita Reddy',
    department: 'Computer Science & Engineering',
    academicYear: 3,
    cgpa: 9.1,
    backlogs: 0,
    attendance: 93,
    lmsActivity: 90,
    assignmentCompletion: 95,
    codingScore: 88,
    aptitudeScore: 86,
    communicationScore: 84,
    mockInterviewScore: 87,
    technicalSkillScore: 89,
    extracurricularScore: 81,
    assignedFacultyId: 'FAC-101',
  },
  {
    // Archetype 9: Good Placement Readiness, Weak Academics
    studentId: 'STU-2026-009',
    name: 'Siddharth Joshi',
    department: 'Information Technology',
    academicYear: 4,
    cgpa: 6.4,
    backlogs: 1,
    attendance: 77,
    lmsActivity: 72,
    assignmentCompletion: 69,
    codingScore: 86,
    aptitudeScore: 79,
    communicationScore: 80,
    mockInterviewScore: 83,
    technicalSkillScore: 85,
    extracurricularScore: 75,
    assignedFacultyId: 'FAC-104',
  },
  {
    // Archetype 10: Low Attendance with Academic Concerns
    studentId: 'STU-2026-010',
    name: 'Meera Menon',
    department: 'Electronics & Communication',
    academicYear: 2,
    cgpa: 6.1,
    backlogs: 2,
    attendance: 61,
    lmsActivity: 54,
    assignmentCompletion: 59,
    codingScore: 66,
    aptitudeScore: 69,
    communicationScore: 72,
    mockInterviewScore: 68,
    technicalSkillScore: 64,
    extracurricularScore: 58,
    assignedFacultyId: 'FAC-103',
  },
  {
    // Archetype 11: Strong Academics, Low Placement Readiness
    studentId: 'STU-2026-011',
    name: 'Aditya Gupta',
    department: 'Mechanical Engineering',
    academicYear: 4,
    cgpa: 8.5,
    backlogs: 0,
    attendance: 88,
    lmsActivity: 84,
    assignmentCompletion: 90,
    codingScore: 43,
    aptitudeScore: 56,
    communicationScore: 49,
    mockInterviewScore: 46,
    technicalSkillScore: 78,
    extracurricularScore: 67,
    assignedFacultyId: 'FAC-105',
  },
  {
    // Archetype 12: Balanced High Performer
    studentId: 'STU-2026-012',
    name: 'Tanvi Deshmukh',
    department: 'Data Science & AI',
    academicYear: 3,
    cgpa: 9.2,
    backlogs: 0,
    attendance: 94,
    lmsActivity: 92,
    assignmentCompletion: 96,
    codingScore: 89,
    aptitudeScore: 91,
    communicationScore: 86,
    mockInterviewScore: 88,
    technicalSkillScore: 90,
    extracurricularScore: 85,
    assignedFacultyId: 'FAC-102',
  },
];

function generateDeterministicCohort(): StudentRecord[] {
  const records: StudentRecord[] = EXPLICIT_STUDENTS.map((s) => ({
    ...s,
    semesterHistory: buildSemesterHistory(
      s.cgpa,
      s.attendance,
      (s.codingScore + s.aptitudeScore + s.communicationScore + s.mockInterviewScore) / 4
    ),
  }));

  // Deterministically generate students 13 to 56 (total 56 students > 50 requirement)
  for (let i = 12; i < 56; i++) {
    const idNum = i + 1;
    const studentId = `STU-2026-${String(idNum).padStart(3, '0')}`;
    const name = `${capitalizeName(FIRST_NAMES[i % FIRST_NAMES.length])} ${capitalizeName(
      LAST_NAMES[i % LAST_NAMES.length]
    )}`;
    const deptIndex = i % DEPARTMENTS.length;
    const department = DEPARTMENTS[deptIndex];
    const assignedFacultyId = FACULTY_MEMBERS[deptIndex].id;
    const academicYear = (((i % 4) + 1) as 1 | 2 | 3 | 4);

    // Cycle through realistic student profiles deterministically
    const profileMode = i % 6;
    let cgpa = 7.5;
    let backlogs = 0;
    let attendance = 82;
    let lmsActivity = 78;
    let assignmentCompletion = 82;
    let codingScore = 72;
    let aptitudeScore = 74;
    let communicationScore = 73;
    let mockInterviewScore = 71;
    let technicalSkillScore = 75;
    let extracurricularScore = 70;

    const jitter = (seed: number, span: number) => ((seed * 17 + i * 13) % (span * 2 + 1)) - span;

    if (profileMode === 0) {
      // High performer
      cgpa = Number((8.6 + ((i * 7) % 11) * 0.1).toFixed(1));
      backlogs = 0;
      attendance = 86 + ((i * 3) % 12);
      lmsActivity = 84 + ((i * 5) % 14);
      assignmentCompletion = 88 + ((i * 3) % 11);
      codingScore = 80 + ((i * 7) % 16);
      aptitudeScore = 79 + ((i * 5) % 17);
      communicationScore = 78 + ((i * 3) % 16);
      mockInterviewScore = 80 + ((i * 7) % 15);
      technicalSkillScore = 82 + ((i * 5) % 14);
      extracurricularScore = 74 + ((i * 7) % 18);
    } else if (profileMode === 1) {
      // Strong academics, low placement readiness
      cgpa = Number((8.1 + ((i * 5) % 13) * 0.1).toFixed(1));
      backlogs = 0;
      attendance = 83 + ((i * 3) % 13);
      lmsActivity = 80 + ((i * 7) % 15);
      assignmentCompletion = 85 + ((i * 5) % 12);
      codingScore = 44 + ((i * 7) % 15);
      aptitudeScore = 48 + ((i * 5) % 14);
      communicationScore = 46 + ((i * 3) % 15);
      mockInterviewScore = 42 + ((i * 7) % 16);
      technicalSkillScore = 72 + jitter(2, 6);
      extracurricularScore = 62 + jitter(3, 8);
    } else if (profileMode === 2) {
      // Low attendance with academic concerns
      cgpa = Number((5.8 + ((i * 3) % 10) * 0.1).toFixed(1));
      backlogs = (i % 3) + 1;
      attendance = 56 + ((i * 5) % 16);
      lmsActivity = 50 + ((i * 7) % 16);
      assignmentCompletion = 54 + ((i * 3) % 15);
      codingScore = 62 + ((i * 5) % 16);
      aptitudeScore = 64 + ((i * 3) % 14);
      communicationScore = 65 + ((i * 7) % 14);
      mockInterviewScore = 61 + ((i * 5) % 15);
      technicalSkillScore = 63 + jitter(4, 6);
      extracurricularScore = 58 + jitter(5, 8);
    } else if (profileMode === 3) {
      // Good placement readiness, weak academics
      cgpa = Number((6.0 + ((i * 3) % 7) * 0.1).toFixed(1));
      backlogs = (i % 2) + 1;
      attendance = 75 + ((i * 3) % 9);
      lmsActivity = 64 + ((i * 5) % 12);
      assignmentCompletion = 66 + ((i * 7) % 10);
      codingScore = 78 + ((i * 5) % 16);
      aptitudeScore = 75 + ((i * 7) % 15);
      communicationScore = 77 + ((i * 3) % 14);
      mockInterviewScore = 76 + ((i * 5) % 15);
      technicalSkillScore = 80 + jitter(6, 6);
      extracurricularScore = 74 + jitter(2, 7);
    } else if (profileMode === 4) {
      // Multi-indicator support needed
      cgpa = Number((5.1 + ((i * 3) % 8) * 0.1).toFixed(1));
      backlogs = 2 + (i % 3);
      attendance = 53 + ((i * 5) % 12);
      lmsActivity = 41 + ((i * 7) % 15);
      assignmentCompletion = 45 + ((i * 3) % 15);
      codingScore = 36 + ((i * 5) % 14);
      aptitudeScore = 42 + ((i * 7) % 12);
      communicationScore = 44 + ((i * 3) % 13);
      mockInterviewScore = 38 + ((i * 5) % 13);
      technicalSkillScore = 46 + jitter(3, 5);
      extracurricularScore = 45 + jitter(4, 7);
    } else {
      // Steady developing cohort
      cgpa = Number((7.2 + ((i * 3) % 9) * 0.1).toFixed(1));
      backlogs = 0;
      attendance = 77 + ((i * 5) % 11);
      lmsActivity = 72 + ((i * 3) % 12);
      assignmentCompletion = 75 + ((i * 7) % 12);
      codingScore = 66 + ((i * 5) % 12);
      aptitudeScore = 68 + ((i * 3) % 12);
      communicationScore = 67 + ((i * 7) % 12);
      mockInterviewScore = 66 + ((i * 5) % 11);
      technicalSkillScore = 71 + jitter(2, 5);
      extracurricularScore = 68 + jitter(3, 6);
    }

    const placementAvg =
      (codingScore + aptitudeScore + communicationScore + mockInterviewScore) / 4;

    records.push({
      studentId,
      name,
      department,
      academicYear,
      cgpa,
      backlogs,
      attendance,
      lmsActivity,
      assignmentCompletion,
      codingScore,
      aptitudeScore,
      communicationScore,
      mockInterviewScore,
      technicalSkillScore,
      extracurricularScore,
      assignedFacultyId,
      semesterHistory: buildSemesterHistory(cgpa, attendance, placementAvg),
    });
  }

  return records;
}

export const INITIAL_SYNTHETIC_STUDENTS: StudentRecord[] = generateDeterministicCohort();
