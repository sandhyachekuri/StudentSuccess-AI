"""
StudentSuccess AI — Safe SQLite Backup & Schema Migration Script.
Run with:
    python3 -m backend.migrate_sqlite
"""

import json
from .auth_db import create_verified_db_backup, init_auth_db


def run_migration() -> None:
    backup_path = create_verified_db_backup()
    migration_report = init_auth_db()
    if backup_path and not migration_report.get("backupPath"):
        migration_report["backupPath"] = backup_path
    print(json.dumps(migration_report, indent=2))


if __name__ == "__main__":
    run_migration()
