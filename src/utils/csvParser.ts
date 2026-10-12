import { AcademicYear, CSVParseResult, CSVValidationError, Department, StudentRecord } from '../types/student';
import { DEPARTMENTS, FACULTY_MEMBERS } from '../data/syntheticStudents';

export interface RequiredCSVColumn {
  key: keyof Omit<StudentRecord, 'semesterHistory' | 'assignedFacultyId'>;
  header: string;
  aliases: string[];
  description: string;
  validRange: string;
}

export const REQUIRED_CSV_COLUMNS: RequiredCSVColumn[] = [
  {
    key: 'studentId',
    header: 'student_id',
    aliases: ['student_id', 'studentid', 'id', 'roll_no'],
    description: 'Unique Student Identifier',
    validRange: 'Non-empty string (e.g., STU-2026-101)',
  },
  {
    key: 'name',
    header: 'name',
    aliases: ['name', 'student_name', 'fullname', 'full_name'],
    description: 'Full Student Name',
    validRange: 'Non-empty text',
  },
  {
    key: 'department',
    header: 'department',
    aliases: ['department', 'dept', 'branch'],
    description: 'Academic Department',
    validRange: 'CSE, Data Science & AI, ECE, IT, or Mechanical',
  },
  {
    key: 'academicYear',
    header: 'academic_year',
    aliases: ['academic_year', 'academicyear', 'year'],
    description: 'Current Year of Study',
    validRange: 'Integer 1 to 4',
  },
  {
    key: 'cgpa',
    header: 'cgpa',
    aliases: ['cgpa', 'gpa'],
    description: 'Cumulative Grade Point Average',
    validRange: '0.0 to 10.0',
  },
  {
    key: 'backlogs',
    header: 'backlogs',
    aliases: ['backlogs', 'backlog_count', 'active_backlogs'],
    description: 'Active Backlog Count',
    validRange: 'Integer 0 to 20',
  },
  {
    key: 'attendance',
    header: 'attendance',
    aliases: ['attendance', 'attendance_pct', 'overall_attendance'],
    description: 'Overall Attendance Percentage',
    validRange: '0 to 100',
  },
  {
    key: 'lmsActivity',
    header: 'lms_activity',
    aliases: ['lms_activity', 'lmsactivity', 'lms_score'],
    description: 'LMS Activity Score',
    validRange: '0 to 100',
  },
  {
    key: 'assignmentCompletion',
    header: 'assignment_completion',
    aliases: ['assignment_completion', 'assignmentcompletion', 'assignments'],
    description: 'Assignment Completion Percentage',
    validRange: '0 to 100',
  },
  {
    key: 'codingScore',
    header: 'coding_score',
    aliases: ['coding_score', 'codingscore', 'coding'],
    description: 'Coding Assessment Score',
    validRange: '0 to 100',
  },
  {
    key: 'aptitudeScore',
    header: 'aptitude_score',
    aliases: ['aptitude_score', 'aptitudescore', 'aptitude'],
    description: 'Aptitude Test Score',
    validRange: '0 to 100',
  },
  {
    key: 'communicationScore',
    header: 'communication_score',
    aliases: ['communication_score', 'communicationscore', 'communication'],
    description: 'Communication Assessment Score',
    validRange: '0 to 100',
  },
  {
    key: 'mockInterviewScore',
    header: 'mock_interview_score',
    aliases: ['mock_interview_score', 'mockinterviewscore', 'mock_interview'],
    description: 'Mock Interview Score',
    validRange: '0 to 100',
  },
  {
    key: 'technicalSkillScore',
    header: 'technical_skill_score',
    aliases: ['technical_skill_score', 'technicalskillscore', 'technical_skill'],
    description: 'Technical Skill Score',
    validRange: '0 to 100',
  },
  {
    key: 'extracurricularScore',
    header: 'extracurricular_score',
    aliases: ['extracurricular_score', 'extracurricularscore', 'extracurricular'],
    description: 'Extracurricular Engagement Score',
    validRange: '0 to 100',
  },
];

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function normalizeDepartment(raw: string): Department | null {
  const val = raw.trim().toLowerCase();
  if (!val) return null;
  if (val.includes('computer') || val === 'cse' || val === 'cs') {
    return 'Computer Science & Engineering';
  }
  if (val.includes('data') || val.includes('ai') || val === 'dsai') {
    return 'Data Science & AI';
  }
  if (val.includes('electronics') || val === 'ece' || val === 'ec') {
    return 'Electronics & Communication';
  }
  if (val.includes('information') || val === 'it') {
    return 'Information Technology';
  }
  if (val.includes('mechanical') || val === 'me' || val === 'mech') {
    return 'Mechanical Engineering';
  }
  const exact = DEPARTMENTS.find((d) => d.toLowerCase() === val);
  return exact || null;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function validateAndParseStudentCSV(csvText: string): CSVParseResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      isValidStructure: false,
      missingColumns: REQUIRED_CSV_COLUMNS.map((c) => c.header),
      validRecords: [],
      errors: [
        {
          rowNumber: 1,
          studentId: 'N/A',
          field: 'File Structure',
          value: 'Empty or header-only file',
          message: 'CSV file must contain a header row and at least one student data row.',
        },
      ],
      totalRowsRead: 0,
    };
  }

  const rawHeaders = parseCSVLine(lines[0]).map(normalizeHeader);
  const columnIndexMap: Partial<Record<RequiredCSVColumn['key'], number>> = {};
  const missingColumns: string[] = [];

  for (const col of REQUIRED_CSV_COLUMNS) {
    const foundIdx = rawHeaders.findIndex((h) => col.aliases.includes(h));
    if (foundIdx === -1) {
      missingColumns.push(col.header);
    } else {
      columnIndexMap[col.key] = foundIdx;
    }
  }

  if (missingColumns.length > 0) {
    return {
      isValidStructure: false,
      missingColumns,
      validRecords: [],
      errors: [
        {
          rowNumber: 1,
          studentId: 'Header Row',
          field: 'Columns',
          value: rawHeaders.join(', '),
          message: `Missing required CSV columns: ${missingColumns.join(', ')}`,
        },
      ],
      totalRowsRead: lines.length - 1,
    };
  }

  const validRecords: StudentRecord[] = [];
  const errors: CSVValidationError[] = [];
  const seenIds = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1;
    const cells = parseCSVLine(lines[i]);
    const getCell = (key: RequiredCSVColumn['key']) =>
      (cells[columnIndexMap[key]!] ?? '').trim();

    const studentId = getCell('studentId');
    const name = getCell('name');
    const rawDept = getCell('department');
    const rowErrors: CSVValidationError[] = [];

    if (!studentId) {
      rowErrors.push({
        rowNumber,
        studentId: `Row ${rowNumber}`,
        field: 'student_id',
        value: 'Empty',
        message: 'Student ID is required.',
      });
    } else if (seenIds.has(studentId.toUpperCase())) {
      rowErrors.push({
        rowNumber,
        studentId,
        field: 'student_id',
        value: studentId,
        message: 'Duplicate Student ID within the uploaded CSV file.',
      });
    }

    if (!name || name.length < 2) {
      rowErrors.push({
        rowNumber,
        studentId: studentId || `Row ${rowNumber}`,
        field: 'name',
        value: name || 'Empty',
        message: 'Student name must be at least 2 characters.',
      });
    }

    const department = normalizeDepartment(rawDept);
    if (!department) {
      rowErrors.push({
        rowNumber,
        studentId: studentId || `Row ${rowNumber}`,
        field: 'department',
        value: rawDept || 'Empty',
        message:
          'Department must match one of: Computer Science & Engineering, Data Science & AI, Electronics & Communication, Information Technology, Mechanical Engineering.',
      });
    }

    const checkNumber = (
      key: RequiredCSVColumn['key'],
      label: string,
      min: number,
      max: number,
      mustBeInteger = false
    ): number => {
      const raw = getCell(key);
      const num = Number(raw);
      if (raw === '' || Number.isNaN(num) || !Number.isFinite(num)) {
        rowErrors.push({
          rowNumber,
          studentId: studentId || `Row ${rowNumber}`,
          field: label,
          value: raw || 'Empty',
          message: `${label} must be a valid number (${min} to ${max}).`,
        });
        return 0;
      }
      if (mustBeInteger && !Number.isInteger(num)) {
        rowErrors.push({
          rowNumber,
          studentId: studentId || `Row ${rowNumber}`,
          field: label,
          value: raw,
          message: `${label} must be a whole integer between ${min} and ${max}.`,
        });
      }
      if (num < min || num > max) {
        rowErrors.push({
          rowNumber,
          studentId: studentId || `Row ${rowNumber}`,
          field: label,
          value: raw,
          message: `${label} out of range: must be between ${min} and ${max}.`,
        });
      }
      return num;
    };

    const academicYear = checkNumber('academicYear', 'academic_year', 1, 4, true) as AcademicYear;
    const cgpa = checkNumber('cgpa', 'cgpa', 0, 10);
    const backlogs = checkNumber('backlogs', 'backlogs', 0, 20, true);
    const attendance = checkNumber('attendance', 'attendance', 0, 100);
    const lmsActivity = checkNumber('lmsActivity', 'lms_activity', 0, 100);
    const assignmentCompletion = checkNumber(
      'assignmentCompletion',
      'assignment_completion',
      0,
      100
    );
    const codingScore = checkNumber('codingScore', 'coding_score', 0, 100);
    const aptitudeScore = checkNumber('aptitudeScore', 'aptitude_score', 0, 100);
    const communicationScore = checkNumber('communicationScore', 'communication_score', 0, 100);
    const mockInterviewScore = checkNumber('mockInterviewScore', 'mock_interview_score', 0, 100);
    const technicalSkillScore = checkNumber('technicalSkillScore', 'technical_skill_score', 0, 100);
    const extracurricularScore = checkNumber(
      'extracurricularScore',
      'extracurricular_score',
      0,
      100
    );

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else if (department) {
      seenIds.add(studentId.toUpperCase());
      const deptIdx = Math.max(0, DEPARTMENTS.indexOf(department));
      const assignedFacultyId = FACULTY_MEMBERS[deptIdx % FACULTY_MEMBERS.length].id;
      const placementAvg =
        (codingScore + aptitudeScore + communicationScore + mockInterviewScore) / 4;

      validRecords.push({
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
        semesterHistory: [
          {
            sem: 'Sem 1',
            sgpa: Number(Math.max(4.0, cgpa - 0.25).toFixed(2)),
            attendance: Math.min(100, Math.round(attendance + 2)),
            placementIndex: Math.max(20, Math.round(placementAvg - 5)),
          },
          {
            sem: 'Current',
            sgpa: Number(cgpa.toFixed(2)),
            attendance: Math.round(attendance),
            placementIndex: Math.round(placementAvg),
          },
        ],
      });
    }
  }

  return {
    isValidStructure: true,
    missingColumns: [],
    validRecords,
    errors,
    totalRowsRead: lines.length - 1,
  };
}

export function generateSampleCSVTemplate(includeIntentionalErrorRow = false): string {
  const headers = REQUIRED_CSV_COLUMNS.map((c) => c.header).join(',');
  const rows = [
    'STU-2026-201,Aniket Deshpande,Computer Science & Engineering,4,8.8,0,91,86,92,48,54,49,45,78,70',
    'STU-2026-202,Ritika Nambiar,Data Science & AI,3,9.3,0,94,91,96,89,92,88,90,91,84',
    'STU-2026-203,Samarth Kulkarni,Electronics & Communication,3,5.7,2,61,52,58,69,72,70,68,66,60',
    'STU-2026-204,Niharika Bose,Information Technology,4,6.3,1,78,70,74,84,80,82,81,83,76',
    'STU-2026-205,Kabir Malhotra,Mechanical Engineering,2,5.2,3,54,44,49,41,45,48,42,49,51',
  ];
  if (includeIntentionalErrorRow) {
    rows.push(
      'STU-2026-206,Invalid Demo Row,Computer Science & Engineering,5,11.4,-1,108,80,85,70,75,70,72,75,70'
    );
  }
  return [headers, ...rows].join('\n');
}
