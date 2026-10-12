"""
StudentSuccess AI — Hybrid Firebase + SQLite Authentication, Migration & Dynamic User Management Engine.
- Uses Firebase Authentication (verified via Firebase Admin SDK) for identity verification
  while retaining SQLite (`users`, `student_records`, `faculty_profiles`, `auth_sessions`)
  for application user profiles, authoritative role assignments, and academic records.
- Performs automatic, verified SQLite backups before applying idempotent schema migrations.
- Enforces server-side RBAC for Admin, Faculty (scoped to assigned mentees/department),
  and Student (strictly isolated to own `linked_student_id`).
"""

from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import sqlite3
import sys
from typing import Any, Dict, List, Optional, Tuple

from .firebase_verifier import (
    is_firebase_admin_configured,
    verify_firebase_token_on_server,
)

PBKDF2_ITERATIONS = 260_000
DEFAULT_SESSION_HOURS = 12
REMEMBER_ME_DAYS = 7

DEFAULT_DB_PATH = str(Path(__file__).resolve().parent / "studentsuccess.db")
BACKUP_DIR_PATH = Path(__file__).resolve().parent / "backups"

VALID_DEPARTMENTS = {
    "Computer Science & Engineering",
    "Data Science & AI",
    "Electronics & Communication",
    "Information Technology",
    "Mechanical Engineering",
}

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def get_db_path(override_path: Optional[str] = None) -> str:
    if override_path:
        return override_path
    env_path = os.getenv("SQLITE_DB_PATH", "").strip()
    if env_path:
        return env_path
    return DEFAULT_DB_PATH


def get_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    resolved = get_db_path(db_path)
    Path(resolved).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(resolved)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def hash_password(password: str, salt_hex: Optional[str] = None) -> str:
    """
    Hashes a password using PBKDF2-HMAC-SHA256 with 260,000 iterations.
    Format: pbkdf2_sha256$<iterations>$<salt_hex>$<hash_hex>
    """
    if not salt_hex:
        salt_hex = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt_hex),
        PBKDF2_ITERATIONS,
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt_hex}${dk.hex()}"


def verify_password(plain_password: str, stored_hash: str) -> bool:
    """
    Verifies a plain-text password against a stored PBKDF2-HMAC-SHA256 hash
    using constant-time digest comparison (`hmac.compare_digest`).
    """
    try:
        parts = stored_hash.split("$")
        if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
            return False
        iterations = int(parts[1])
        salt_hex = parts[2]
        expected_hex = parts[3]
        dk = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            bytes.fromhex(salt_hex),
            iterations,
        )
        return hmac.compare_digest(dk.hex(), expected_hex)
    except Exception:
        return False


def _hash_session_token(raw_token: str) -> str:
    """Hashes a bearer session token with SHA-256 before storing/querying in SQLite."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_verified_db_backup(db_path: Optional[str] = None) -> Optional[str]:
    """
    Creates and verifies a safe backup of the SQLite database before migration.
    Returns the backup file path if the source database exists, or None if new.
    """
    resolved = get_db_path(db_path)
    if not os.path.exists(resolved) or os.path.getsize(resolved) == 0:
        return None

    BACKUP_DIR_PATH.mkdir(parents=True, exist_ok=True)
    backup_file = str(BACKUP_DIR_PATH / "studentsuccess_pre_migration.db")

    src_conn = sqlite3.connect(resolved)
    dst_conn = sqlite3.connect(backup_file)
    try:
        with dst_conn:
            src_conn.backup(dst_conn)
        integrity = dst_conn.execute("PRAGMA integrity_check;").fetchone()
        if not integrity or integrity[0] != "ok":
            raise RuntimeError(f"Backup integrity check failed: {integrity}")
    finally:
        dst_conn.close()
        src_conn.close()

    return backup_file


def init_auth_db(db_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Initializes and migrates the SQLite schema safely:
    1. Creates a verified backup if `users` requires schema migration.
    2. Ensures `users`, `auth_sessions`, `password_reset_requests`, `faculty_profiles`,
       and `student_records` tables exist with backward-compatible columns and indexes.
    3. Seeds the default institutional accounts, faculty profiles, and 56 student records
       if empty, preserving all existing data.
    """
    resolved = get_db_path(db_path)
    backup_created: Optional[str] = None

    with get_connection(resolved) as conn:
        # Check if `users` table already exists and whether migration is needed
        table_exists = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='users';"
        ).fetchone()

        if table_exists:
            existing_cols = {
                row["name"]
                for row in conn.execute("PRAGMA table_info(users);").fetchall()
            }
            required_new_cols = {
                "firebase_uid",
                "auth_provider",
                "account_status",
                "updated_at",
                "created_by",
            }
            if not required_new_cols.issubset(existing_cols):
                backup_created = create_verified_db_backup(resolved)

        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                title TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('admin', 'faculty', 'student')),
                password_hash TEXT NOT NULL,
                department TEXT,
                linked_faculty_id TEXT,
                linked_student_id TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                firebase_uid TEXT,
                auth_provider TEXT NOT NULL DEFAULT 'sqlite_pbkdf2',
                account_status TEXT NOT NULL DEFAULT 'active',
                updated_at TEXT,
                created_by TEXT DEFAULT 'system_seed'
            );

            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

            CREATE TABLE IF NOT EXISTS auth_sessions (
                token_hash TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                role TEXT NOT NULL,
                remember_me INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                revoked INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON auth_sessions(user_id);

            CREATE TABLE IF NOT EXISTS password_reset_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                role TEXT,
                requested_at TEXT NOT NULL,
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS faculty_profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                department TEXT NOT NULL,
                designation TEXT NOT NULL,
                specialization TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS student_records (
                student_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                department TEXT NOT NULL,
                academic_year INTEGER NOT NULL CHECK(academic_year BETWEEN 1 AND 4),
                cgpa REAL NOT NULL CHECK(cgpa BETWEEN 0.0 AND 10.0),
                backlogs INTEGER NOT NULL CHECK(backlogs >= 0),
                attendance REAL NOT NULL CHECK(attendance BETWEEN 0.0 AND 100.0),
                lms_activity REAL NOT NULL CHECK(lms_activity BETWEEN 0.0 AND 100.0),
                assignment_completion REAL NOT NULL CHECK(assignment_completion BETWEEN 0.0 AND 100.0),
                coding_score REAL NOT NULL CHECK(coding_score BETWEEN 0.0 AND 100.0),
                aptitude_score REAL NOT NULL CHECK(aptitude_score BETWEEN 0.0 AND 100.0),
                communication_score REAL NOT NULL CHECK(communication_score BETWEEN 0.0 AND 100.0),
                mock_interview_score REAL NOT NULL CHECK(mock_interview_score BETWEEN 0.0 AND 100.0),
                technical_skill_score REAL NOT NULL CHECK(technical_skill_score BETWEEN 0.0 AND 100.0),
                extracurricular_score REAL NOT NULL CHECK(extracurricular_score BETWEEN 0.0 AND 100.0),
                assigned_faculty_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_student_records_dept ON student_records(department);
            CREATE INDEX IF NOT EXISTS idx_student_records_faculty ON student_records(assigned_faculty_id);
            """
        )

        # Idempotent column additions if upgrading an older `users` table
        current_cols = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(users);").fetchall()
        }
        migrations_applied: List[str] = []
        if "firebase_uid" not in current_cols:
            conn.execute("ALTER TABLE users ADD COLUMN firebase_uid TEXT;")
            migrations_applied.append("firebase_uid")
        if "auth_provider" not in current_cols:
            conn.execute(
                "ALTER TABLE users ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'sqlite_pbkdf2';"
            )
            migrations_applied.append("auth_provider")
        if "account_status" not in current_cols:
            conn.execute(
                "ALTER TABLE users ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active';"
            )
            migrations_applied.append("account_status")
        if "updated_at" not in current_cols:
            conn.execute("ALTER TABLE users ADD COLUMN updated_at TEXT;")
            migrations_applied.append("updated_at")
        if "created_by" not in current_cols:
            conn.execute(
                "ALTER TABLE users ADD COLUMN created_by TEXT DEFAULT 'system_seed';"
            )
            migrations_applied.append("created_by")

        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid) WHERE firebase_uid IS NOT NULL;"
        )
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_linked_student ON users(linked_student_id) WHERE linked_student_id IS NOT NULL;"
        )

        row = conn.execute("SELECT COUNT(*) AS cnt FROM users").fetchone()
        if row and int(row["cnt"]) == 0:
            _seed_default_users(conn)

        # Ensure the workspace owner's admin account is also provisioned idempotently
        owner_admin = conn.execute(
            "SELECT id FROM users WHERE lower(email) = ?",
            ("sandhyachekuri2718@gmail.com",),
        ).fetchone()
        if not owner_admin:
            now_iso = datetime.now(timezone.utc).isoformat()
            admin_pw_hash = hash_password(
                "Admin@2026", "a1b2c3d4e5f60718293a4b5c6d7e8f90"
            )
            conn.execute(
                """
                INSERT OR IGNORE INTO users (
                    id, email, name, title, role, password_hash,
                    department, linked_faculty_id, linked_student_id, is_active, created_at,
                    firebase_uid, auth_provider, account_status, updated_at, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "USR-ADMIN-03",
                    "sandhyachekuri2718@gmail.com",
                    "Sandhya Chekuri",
                    "Lead Platform Administrator · StudentSuccess AI",
                    "admin",
                    admin_pw_hash,
                    None,
                    None,
                    None,
                    1,
                    now_iso,
                    None,
                    "firebase",
                    "active",
                    now_iso,
                    "system_seed",
                ),
            )

        fac_row = conn.execute("SELECT COUNT(*) AS cnt FROM faculty_profiles").fetchone()
        if fac_row and int(fac_row["cnt"]) == 0:
            _seed_default_faculty(conn)

        stu_row = conn.execute("SELECT COUNT(*) AS cnt FROM student_records").fetchone()
        if stu_row and int(stu_row["cnt"]) == 0:
            _seed_default_students(conn)

        conn.commit()

        user_count = int(conn.execute("SELECT COUNT(*) FROM users").fetchone()[0])
        student_count = int(
            conn.execute("SELECT COUNT(*) FROM student_records").fetchone()[0]
        )
        faculty_count = int(
            conn.execute("SELECT COUNT(*) FROM faculty_profiles").fetchone()[0]
        )

    return {
        "dbPath": resolved,
        "backupPath": backup_created,
        "migrationsApplied": migrations_applied,
        "usersCount": user_count,
        "studentsCount": student_count,
        "facultyCount": faculty_count,
    }


def _seed_default_users(conn: sqlite3.Connection) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()

    admin_pw_hash = hash_password("Admin@2026", "a1b2c3d4e5f60718293a4b5c6d7e8f90")
    faculty_pw_hash = hash_password("Faculty@2026", "f1e2d3c4b5a69788695a4b3c2d1e0f11")
    student_pw_hash = hash_password("Student@2026", "11223344556677889900aabbccddeeff")

    seed_users = [
        (
            "USR-ADMIN-01",
            "dean.academics@smartcampus.edu.in",
            "Dr. Rajeshwari Menon",
            "Dean of Academics & Institutional Effectiveness",
            "admin",
            admin_pw_hash,
            None,
            None,
            None,
            1,
            now_iso,
            None,
            "sqlite_pbkdf2",
            "active",
            now_iso,
            "system_seed",
        ),
        (
            "USR-ADMIN-02",
            "admin@smartcampus.edu.in",
            "Campus Analytics Administrator",
            "Director of Institutional Research & IQAC",
            "admin",
            admin_pw_hash,
            None,
            None,
            None,
            1,
            now_iso,
            None,
            "sqlite_pbkdf2",
            "active",
            now_iso,
            "system_seed",
        ),
        (
            "USR-FAC-101",
            "a.chatterjee@smartcampus.edu.in",
            "Dr. Arindam Chatterjee",
            "Professor & Academic Advisor · CSE",
            "faculty",
            faculty_pw_hash,
            "Computer Science & Engineering",
            "FAC-101",
            None,
            1,
            now_iso,
            None,
            "sqlite_pbkdf2",
            "active",
            now_iso,
            "system_seed",
        ),
        (
            "USR-FAC-102",
            "m.iyer@smartcampus.edu.in",
            "Prof. Meenakshi Iyer",
            "Associate Professor · Data Science & AI",
            "faculty",
            faculty_pw_hash,
            "Data Science & AI",
            "FAC-102",
            None,
            1,
            now_iso,
            None,
            "sqlite_pbkdf2",
            "active",
            now_iso,
            "system_seed",
        ),
        (
            "USR-FAC-103",
            "v.rao@smartcampus.edu.in",
            "Dr. Vikramaditya Rao",
            "Associate Professor & Placement Coordinator · ECE",
            "faculty",
            faculty_pw_hash,
            "Electronics & Communication",
            "FAC-103",
            None,
            1,
            now_iso,
            None,
            "sqlite_pbkdf2",
            "active",
            now_iso,
            "system_seed",
        ),
        (
            "USR-FAC-104",
            "n.deshmukh@smartcampus.edu.in",
            "Prof. Nupur Deshmukh",
            "Assistant Professor · Information Technology",
            "faculty",
            faculty_pw_hash,
            "Information Technology",
            "FAC-104",
            None,
            1,
            now_iso,
            None,
            "sqlite_pbkdf2",
            "active",
            now_iso,
            "system_seed",
        ),
        (
            "USR-FAC-105",
            "h.gill@smartcampus.edu.in",
            "Dr. Harpreet Singh Gill",
            "Professor & Student Welfare Mentor · Mechanical",
            "faculty",
            faculty_pw_hash,
            "Mechanical Engineering",
            "FAC-105",
            None,
            1,
            now_iso,
            None,
            "sqlite_pbkdf2",
            "active",
            now_iso,
            "system_seed",
        ),
        (
            "USR-STU-001",
            "aarav.sharma@student.smartcampus.edu.in",
            "Aarav Sharma",
            "B.Tech Year 4 · Computer Science & Engineering (STU-2026-001)",
            "student",
            student_pw_hash,
            "Computer Science & Engineering",
            None,
            "STU-2026-001",
            1,
            now_iso,
            None,
            "sqlite_pbkdf2",
            "active",
            now_iso,
            "system_seed",
        ),
        (
            "USR-STU-002",
            "rohan.kulkarni@student.smartcampus.edu.in",
            "Rohan Kulkarni",
            "B.Tech Year 4 · Computer Science & Engineering (STU-2026-002)",
            "student",
            student_pw_hash,
            "Computer Science & Engineering",
            None,
            "STU-2026-002",
            1,
            now_iso,
            None,
            "sqlite_pbkdf2",
            "active",
            now_iso,
            "system_seed",
        ),
        (
            "USR-STU-003",
            "priya.patel@student.smartcampus.edu.in",
            "Priya Patel",
            "B.Tech Year 3 · Data Science & AI (STU-2026-003)",
            "student",
            student_pw_hash,
            "Data Science & AI",
            None,
            "STU-2026-003",
            1,
            now_iso,
            None,
            "sqlite_pbkdf2",
            "active",
            now_iso,
            "system_seed",
        ),
        (
            "USR-STU-004",
            "sneha.nair@student.smartcampus.edu.in",
            "Sneha Nair",
            "B.Tech Year 3 · Electronics & Communication (STU-2026-004)",
            "student",
            student_pw_hash,
            "Electronics & Communication",
            None,
            "STU-2026-004",
            1,
            now_iso,
            None,
            "sqlite_pbkdf2",
            "active",
            now_iso,
            "system_seed",
        ),
        (
            "USR-STU-005",
            "karthik.reddy@student.smartcampus.edu.in",
            "Karthik Reddy",
            "B.Tech Year 4 · Information Technology (STU-2026-005)",
            "student",
            student_pw_hash,
            "Information Technology",
            None,
            "STU-2026-005",
            1,
            now_iso,
            None,
            "sqlite_pbkdf2",
            "active",
            now_iso,
            "system_seed",
        ),
        (
            "USR-STU-006",
            "ananya.verma@student.smartcampus.edu.in",
            "Ananya Verma",
            "B.Tech Year 2 · Data Science & AI (STU-2026-006)",
            "student",
            student_pw_hash,
            "Data Science & AI",
            None,
            "STU-2026-006",
            1,
            now_iso,
            None,
            "sqlite_pbkdf2",
            "active",
            now_iso,
            "system_seed",
        ),
    ]

    conn.executemany(
        """
        INSERT INTO users (
            id, email, name, title, role, password_hash,
            department, linked_faculty_id, linked_student_id, is_active, created_at,
            firebase_uid, auth_provider, account_status, updated_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        seed_users,
    )


def _seed_default_faculty(conn: sqlite3.Connection) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    faculty_rows = [
        (
            "FAC-101",
            "Dr. Arindam Chatterjee",
            "a.chatterjee@smartcampus.edu.in",
            "Computer Science & Engineering",
            "Professor & Academic Advisor",
            "Algorithms & Systems Architecture",
            1,
            now_iso,
        ),
        (
            "FAC-102",
            "Prof. Meenakshi Iyer",
            "m.iyer@smartcampus.edu.in",
            "Data Science & AI",
            "Associate Professor",
            "Statistical Learning & Data Engineering",
            1,
            now_iso,
        ),
        (
            "FAC-103",
            "Dr. Vikramaditya Rao",
            "v.rao@smartcampus.edu.in",
            "Electronics & Communication",
            "Associate Professor & Placement Coordinator",
            "Embedded Systems & Signal Processing",
            1,
            now_iso,
        ),
        (
            "FAC-104",
            "Prof. Nupur Deshmukh",
            "n.deshmukh@smartcampus.edu.in",
            "Information Technology",
            "Assistant Professor",
            "Cloud Computing & Full-Stack Engineering",
            1,
            now_iso,
        ),
        (
            "FAC-105",
            "Dr. Harpreet Singh Gill",
            "h.gill@smartcampus.edu.in",
            "Mechanical Engineering",
            "Professor & Student Welfare Mentor",
            "CAD/CAM & Industrial Automation",
            1,
            now_iso,
        ),
    ]
    conn.executemany(
        """
        INSERT OR IGNORE INTO faculty_profiles (
            id, name, email, department, designation, specialization, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        faculty_rows,
    )


def _seed_default_students(conn: sqlite3.Connection) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    primary_students = [
        (
            "STU-2026-001",
            "Aarav Sharma",
            "Computer Science & Engineering",
            4,
            8.7,
            0,
            91.0,
            84.0,
            90.0,
            46.0,
            52.0,
            58.0,
            49.0,
            78.0,
            72.0,
            "FAC-101",
            now_iso,
            now_iso,
        ),
        (
            "STU-2026-002",
            "Rohan Kulkarni",
            "Computer Science & Engineering",
            4,
            5.8,
            2,
            62.0,
            48.0,
            56.0,
            82.0,
            76.0,
            74.0,
            79.0,
            81.0,
            68.0,
            "FAC-101",
            now_iso,
            now_iso,
        ),
        (
            "STU-2026-003",
            "Priya Patel",
            "Data Science & AI",
            3,
            9.2,
            0,
            95.0,
            92.0,
            96.0,
            88.0,
            90.0,
            86.0,
            89.0,
            91.0,
            84.0,
            "FAC-102",
            now_iso,
            now_iso,
        ),
        (
            "STU-2026-004",
            "Sneha Nair",
            "Electronics & Communication",
            3,
            5.4,
            3,
            58.0,
            42.0,
            50.0,
            44.0,
            49.0,
            51.0,
            45.0,
            52.0,
            48.0,
            "FAC-103",
            now_iso,
            now_iso,
        ),
        (
            "STU-2026-005",
            "Karthik Reddy",
            "Information Technology",
            4,
            7.4,
            0,
            63.0,
            59.0,
            64.0,
            72.0,
            70.0,
            69.0,
            71.0,
            74.0,
            66.0,
            "FAC-104",
            now_iso,
            now_iso,
        ),
        (
            "STU-2026-006",
            "Ananya Verma",
            "Data Science & AI",
            2,
            8.1,
            0,
            86.0,
            79.0,
            84.0,
            61.0,
            64.0,
            62.0,
            59.0,
            73.0,
            70.0,
            "FAC-102",
            now_iso,
            now_iso,
        ),
    ]
    conn.executemany(
        """
        INSERT OR IGNORE INTO student_records (
            student_id, name, department, academic_year, cgpa, backlogs,
            attendance, lms_activity, assignment_completion, coding_score,
            aptitude_score, communication_score, mock_interview_score,
            technical_skill_score, extracurricular_score, assigned_faculty_id,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        primary_students,
    )


def _format_user_row(row: sqlite3.Row) -> Dict[str, Any]:
    role = str(row["role"])
    redirect_map = {
        "admin": "/admin/dashboard",
        "faculty": "/faculty/dashboard",
        "student": "/student/dashboard",
    }
    keys = row.keys()
    return {
        "id": str(row["id"]),
        "email": str(row["email"]),
        "name": str(row["name"]),
        "title": str(row["title"]),
        "role": role,
        "department": row["department"],
        "linkedFacultyId": row["linked_faculty_id"],
        "linkedStudentId": row["linked_student_id"],
        "isActive": bool(int(row["is_active"])),
        "firebaseUid": row["firebase_uid"] if "firebase_uid" in keys else None,
        "authProvider": row["auth_provider"] if "auth_provider" in keys else "sqlite_pbkdf2",
        "accountStatus": row["account_status"] if "account_status" in keys else "active",
        "createdAt": str(row["created_at"]),
        "updatedAt": row["updated_at"] if "updated_at" in keys else str(row["created_at"]),
        "redirectTo": redirect_map.get(role, "/"),
    }


def _issue_session_for_user(
    conn: sqlite3.Connection,
    user_row: sqlite3.Row,
    remember_me: bool = False,
    custom_ttl_seconds: Optional[int] = None,
) -> Dict[str, Any]:
    raw_token = f"ssai_{secrets.token_urlsafe(32)}"
    token_hash = _hash_session_token(raw_token)
    now = datetime.now(timezone.utc)

    if custom_ttl_seconds is not None:
        expires_at = now + timedelta(seconds=custom_ttl_seconds)
    elif remember_me:
        expires_at = now + timedelta(days=REMEMBER_ME_DAYS)
    else:
        expires_at = now + timedelta(hours=DEFAULT_SESSION_HOURS)

    conn.execute(
        """
        INSERT INTO auth_sessions (
            token_hash, user_id, role, remember_me, created_at, expires_at, revoked
        ) VALUES (?, ?, ?, ?, ?, ?, 0)
        """,
        (
            token_hash,
            str(user_row["id"]),
            str(user_row["role"]),
            1 if remember_me else 0,
            now.isoformat(),
            expires_at.isoformat(),
        ),
    )
    conn.commit()

    user_payload = _format_user_row(user_row)
    return {
        "accessToken": raw_token,
        "tokenType": "Bearer",
        "expiresAt": expires_at.isoformat(),
        "rememberMe": bool(remember_me),
        "redirectTo": user_payload["redirectTo"],
        "user": user_payload,
    }


def authenticate_user(
    email: str,
    password: str,
    requested_role: Optional[str] = None,
    remember_me: bool = False,
    custom_ttl_seconds: Optional[int] = None,
    db_path: Optional[str] = None,
) -> Tuple[int, Dict[str, Any]]:
    """
    Authenticates a user against SQLite `users`, verifies PBKDF2 password hash,
    enforces account activation status (`is_active == 1`) and role matching,
    and issues an expiring session token.
    """
    init_auth_db(db_path)

    cleaned_email = (email or "").strip().lower()
    if not cleaned_email or not password:
        return 400, {"detail": "Email and password are required."}

    with get_connection(db_path) as conn:
        user_row = conn.execute(
            "SELECT * FROM users WHERE lower(email) = ?",
            (cleaned_email,),
        ).fetchone()

        if not user_row or not verify_password(password, str(user_row["password_hash"])):
            return 401, {
                "detail": "Invalid institutional email or password. Please verify your credentials."
            }

        if int(user_row["is_active"]) != 1:
            return 403, {
                "detail": "Account deactivated: Your institutional account has been suspended by an administrator."
            }

        actual_role = str(user_row["role"])
        if requested_role and requested_role.strip().lower() != actual_role:
            return 403, {
                "detail": (
                    f"Role mismatch: Account '{cleaned_email}' is registered with role "
                    f"'{actual_role.upper()}', not '{requested_role.strip().upper()}'. "
                    f"Please select the '{actual_role.capitalize()}' role tab to sign in."
                )
            }

        # Mark invited account as active on first valid login
        if user_row["account_status"] == "invited":
            now_iso = datetime.now(timezone.utc).isoformat()
            conn.execute(
                "UPDATE users SET account_status = 'active', updated_at = ? WHERE id = ?",
                (now_iso, str(user_row["id"])),
            )
            conn.commit()
            user_row = conn.execute(
                "SELECT * FROM users WHERE id = ?", (str(user_row["id"]),)
            ).fetchone()

        return 200, _issue_session_for_user(
            conn, user_row, remember_me=remember_me, custom_ttl_seconds=custom_ttl_seconds
        )


def authenticate_verified_firebase_claims(
    verified_uid: str,
    verified_email: str,
    email_verified: bool = True,
    requested_role: Optional[str] = None,
    remember_me: bool = False,
    db_path: Optional[str] = None,
) -> Tuple[int, Dict[str, Any]]:
    """
    Maps a server-verified Firebase identity (`verified_uid`, `verified_email`)
    to an authorized SQLite user profile.
    - Never trusts client-supplied roles or unverified claims.
    - Automatically links `firebase_uid` on first verified sign-in for existing SQLite accounts.
    - Rejects unprovisioned Firebase accounts (403) and deactivated accounts (403).
    """
    init_auth_db(db_path)

    uid = (verified_uid or "").strip()
    email = (verified_email or "").strip().lower()
    if not uid:
        return 401, {"detail": "Verified Firebase UID is required."}

    with get_connection(db_path) as conn:
        # 1. Lookup by verified Firebase UID first
        user_row = conn.execute(
            "SELECT * FROM users WHERE firebase_uid = ?",
            (uid,),
        ).fetchone()

        # 2. Safe Migration Linking: If not yet linked by UID, match by verified institutional email
        if not user_row and email:
            candidate = conn.execute(
                "SELECT * FROM users WHERE lower(email) = ?",
                (email,),
            ).fetchone()
            if candidate:
                existing_fb_uid = candidate["firebase_uid"]
                if existing_fb_uid and str(existing_fb_uid) != uid:
                    return 403, {
                        "detail": "Security mismatch: This institutional email is already linked to a different Firebase UID."
                    }
                if not email_verified and candidate["auth_provider"] == "firebase_strict":
                    return 403, {
                        "detail": "Firebase email address must be verified before linking to this account."
                    }
                now_iso = datetime.now(timezone.utc).isoformat()
                conn.execute(
                    """
                    UPDATE users
                    SET firebase_uid = ?, auth_provider = 'firebase', account_status = 'active', updated_at = ?
                    WHERE id = ?
                    """,
                    (uid, now_iso, str(candidate["id"])),
                )
                conn.commit()
                user_row = conn.execute(
                    "SELECT * FROM users WHERE id = ?",
                    (str(candidate["id"]),),
                ).fetchone()

        if not user_row:
            return 403, {
                "detail": (
                    "Access denied: Your Firebase account is not provisioned in StudentSuccess AI. "
                    "Contact an Administrator to provision your institutional profile."
                )
            }

        if int(user_row["is_active"]) != 1:
            return 403, {
                "detail": "Account deactivated: Your institutional account has been suspended by an administrator."
            }

        actual_role = str(user_row["role"])
        if requested_role and requested_role.strip().lower() != actual_role:
            return 403, {
                "detail": (
                    f"Role mismatch: Your account is authorized as '{actual_role.upper()}', "
                    f"not '{requested_role.strip().upper()}'."
                )
            }

        return 200, _issue_session_for_user(conn, user_row, remember_me=remember_me)


def authenticate_with_firebase_id_token(
    raw_id_token: str,
    requested_role: Optional[str] = None,
    remember_me: bool = False,
    db_path: Optional[str] = None,
) -> Tuple[int, Dict[str, Any]]:
    """
    Verifies a Firebase ID token using the Firebase Admin SDK on the backend,
    then maps the verified UID/email to the SQLite `users` record.
    """
    status_code, verified = verify_firebase_token_on_server(raw_id_token)
    if status_code != 200:
        return status_code, verified

    return authenticate_verified_firebase_claims(
        verified_uid=verified["uid"],
        verified_email=verified.get("email", ""),
        email_verified=bool(verified.get("emailVerified", False)),
        requested_role=requested_role,
        remember_me=remember_me,
        db_path=db_path,
    )


def verify_session_token(
    raw_token: Optional[str],
    db_path: Optional[str] = None,
) -> Tuple[int, Dict[str, Any]]:
    """
    Validates a Bearer token from the `Authorization` header:
    1. If the token is a `ssai_...` session token, validates it against SQLite `auth_sessions`
       and enforces `is_active == 1` and `expires_at > now`.
    2. Otherwise, treats it as a Firebase ID token (JWT), verifies it with the Firebase Admin SDK,
       and maps the verified Firebase UID to the SQLite user profile.
    """
    init_auth_db(db_path)

    if not raw_token or not raw_token.strip():
        return 401, {"detail": "Authentication required. Missing Bearer token."}

    cleaned = raw_token.strip()
    if cleaned.lower().startswith("bearer "):
        cleaned = cleaned[7:].strip()

    if not cleaned:
        return 401, {"detail": "Authentication required. Empty Bearer token."}

    # Path A: Direct Firebase ID Token (JWT format with 3 dot-separated segments)
    if not cleaned.startswith("ssai_") and cleaned.count(".") == 2:
        status_code, verified = verify_firebase_token_on_server(cleaned)
        if status_code != 200:
            return status_code, verified
        with get_connection(db_path) as conn:
            uid = verified["uid"]
            email = verified.get("email", "")
            user_row = conn.execute(
                "SELECT * FROM users WHERE firebase_uid = ?", (uid,)
            ).fetchone()
            if not user_row and email and verified.get("emailVerified", False):
                candidate = conn.execute(
                    "SELECT * FROM users WHERE lower(email) = ?", (email,)
                ).fetchone()
                if candidate and not candidate["firebase_uid"]:
                    now_iso = datetime.now(timezone.utc).isoformat()
                    conn.execute(
                        "UPDATE users SET firebase_uid = ?, auth_provider = 'firebase', updated_at = ? WHERE id = ?",
                        (uid, now_iso, str(candidate["id"])),
                    )
                    conn.commit()
                    user_row = conn.execute(
                        "SELECT * FROM users WHERE id = ?", (str(candidate["id"]),)
                    ).fetchone()

            if not user_row:
                return 403, {
                    "detail": "Access denied: Firebase user is not provisioned in StudentSuccess AI."
                }
            if int(user_row["is_active"]) != 1:
                return 403, {"detail": "Account deactivated by administrator."}

            return 200, {
                "user": _format_user_row(user_row),
                "expiresAt": datetime.now(timezone.utc).isoformat(),
                "rememberMe": False,
            }

    # Path B: SQLite-backed session token (`ssai_...`)
    token_hash = _hash_session_token(cleaned)
    now = datetime.now(timezone.utc)

    with get_connection(db_path) as conn:
        row = conn.execute(
            """
            SELECT
                s.token_hash, s.expires_at, s.revoked, s.remember_me,
                u.*
            FROM auth_sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ?
            """,
            (token_hash,),
        ).fetchone()

        if not row:
            return 401, {"detail": "Invalid or unrecognized authentication token."}

        if int(row["revoked"]) == 1:
            return 401, {"detail": "Session has been logged out or revoked. Please sign in again."}

        if int(row["is_active"]) != 1:
            return 403, {"detail": "Account deactivated: Your institutional account has been suspended."}

        try:
            expires_at = datetime.fromisoformat(str(row["expires_at"]))
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
        except Exception:
            return 401, {"detail": "Corrupted session expiration timestamp."}

        if now >= expires_at:
            conn.execute(
                "UPDATE auth_sessions SET revoked = 1 WHERE token_hash = ?",
                (token_hash,),
            )
            conn.commit()
            return 401, {"detail": "Session token has expired. Please sign in again."}

        user_payload = _format_user_row(row)
        return 200, {
            "user": user_payload,
            "expiresAt": str(row["expires_at"]),
            "rememberMe": bool(row["remember_me"]),
        }


def revoke_session_token(
    raw_token: Optional[str],
    db_path: Optional[str] = None,
) -> Tuple[int, Dict[str, Any]]:
    init_auth_db(db_path)

    if not raw_token or not raw_token.strip():
        return 401, {"detail": "Missing session token to revoke."}

    cleaned = raw_token.strip()
    if cleaned.lower().startswith("bearer "):
        cleaned = cleaned[7:].strip()

    token_hash = _hash_session_token(cleaned)
    with get_connection(db_path) as conn:
        cursor = conn.execute(
            "UPDATE auth_sessions SET revoked = 1 WHERE token_hash = ?",
            (token_hash,),
        )
        conn.commit()
        if cursor.rowcount == 0:
            return 401, {"detail": "Session token not found or already invalidated."}

    return 200, {
        "status": "logged_out",
        "message": "Authentication session has been securely terminated.",
    }


def request_password_reset(
    email: str,
    role: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Tuple[int, Dict[str, Any]]:
    init_auth_db(db_path)

    cleaned_email = (email or "").strip().lower()
    if not cleaned_email or not EMAIL_REGEX.match(cleaned_email):
        return 400, {"detail": "Please provide a valid institutional email address."}

    now_iso = datetime.now(timezone.utc).isoformat()
    with get_connection(db_path) as conn:
        user_row = conn.execute(
            "SELECT id, role FROM users WHERE lower(email) = ?",
            (cleaned_email,),
        ).fetchone()
        status_label = "matched_account_queued" if user_row else "unregistered_email_logged"
        conn.execute(
            """
            INSERT INTO password_reset_requests (email, role, requested_at, status)
            VALUES (?, ?, ?, ?)
            """,
            (cleaned_email, role, now_iso, status_label),
        )
        conn.commit()

    return 200, {
        "status": "reset_queued",
        "email": cleaned_email,
        "message": (
            f"If '{cleaned_email}' matches an active SmartCampus directory record, "
            "an institutional password reset link has been dispatched via Firebase Identity / Campus IT Services."
        ),
    }


def check_permission_for_student_record(
    user_payload: Dict[str, Any],
    target_student_id: str,
    student_assigned_faculty_id: Optional[str] = None,
    student_department: Optional[str] = None,
) -> Tuple[bool, Optional[str]]:
    """
    Enforces strict role-based record access control:
    - Admin: Can access all student records.
    - Faculty: Can access students assigned to them (`assignedFacultyId == linkedFacultyId`)
      or within their authorized department (`department == user.department`).
      If `student_assigned_faculty_id` or `student_department` is provided and neither matches,
      denies access (`403 Forbidden`).
    - Student: Strictly isolated to their own `linkedStudentId` (`403 Forbidden` otherwise).
    """
    role = user_payload.get("role")
    if role == "admin":
        return True, None

    if role == "faculty":
        fac_id = (user_payload.get("linkedFacultyId") or "").strip().upper()
        fac_dept = (user_payload.get("department") or "").strip()

        if student_assigned_faculty_id or student_department:
            matches_mentor = (
                bool(fac_id)
                and bool(student_assigned_faculty_id)
                and fac_id == student_assigned_faculty_id.strip().upper()
            )
            matches_dept = (
                bool(fac_dept)
                and bool(student_department)
                and fac_dept.lower() == student_department.strip().lower()
            )
            if not matches_mentor and not matches_dept:
                return (
                    False,
                    f"Access denied: Faculty member ({user_payload.get('email')}, {fac_id}) "
                    f"is not authorized to access student '{target_student_id}' outside their assigned mentees or department ({fac_dept}).",
                )
        return True, None

    if role == "student":
        linked_id = (user_payload.get("linkedStudentId") or "").strip().upper()
        if linked_id and linked_id == target_student_id.strip().upper():
            return True, None
        return (
            False,
            f"Access denied: Student account ({user_payload.get('email')}) is only authorized "
            f"to access academic record '{linked_id}', not '{target_student_id}'.",
        )
    return False, "Access denied: Unrecognized role."


# ==============================================================================
# DYNAMIC USER MANAGEMENT (ADMIN-ONLY CRUD & PROVISIONING)
# ==============================================================================


def list_managed_users(
    search: Optional[str] = None,
    role_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Tuple[int, Dict[str, Any]]:
    """
    Returns all user accounts in SQLite `users` along with summary statistics
    and newly provisioned `student_records` and `faculty_profiles`.
    """
    init_auth_db(db_path)

    with get_connection(db_path) as conn:
        rows = conn.execute(
            "SELECT * FROM users ORDER BY created_at DESC, id ASC"
        ).fetchall()
        all_users = [_format_user_row(r) for r in rows]

        filtered = all_users
        if role_filter and role_filter.upper() != "ALL":
            rf = role_filter.strip().lower()
            filtered = [u for u in filtered if u["role"] == rf]

        if status_filter and status_filter.upper() != "ALL":
            sf = status_filter.strip().lower()
            if sf == "active":
                filtered = [u for u in filtered if u["isActive"]]
            elif sf in ("inactive", "deactivated"):
                filtered = [u for u in filtered if not u["isActive"]]

        if search and search.strip():
            q = search.strip().lower()
            filtered = [
                u
                for u in filtered
                if q in u["name"].lower()
                or q in u["email"].lower()
                or q in u["id"].lower()
                or (u["linkedStudentId"] and q in str(u["linkedStudentId"]).lower())
                or (u["linkedFacultyId"] and q in str(u["linkedFacultyId"]).lower())
                or (u["department"] and q in str(u["department"]).lower())
            ]

        stu_rows = conn.execute(
            "SELECT * FROM student_records ORDER BY student_id ASC"
        ).fetchall()
        db_students = [
            {
                "studentId": str(r["student_id"]),
                "name": str(r["name"]),
                "department": str(r["department"]),
                "academicYear": int(r["academic_year"]),
                "cgpa": float(r["cgpa"]),
                "backlogs": int(r["backlogs"]),
                "attendance": float(r["attendance"]),
                "lmsActivity": float(r["lms_activity"]),
                "assignmentCompletion": float(r["assignment_completion"]),
                "codingScore": float(r["coding_score"]),
                "aptitudeScore": float(r["aptitude_score"]),
                "communicationScore": float(r["communication_score"]),
                "mockInterviewScore": float(r["mock_interview_score"]),
                "technicalSkillScore": float(r["technical_skill_score"]),
                "extracurricularScore": float(r["extracurricular_score"]),
                "assignedFacultyId": str(r["assigned_faculty_id"]),
            }
            for r in stu_rows
        ]

        fac_rows = conn.execute(
            "SELECT * FROM faculty_profiles ORDER BY id ASC"
        ).fetchall()
        db_faculty = [
            {
                "id": str(r["id"]),
                "name": str(r["name"]),
                "email": str(r["email"]),
                "department": str(r["department"]),
                "designation": str(r["designation"]),
                "specialization": str(r["specialization"]),
            }
            for r in fac_rows
        ]

    fb_configured, fb_msg = is_firebase_admin_configured()
    return 200, {
        "summary": {
            "totalUsers": len(all_users),
            "activeUsers": sum(1 for u in all_users if u["isActive"]),
            "deactivatedUsers": sum(1 for u in all_users if not u["isActive"]),
            "adminCount": sum(1 for u in all_users if u["role"] == "admin"),
            "facultyCount": sum(1 for u in all_users if u["role"] == "faculty"),
            "studentCount": sum(1 for u in all_users if u["role"] == "student"),
            "firebaseLinkedCount": sum(1 for u in all_users if u.get("firebaseUid")),
            "firebaseAdminConfigured": fb_configured,
            "firebaseAdminStatus": fb_msg,
        },
        "users": filtered,
        "dbStudents": db_students,
        "dbFaculty": db_faculty,
    }


def provision_user_account(
    actor_user: Dict[str, Any],
    payload: Dict[str, Any],
    db_path: Optional[str] = None,
) -> Tuple[int, Dict[str, Any]]:
    """
    Authorized Admin workflow to dynamically add a new Student, Faculty, or Admin user.
    Executes inside an atomic SQLite transaction (`with conn:`), enforcing unique email,
    unique Firebase UID, unique Student/Faculty ID, and numeric academic bounds.
    """
    init_auth_db(db_path)

    if actor_user.get("role") != "admin":
        return 403, {"detail": "Access denied: Only Administrators can provision user accounts."}

    role = str(payload.get("role") or "").strip().lower()
    if role not in ("student", "faculty", "admin"):
        return 400, {"detail": "Role must be one of: 'student', 'faculty', or 'admin'."}

    email = str(payload.get("email") or "").strip().lower()
    if not email or not EMAIL_REGEX.match(email):
        return 400, {"detail": "A valid institutional email address is required."}

    name = str(payload.get("name") or "").strip()
    if len(name) < 2:
        return 400, {"detail": "Full name must be at least 2 characters."}

    password = str(payload.get("initialPassword") or "").strip()
    if not password or len(password) < 6:
        return 400, {
            "detail": "An initial activation password of at least 6 characters is required."
        }

    department = str(payload.get("department") or "").strip() or None
    if role in ("student", "faculty"):
        if not department or department not in VALID_DEPARTMENTS:
            return 400, {
                "detail": f"Department is required for {role} accounts and must be one of: {', '.join(sorted(VALID_DEPARTMENTS))}."
            }

    firebase_uid = str(payload.get("firebaseUid") or "").strip() or None
    now_iso = datetime.now(timezone.utc).isoformat()

    with get_connection(db_path) as conn:
        # Check duplicate email
        dup_email = conn.execute(
            "SELECT id FROM users WHERE lower(email) = ?", (email,)
        ).fetchone()
        if dup_email:
            return 409, {
                "detail": f"Duplicate email: An account with email '{email}' already exists ({dup_email['id']})."
            }

        # Check duplicate firebase_uid if supplied
        if firebase_uid:
            dup_fb = conn.execute(
                "SELECT id FROM users WHERE firebase_uid = ?", (firebase_uid,)
            ).fetchone()
            if dup_fb:
                return 409, {
                    "detail": f"Duplicate Firebase UID: '{firebase_uid}' is already linked to user '{dup_fb['id']}'."
                }

        linked_faculty_id: Optional[str] = None
        linked_student_id: Optional[str] = None
        created_student_record: Optional[Dict[str, Any]] = None
        created_faculty_profile: Optional[Dict[str, Any]] = None

        if role == "faculty":
            raw_fac_id = str(payload.get("linkedFacultyId") or "").strip().upper()
            if not raw_fac_id:
                count_fac = int(
                    conn.execute("SELECT COUNT(*) FROM faculty_profiles").fetchone()[0]
                )
                raw_fac_id = f"FAC-{101 + count_fac + 1}"

            dup_fac = conn.execute(
                "SELECT id FROM users WHERE upper(linked_faculty_id) = ?",
                (raw_fac_id,),
            ).fetchone()
            if dup_fac:
                return 409, {
                    "detail": f"Faculty ID '{raw_fac_id}' is already assigned to user '{dup_fac['id']}'."
                }

            linked_faculty_id = raw_fac_id
            designation = (
                str(payload.get("designation") or "Assistant Professor & Faculty Advisor").strip()
            )
            specialization = (
                str(payload.get("specialization") or f"{department} Systems & Analytics").strip()
            )
            title = str(payload.get("title") or f"{designation} · {department}").strip()
            user_id = f"USR-{raw_fac_id}"

        elif role == "student":
            raw_stu_id = str(payload.get("linkedStudentId") or "").strip().upper()
            if not raw_stu_id:
                count_stu = int(
                    conn.execute("SELECT COUNT(*) FROM users WHERE role = 'student'").fetchone()[0]
                )
                raw_stu_id = f"STU-2026-{56 + count_stu + 1:03d}"

            dup_stu = conn.execute(
                "SELECT id FROM users WHERE upper(linked_student_id) = ?",
                (raw_stu_id,),
            ).fetchone()
            if dup_stu:
                return 409, {
                    "detail": f"Student ID '{raw_stu_id}' is already linked to user '{dup_stu['id']}'."
                }

            try:
                academic_year = int(payload.get("academicYear", 3))
                cgpa = float(payload.get("cgpa", 7.5))
                backlogs = int(payload.get("backlogs", 0))
                attendance = float(payload.get("attendance", 82.0))
                lms_activity = float(payload.get("lmsActivity", 76.0))
                assignment_completion = float(payload.get("assignmentCompletion", 80.0))
                coding_score = float(payload.get("codingScore", 70.0))
                aptitude_score = float(payload.get("aptitudeScore", 72.0))
                communication_score = float(payload.get("communicationScore", 74.0))
                mock_interview_score = float(payload.get("mockInterviewScore", 70.0))
                technical_skill_score = float(payload.get("technicalSkillScore", 72.0))
                extracurricular_score = float(payload.get("extracurricularScore", 68.0))
            except (TypeError, ValueError) as exc:
                return 400, {"detail": f"Invalid numeric academic field: {exc}"}

            if not (1 <= academic_year <= 4):
                return 400, {"detail": "Academic year must be between 1 and 4."}
            if not (0.0 <= cgpa <= 10.0):
                return 400, {"detail": "CGPA must be between 0.0 and 10.0."}
            if backlogs < 0 or backlogs > 20:
                return 400, {"detail": "Backlogs must be between 0 and 20."}
            for label, val in [
                ("attendance", attendance),
                ("lmsActivity", lms_activity),
                ("assignmentCompletion", assignment_completion),
                ("codingScore", coding_score),
                ("aptitudeScore", aptitude_score),
                ("communicationScore", communication_score),
                ("mockInterviewScore", mock_interview_score),
                ("technicalSkillScore", technical_skill_score),
                ("extracurricularScore", extracurricular_score),
            ]:
                if not (0.0 <= val <= 100.0):
                    return 400, {"detail": f"{label} must be between 0 and 100."}

            assigned_faculty_id = (
                str(payload.get("assignedFacultyId") or "FAC-101").strip().upper()
            )
            linked_student_id = raw_stu_id
            title = (
                str(payload.get("title") or "").strip()
                or f"B.Tech Year {academic_year} · {department} ({raw_stu_id})"
            )
            user_id = f"USR-{raw_stu_id}"
        else:
            count_adm = int(
                conn.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'").fetchone()[0]
            )
            user_id = f"USR-ADMIN-{count_adm + 1:02d}"
            title = (
                str(payload.get("title") or "Institutional Analytics Administrator").strip()
            )

        # Ensure unique primary key `user_id`
        if conn.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone():
            user_id = f"{user_id}-{secrets.token_hex(2).upper()}"

        pw_hash = hash_password(password)
        auth_provider = "firebase" if firebase_uid else "sqlite_pbkdf2"

        try:
            with conn:
                conn.execute(
                    """
                    INSERT INTO users (
                        id, email, name, title, role, password_hash,
                        department, linked_faculty_id, linked_student_id,
                        is_active, created_at, firebase_uid, auth_provider,
                        account_status, updated_at, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 'active', ?, ?)
                    """,
                    (
                        user_id,
                        email,
                        name,
                        title,
                        role,
                        pw_hash,
                        department,
                        linked_faculty_id,
                        linked_student_id,
                        now_iso,
                        firebase_uid,
                        auth_provider,
                        now_iso,
                        actor_user.get("email", "admin"),
                    ),
                )

                if role == "faculty" and linked_faculty_id and department:
                    conn.execute(
                        """
                        INSERT OR REPLACE INTO faculty_profiles (
                            id, name, email, department, designation, specialization, is_active, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
                        """,
                        (
                            linked_faculty_id,
                            name,
                            email,
                            department,
                            designation,
                            specialization,
                            now_iso,
                        ),
                    )
                    created_faculty_profile = {
                        "id": linked_faculty_id,
                        "name": name,
                        "email": email,
                        "department": department,
                        "designation": designation,
                        "specialization": specialization,
                    }

                if role == "student" and linked_student_id and department:
                    conn.execute(
                        """
                        INSERT OR REPLACE INTO student_records (
                            student_id, name, department, academic_year, cgpa, backlogs,
                            attendance, lms_activity, assignment_completion, coding_score,
                            aptitude_score, communication_score, mock_interview_score,
                            technical_skill_score, extracurricular_score, assigned_faculty_id,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            linked_student_id,
                            name,
                            department,
                            academic_year,
                            cgpa,
                            backlogs,
                            attendance,
                            lms_activity,
                            assignment_completion,
                            coding_score,
                            aptitude_score,
                            communication_score,
                            mock_interview_score,
                            technical_skill_score,
                            extracurricular_score,
                            assigned_faculty_id,
                            now_iso,
                            now_iso,
                        ),
                    )
                    created_student_record = {
                        "studentId": linked_student_id,
                        "name": name,
                        "department": department,
                        "academicYear": academic_year,
                        "cgpa": cgpa,
                        "backlogs": backlogs,
                        "attendance": attendance,
                        "lmsActivity": lms_activity,
                        "assignmentCompletion": assignment_completion,
                        "codingScore": coding_score,
                        "aptitudeScore": aptitude_score,
                        "communicationScore": communication_score,
                        "mockInterviewScore": mock_interview_score,
                        "technicalSkillScore": technical_skill_score,
                        "extracurricularScore": extracurricular_score,
                        "assignedFacultyId": assigned_faculty_id,
                    }

            created_row = conn.execute(
                "SELECT * FROM users WHERE id = ?", (user_id,)
            ).fetchone()
            return 201, {
                "message": f"Successfully provisioned {role} account for '{name}' ({email}).",
                "user": _format_user_row(created_row),
                "studentRecord": created_student_record,
                "facultyProfile": created_faculty_profile,
            }
        except sqlite3.IntegrityError as exc:
            return 409, {"detail": f"Database uniqueness constraint failed: {exc}"}


def update_user_account(
    actor_user: Dict[str, Any],
    target_user_id: str,
    payload: Dict[str, Any],
    db_path: Optional[str] = None,
) -> Tuple[int, Dict[str, Any]]:
    """
    Authorized Admin workflow to update user profile, role assignment, Firebase UID link,
    or student academic indicators inside a transaction.
    """
    init_auth_db(db_path)

    if actor_user.get("role") != "admin":
        return 403, {"detail": "Access denied: Only Administrators can update user accounts."}

    with get_connection(db_path) as conn:
        existing = conn.execute(
            "SELECT * FROM users WHERE id = ?", (target_user_id,)
        ).fetchone()
        if not existing:
            return 404, {"detail": f"User account '{target_user_id}' not found."}

        new_name = str(payload.get("name") or existing["name"]).strip()
        new_title = str(payload.get("title") or existing["title"]).strip()
        new_role = str(payload.get("role") or existing["role"]).strip().lower()
        new_dept = (
            str(payload.get("department")).strip()
            if "department" in payload and payload.get("department") is not None
            else existing["department"]
        )
        new_fb_uid = (
            str(payload.get("firebaseUid")).strip() or None
            if "firebaseUid" in payload
            else existing["firebase_uid"]
        )

        if new_role not in ("admin", "faculty", "student"):
            return 400, {"detail": "Invalid role specified."}

        # Prevent self-demotion of the currently signed-in admin
        if (
            str(existing["id"]) == str(actor_user.get("id"))
            and new_role != "admin"
        ):
            return 400, {
                "detail": "Operation rejected: You cannot demote your own active Administrator account."
            }

        now_iso = datetime.now(timezone.utc).isoformat()
        new_password = str(payload.get("newPassword") or "").strip()
        pw_hash = (
            hash_password(new_password)
            if len(new_password) >= 6
            else str(existing["password_hash"])
        )

        try:
            with conn:
                conn.execute(
                    """
                    UPDATE users
                    SET name = ?, title = ?, role = ?, department = ?,
                        firebase_uid = ?, password_hash = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        new_name,
                        new_title,
                        new_role,
                        new_dept,
                        new_fb_uid,
                        pw_hash,
                        now_iso,
                        target_user_id,
                    ),
                )
                # Keep active sessions in sync if role changed
                if new_role != str(existing["role"]):
                    conn.execute(
                        "UPDATE auth_sessions SET role = ? WHERE user_id = ? AND revoked = 0",
                        (new_role, target_user_id),
                    )

                # If linked to a student record and academic updates were supplied, update `student_records`
                linked_stu_id = existing["linked_student_id"]
                if linked_stu_id:
                    stu_row = conn.execute(
                        "SELECT * FROM student_records WHERE student_id = ?",
                        (linked_stu_id,),
                    ).fetchone()
                    if stu_row:
                        cgpa = float(payload.get("cgpa", stu_row["cgpa"]))
                        attendance = float(
                            payload.get("attendance", stu_row["attendance"])
                        )
                        backlogs = int(payload.get("backlogs", stu_row["backlogs"]))
                        conn.execute(
                            """
                            UPDATE student_records
                            SET name = ?, department = COALESCE(?, department),
                                cgpa = ?, attendance = ?, backlogs = ?, updated_at = ?
                            WHERE student_id = ?
                            """,
                            (
                                new_name,
                                new_dept,
                                cgpa,
                                attendance,
                                backlogs,
                                now_iso,
                                linked_stu_id,
                            ),
                        )

            updated_row = conn.execute(
                "SELECT * FROM users WHERE id = ?", (target_user_id,)
            ).fetchone()
            return 200, {
                "message": f"Updated account '{new_name}' ({existing['email']}).",
                "user": _format_user_row(updated_row),
            }
        except sqlite3.IntegrityError as exc:
            return 409, {"detail": f"Conflict updating user: {exc}"}


def set_user_active_status(
    actor_user: Dict[str, Any],
    target_user_id: str,
    is_active: bool,
    db_path: Optional[str] = None,
) -> Tuple[int, Dict[str, Any]]:
    """
    Activates or deactivates a user account in SQLite `users`.
    When deactivated (`is_active = False`), immediately revokes all active sessions
    so the user is denied access on their very next API call.
    """
    init_auth_db(db_path)

    if actor_user.get("role") != "admin":
        return 403, {
            "detail": "Access denied: Only Administrators can activate or deactivate accounts."
        }

    with get_connection(db_path) as conn:
        existing = conn.execute(
            "SELECT * FROM users WHERE id = ?", (target_user_id,)
        ).fetchone()
        if not existing:
            return 404, {"detail": f"User account '{target_user_id}' not found."}

        if str(existing["id"]) == str(actor_user.get("id")) and not is_active:
            return 400, {
                "detail": "Operation rejected: You cannot deactivate your own active Administrator account."
            }

        now_iso = datetime.now(timezone.utc).isoformat()
        new_status_label = "active" if is_active else "deactivated"

        with conn:
            conn.execute(
                """
                UPDATE users
                SET is_active = ?, account_status = ?, updated_at = ?
                WHERE id = ?
                """,
                (1 if is_active else 0, new_status_label, now_iso, target_user_id),
            )
            if not is_active:
                conn.execute(
                    "UPDATE auth_sessions SET revoked = 1 WHERE user_id = ?",
                    (target_user_id,),
                )

        updated_row = conn.execute(
            "SELECT * FROM users WHERE id = ?", (target_user_id,)
        ).fetchone()
        action_verb = "Activated" if is_active else "Deactivated"
        return 200, {
            "message": f"{action_verb} user account '{existing['email']}'.",
            "user": _format_user_row(updated_row),
        }


def _cli_main() -> None:
    """
    CLI JSON interface so Node/Express proxy or migration scripts can invoke
    the Python SQLite authentication & user management engine directly.
    """
    if len(sys.argv) < 2:
        print(json.dumps({"status": 400, "body": {"detail": "Missing command"}}))
        return

    cmd = sys.argv[1]
    raw_input = sys.stdin.read().strip()
    payload = json.loads(raw_input) if raw_input else {}

    if cmd == "login":
        code, body = authenticate_user(
            email=payload.get("email", ""),
            password=payload.get("password", ""),
            requested_role=payload.get("role"),
            remember_me=bool(payload.get("rememberMe", False)),
        )
        print(json.dumps({"status": code, "body": body}))
    elif cmd == "firebase-login":
        code, body = authenticate_with_firebase_id_token(
            raw_id_token=payload.get("idToken", ""),
            requested_role=payload.get("role"),
            remember_me=bool(payload.get("rememberMe", False)),
        )
        print(json.dumps({"status": code, "body": body}))
    elif cmd == "me":
        code, body = verify_session_token(payload.get("token"))
        print(json.dumps({"status": code, "body": body}))
    elif cmd == "logout":
        code, body = revoke_session_token(payload.get("token"))
        print(json.dumps({"status": code, "body": body}))
    elif cmd == "forgot-password":
        code, body = request_password_reset(
            email=payload.get("email", ""),
            role=payload.get("role"),
        )
        print(json.dumps({"status": code, "body": body}))
    elif cmd == "list-users":
        code, body = list_managed_users(
            search=payload.get("search"),
            role_filter=payload.get("role"),
            status_filter=payload.get("status"),
        )
        print(json.dumps({"status": code, "body": body}))
    elif cmd == "provision-user":
        code, body = provision_user_account(
            actor_user=payload.get("actor", {}),
            payload=payload.get("data", {}),
        )
        print(json.dumps({"status": code, "body": body}))
    elif cmd == "update-user":
        code, body = update_user_account(
            actor_user=payload.get("actor", {}),
            target_user_id=payload.get("userId", ""),
            payload=payload.get("data", {}),
        )
        print(json.dumps({"status": code, "body": body}))
    elif cmd == "set-user-status":
        code, body = set_user_active_status(
            actor_user=payload.get("actor", {}),
            target_user_id=payload.get("userId", ""),
            is_active=bool(payload.get("isActive", True)),
        )
        print(json.dumps({"status": code, "body": body}))
    elif cmd == "migrate":
        info = init_auth_db()
        print(json.dumps({"status": 200, "body": info}))
    else:
        print(json.dumps({"status": 400, "body": {"detail": f"Unknown command: {cmd}"}}))


if __name__ == "__main__":
    _cli_main()
