"""
Automated Unit & Integration Tests for StudentSuccess AI Authentication & RBAC.
Tests:
1. Admin, Faculty, and Student login (`POST /auth/login`) and role redirect paths
2. Invalid password and unregistered email rejection (`401 Unauthorized`)
3. Role tab mismatch rejection (`403 Forbidden`)
4. Session verification (`GET /auth/me`) and unauthorized token rejection (`401`)
5. Session expiration enforcement (`401` on expired token)
6. Session revocation on logout (`POST /auth/logout` -> subsequent `/auth/me` returns `401`)
7. Student record ownership isolation (`STU-2026-001` blocked from `STU-2026-002` with `403`)
8. PBKDF2-HMAC-SHA256 password hashing and constant-time verification
"""

import os
import tempfile
import unittest

from backend.auth_db import (
    authenticate_user,
    authenticate_verified_firebase_claims,
    check_permission_for_student_record,
    create_verified_db_backup,
    hash_password,
    init_auth_db,
    list_managed_users,
    provision_user_account,
    request_password_reset,
    revoke_session_token,
    set_user_active_status,
    update_user_account,
    verify_password,
    verify_session_token,
)


class TestStudentSuccessAuthentication(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "test_studentsuccess.db")
        init_auth_db(self.db_path)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_01_password_hashing_and_verification(self) -> None:
        hashed = hash_password("SecurePass!2026")
        self.assertTrue(hashed.startswith("pbkdf2_sha256$260000$"))
        self.assertTrue(verify_password("SecurePass!2026", hashed))
        self.assertFalse(verify_password("WrongPass!2026", hashed))
        self.assertFalse(verify_password("SecurePass!2026", "invalid_hash_format"))

    def test_02_valid_login_all_roles_and_redirects(self) -> None:
        # Admin Login
        code, admin_res = authenticate_user(
            "dean.academics@smartcampus.edu.in",
            "Admin@2026",
            requested_role="admin",
            db_path=self.db_path,
        )
        self.assertEqual(code, 200)
        self.assertEqual(admin_res["user"]["role"], "admin")
        self.assertEqual(admin_res["redirectTo"], "/admin/dashboard")
        self.assertTrue(admin_res["accessToken"].startswith("ssai_"))

        # Faculty Login
        code, fac_res = authenticate_user(
            "a.chatterjee@smartcampus.edu.in",
            "Faculty@2026",
            requested_role="faculty",
            db_path=self.db_path,
        )
        self.assertEqual(code, 200)
        self.assertEqual(fac_res["user"]["role"], "faculty")
        self.assertEqual(fac_res["user"]["linkedFacultyId"], "FAC-101")
        self.assertEqual(fac_res["redirectTo"], "/faculty/dashboard")

        # Student Login
        code, stu_res = authenticate_user(
            "aarav.sharma@student.smartcampus.edu.in",
            "Student@2026",
            requested_role="student",
            db_path=self.db_path,
        )
        self.assertEqual(code, 200)
        self.assertEqual(stu_res["user"]["role"], "student")
        self.assertEqual(stu_res["user"]["linkedStudentId"], "STU-2026-001")
        self.assertEqual(stu_res["redirectTo"], "/student/dashboard")

    def test_03_invalid_credentials_rejected_with_401(self) -> None:
        # Wrong password
        code, res = authenticate_user(
            "dean.academics@smartcampus.edu.in",
            "WrongPassword123",
            requested_role="admin",
            db_path=self.db_path,
        )
        self.assertEqual(code, 401)
        self.assertIn("Invalid institutional email or password", res["detail"])

        # Unknown email
        code2, res2 = authenticate_user(
            "nonexistent.user@smartcampus.edu.in",
            "Admin@2026",
            requested_role="admin",
            db_path=self.db_path,
        )
        self.assertEqual(code2, 401)

    def test_04_role_mismatch_rejected_with_403(self) -> None:
        # Student attempting to sign in as Admin
        code, res = authenticate_user(
            "aarav.sharma@student.smartcampus.edu.in",
            "Student@2026",
            requested_role="admin",
            db_path=self.db_path,
        )
        self.assertEqual(code, 403)
        self.assertIn("Role mismatch", res["detail"])

    def test_05_session_me_and_logout_revocation(self) -> None:
        code, login_res = authenticate_user(
            "a.chatterjee@smartcampus.edu.in",
            "Faculty@2026",
            requested_role="faculty",
            remember_me=True,
            db_path=self.db_path,
        )
        self.assertEqual(code, 200)
        token = login_res["accessToken"]

        # GET /auth/me succeeds while active
        me_code, me_res = verify_session_token(f"Bearer {token}", db_path=self.db_path)
        self.assertEqual(me_code, 200)
        self.assertEqual(me_res["user"]["email"], "a.chatterjee@smartcampus.edu.in")
        self.assertTrue(me_res["rememberMe"])

        # POST /auth/logout revokes session
        out_code, _ = revoke_session_token(token, db_path=self.db_path)
        self.assertEqual(out_code, 200)

        # Subsequent GET /auth/me fails with 401
        after_code, after_res = verify_session_token(token, db_path=self.db_path)
        self.assertEqual(after_code, 401)
        self.assertIn("revoked", after_res["detail"])

    def test_06_expired_session_rejected_with_401(self) -> None:
        code, login_res = authenticate_user(
            "aarav.sharma@student.smartcampus.edu.in",
            "Student@2026",
            requested_role="student",
            custom_ttl_seconds=-10,  # Already expired 10 seconds ago
            db_path=self.db_path,
        )
        self.assertEqual(code, 200)
        token = login_res["accessToken"]

        me_code, me_res = verify_session_token(token, db_path=self.db_path)
        self.assertEqual(me_code, 401)
        self.assertIn("expired", me_res["detail"])

    def test_07_unauthorized_access_without_token(self) -> None:
        code1, _ = verify_session_token(None, db_path=self.db_path)
        self.assertEqual(code1, 401)
        code2, _ = verify_session_token("Bearer invalid_forged_token", db_path=self.db_path)
        self.assertEqual(code2, 401)

    def test_08_student_record_isolation_enforcement(self) -> None:
        _, stu_login = authenticate_user(
            "aarav.sharma@student.smartcampus.edu.in",
            "Student@2026",
            requested_role="student",
            db_path=self.db_path,
        )
        student_user = stu_login["user"]

        # Student accessing own record (STU-2026-001) -> Allowed
        allowed_own, err_own = check_permission_for_student_record(
            student_user, "STU-2026-001"
        )
        self.assertTrue(allowed_own)
        self.assertIsNone(err_own)

        # Student accessing another student's record (STU-2026-002) -> Denied (403)
        allowed_other, err_other = check_permission_for_student_record(
            student_user, "STU-2026-002"
        )
        self.assertFalse(allowed_other)
        self.assertIn("only authorized to access academic record 'STU-2026-001'", err_other or "")

        # Faculty and Admin accessing any student record -> Allowed
        _, fac_login = authenticate_user(
            "a.chatterjee@smartcampus.edu.in",
            "Faculty@2026",
            requested_role="faculty",
            db_path=self.db_path,
        )
        allowed_fac, _ = check_permission_for_student_record(
            fac_login["user"], "STU-2026-002"
        )
        self.assertTrue(allowed_fac)

    def test_09_forgot_password_workflow(self) -> None:
        code, res = request_password_reset(
            "aarav.sharma@student.smartcampus.edu.in",
            role="student",
            db_path=self.db_path,
        )
        self.assertEqual(code, 200)
        self.assertEqual(res["status"], "reset_queued")

    def test_10_sqlite_backup_and_idempotent_migration(self) -> None:
        backup_file = create_verified_db_backup(self.db_path)
        self.assertIsNotNone(backup_file)
        self.assertTrue(os.path.exists(backup_file or ""))
        report = init_auth_db(self.db_path)
        self.assertGreaterEqual(report["usersCount"], 13)
        self.assertGreaterEqual(report["studentsCount"], 6)
        self.assertGreaterEqual(report["facultyCount"], 5)

    def test_11_firebase_verified_uid_linking_and_spoof_protection(self) -> None:
        # 1. Existing SQLite student signs in via Firebase Auth for the first time -> auto-links firebase_uid
        code, fb_res = authenticate_verified_firebase_claims(
            verified_uid="fb_uid_aarav_001",
            verified_email="aarav.sharma@student.smartcampus.edu.in",
            email_verified=True,
            requested_role="student",
            db_path=self.db_path,
        )
        self.assertEqual(code, 200)
        self.assertEqual(fb_res["user"]["firebaseUid"], "fb_uid_aarav_001")
        self.assertEqual(fb_res["user"]["linkedStudentId"], "STU-2026-001")

        # 2. Subsequent sign-in resolves directly by verified Firebase UID
        code2, fb_res2 = authenticate_verified_firebase_claims(
            verified_uid="fb_uid_aarav_001",
            verified_email="aarav.sharma@student.smartcampus.edu.in",
            email_verified=True,
            requested_role="student",
            db_path=self.db_path,
        )
        self.assertEqual(code2, 200)
        self.assertEqual(fb_res2["user"]["id"], "USR-STU-001")

        # 3. Different Firebase UID attempting to claim already-linked email -> 403 Forbidden
        code_spoof, spoof_res = authenticate_verified_firebase_claims(
            verified_uid="fb_uid_attacker_999",
            verified_email="aarav.sharma@student.smartcampus.edu.in",
            email_verified=True,
            requested_role="student",
            db_path=self.db_path,
        )
        self.assertEqual(code_spoof, 403)
        self.assertIn("already linked to a different Firebase UID", spoof_res["detail"])

        # 4. Unprovisioned Firebase account -> 403 Forbidden (no self-registration escalation)
        code_unprov, _ = authenticate_verified_firebase_claims(
            verified_uid="fb_uid_stranger_000",
            verified_email="stranger@external.org",
            email_verified=True,
            requested_role="admin",
            db_path=self.db_path,
        )
        self.assertEqual(code_unprov, 403)

    def test_12_dynamic_user_provisioning_student_and_faculty(self) -> None:
        _, admin_login = authenticate_user(
            "dean.academics@smartcampus.edu.in",
            "Admin@2026",
            requested_role="admin",
            db_path=self.db_path,
        )
        admin_actor = admin_login["user"]

        # Provision new Student dynamically
        code_stu, stu_created = provision_user_account(
            actor_user=admin_actor,
            payload={
                "role": "student",
                "name": "Siddharth Nair",
                "email": "siddharth.nair@student.smartcampus.edu.in",
                "initialPassword": "NewStudent@2026",
                "department": "Computer Science & Engineering",
                "linkedStudentId": "STU-2026-057",
                "academicYear": 3,
                "cgpa": 8.4,
                "backlogs": 0,
                "attendance": 89.0,
                "assignedFacultyId": "FAC-101",
            },
            db_path=self.db_path,
        )
        self.assertEqual(code_stu, 201)
        self.assertEqual(stu_created["user"]["linkedStudentId"], "STU-2026-057")
        self.assertEqual(stu_created["studentRecord"]["cgpa"], 8.4)

        # Newly provisioned student can immediately log in
        login_code, login_body = authenticate_user(
            "siddharth.nair@student.smartcampus.edu.in",
            "NewStudent@2026",
            requested_role="student",
            db_path=self.db_path,
        )
        self.assertEqual(login_code, 200)
        self.assertEqual(login_body["user"]["linkedStudentId"], "STU-2026-057")

        # Duplicate email is gracefully rejected with 409 Conflict
        dup_code, dup_body = provision_user_account(
            actor_user=admin_actor,
            payload={
                "role": "student",
                "name": "Duplicate Student",
                "email": "siddharth.nair@student.smartcampus.edu.in",
                "initialPassword": "NewStudent@2026",
                "department": "Computer Science & Engineering",
            },
            db_path=self.db_path,
        )
        self.assertEqual(dup_code, 409)
        self.assertIn("Duplicate email", dup_body["detail"])

        # Provision new Faculty member dynamically
        code_fac, fac_created = provision_user_account(
            actor_user=admin_actor,
            payload={
                "role": "faculty",
                "name": "Dr. Kavita Krishnan",
                "email": "k.krishnan@smartcampus.edu.in",
                "initialPassword": "NewFaculty@2026",
                "department": "Data Science & AI",
                "linkedFacultyId": "FAC-106",
                "designation": "Associate Professor",
                "specialization": "Deep Learning & Computer Vision",
            },
            db_path=self.db_path,
        )
        self.assertEqual(code_fac, 201)
        self.assertEqual(fac_created["user"]["linkedFacultyId"], "FAC-106")

        # Non-admin cannot provision users (403 Forbidden)
        forbid_code, _ = provision_user_account(
            actor_user=login_body["user"],
            payload={
                "role": "admin",
                "name": "Unauthorized Escalation",
                "email": "hacker@smartcampus.edu.in",
                "initialPassword": "Password123",
            },
            db_path=self.db_path,
        )
        self.assertEqual(forbid_code, 403)

    def test_13_update_user_and_account_deactivation_revokes_sessions(self) -> None:
        _, admin_login = authenticate_user(
            "dean.academics@smartcampus.edu.in",
            "Admin@2026",
            requested_role="admin",
            db_path=self.db_path,
        )
        admin_actor = admin_login["user"]

        # Student logs in and gets active token
        _, stu_login = authenticate_user(
            "rohan.kulkarni@student.smartcampus.edu.in",
            "Student@2026",
            requested_role="student",
            db_path=self.db_path,
        )
        stu_token = stu_login["accessToken"]

        # Admin updates student's profile & academic CGPA
        upd_code, upd_body = update_user_account(
            actor_user=admin_actor,
            target_user_id="USR-STU-002",
            payload={"name": "Rohan S. Kulkarni", "cgpa": 6.8, "backlogs": 1},
            db_path=self.db_path,
        )
        self.assertEqual(upd_code, 200)
        self.assertEqual(upd_body["user"]["name"], "Rohan S. Kulkarni")

        # Admin deactivates USR-STU-002 -> active session is immediately revoked
        deact_code, deact_body = set_user_active_status(
            actor_user=admin_actor,
            target_user_id="USR-STU-002",
            is_active=False,
            db_path=self.db_path,
        )
        self.assertEqual(deact_code, 200)
        self.assertFalse(deact_body["user"]["isActive"])

        # Existing token now fails verification
        me_code, _ = verify_session_token(stu_token, db_path=self.db_path)
        self.assertIn(me_code, (401, 403))

        # Deactivated user cannot log in (403 Forbidden)
        blocked_code, blocked_res = authenticate_user(
            "rohan.kulkarni@student.smartcampus.edu.in",
            "Student@2026",
            requested_role="student",
            db_path=self.db_path,
        )
        self.assertEqual(blocked_code, 403)
        self.assertIn("Account deactivated", blocked_res["detail"])

        # Admin reactivates USR-STU-002 -> login succeeds again
        react_code, _ = set_user_active_status(
            actor_user=admin_actor,
            target_user_id="USR-STU-002",
            is_active=True,
            db_path=self.db_path,
        )
        self.assertEqual(react_code, 200)
        relogin_code, _ = authenticate_user(
            "rohan.kulkarni@student.smartcampus.edu.in",
            "Student@2026",
            requested_role="student",
            db_path=self.db_path,
        )
        self.assertEqual(relogin_code, 200)

        # Admin cannot deactivate their own active account
        self_deact_code, _ = set_user_active_status(
            actor_user=admin_actor,
            target_user_id=admin_actor["id"],
            is_active=False,
            db_path=self.db_path,
        )
        self.assertEqual(self_deact_code, 400)


if __name__ == "__main__":
    unittest.main()
