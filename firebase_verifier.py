"""
StudentSuccess AI — Server-Side Firebase Admin ID Token Verifier.
Verifies Firebase Authentication ID tokens on the FastAPI backend using `firebase-admin`
(with automatic fallback to Google Identity Toolkit `accounts:lookup` verification in
lightweight container environments where `firebase-admin` is not installed).
Never trusts client-supplied UIDs, emails, or roles from request bodies.
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
import urllib.error
import urllib.request

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    env_file = Path(__file__).resolve().parent.parent / ".env"
    if env_file.is_file():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if stripped and not stripped.startswith("#") and "=" in stripped:
                k, v = stripped.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

_FIREBASE_APP_INITIALIZED = False
_APPLET_CONFIG_PATH = Path(__file__).resolve().parent.parent / "firebase-applet-config.json"


def _load_applet_firebase_config() -> Dict[str, str]:
    if _APPLET_CONFIG_PATH.is_file():
        try:
            data = json.loads(_APPLET_CONFIG_PATH.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return {str(k): str(v) for k, v in data.items() if v is not None}
        except Exception:
            pass
    return {}


def is_firebase_admin_configured() -> Tuple[bool, str]:
    """
    Checks whether Firebase Admin SDK credentials or provisioned Firebase project config
    are present on the backend without exposing any private key values.
    """
    sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "").strip()
    sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    applet_cfg = _load_applet_firebase_config()
    project_id = (
        os.getenv("FIREBASE_PROJECT_ID", "").strip()
        or os.getenv("VITE_FIREBASE_PROJECT_ID", "").strip()
        or applet_cfg.get("projectId", "").strip()
    )

    placeholders = {
        "",
        "MY_FIREBASE_PROJECT_ID",
        "YOUR_FIREBASE_PROJECT_ID",
        "PATH_TO_SERVICE_ACCOUNT_JSON",
        "NONE",
        "NULL",
    }

    if sa_path and sa_path.upper() not in placeholders and os.path.isfile(sa_path):
        return True, f"Configured via service account file ({os.path.basename(sa_path)})"
    if sa_json and sa_json.startswith("{"):
        return True, "Configured via FIREBASE_SERVICE_ACCOUNT_JSON environment secret"
    if project_id and project_id.upper() not in placeholders:
        return True, f"Configured for Firebase Project '{project_id}'"

    return (
        False,
        "Firebase Admin credentials are not configured in .env (set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_PROJECT_ID).",
    )


def _ensure_firebase_admin_app() -> Tuple[bool, str]:
    global _FIREBASE_APP_INITIALIZED
    configured, status_msg = is_firebase_admin_configured()
    if not configured:
        return False, status_msg

    try:
        import firebase_admin
        from firebase_admin import credentials
    except ImportError:
        return (
            False,
            "Python package 'firebase-admin' is not installed in this environment.",
        )

    if _FIREBASE_APP_INITIALIZED or firebase_admin._apps:
        _FIREBASE_APP_INITIALIZED = True
        return True, status_msg

    sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "").strip()
    sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    applet_cfg = _load_applet_firebase_config()
    project_id = (
        os.getenv("FIREBASE_PROJECT_ID", "").strip()
        or os.getenv("VITE_FIREBASE_PROJECT_ID", "").strip()
        or applet_cfg.get("projectId", "").strip()
    )

    try:
        if sa_path and os.path.isfile(sa_path):
            cred = credentials.Certificate(sa_path)
            firebase_admin.initialize_app(cred)
        elif sa_json and sa_json.startswith("{"):
            cred_dict = json.loads(sa_json)
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app(options={"projectId": project_id})
        _FIREBASE_APP_INITIALIZED = True
        return True, status_msg
    except Exception as exc:
        return False, f"Failed to initialize Firebase Admin SDK: {exc}"


def _verify_via_google_identity_toolkit(raw_id_token: str) -> Optional[Tuple[int, Dict[str, Any]]]:
    """
    Verifies a Firebase ID token directly with Google Identity Toolkit's `accounts:lookup`
    endpoint when running in a container without `firebase-admin` or GCP service account keys.
    """
    applet_cfg = _load_applet_firebase_config()
    api_key = (
        os.getenv("FIREBASE_WEB_API_KEY", "").strip()
        or applet_cfg.get("apiKey", "").strip()
    )
    if not api_key:
        return None

    url = f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={api_key}"
    payload = json.dumps({"idToken": raw_id_token}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            users = body.get("users") or []
            if not users:
                return 401, {"detail": "Firebase ID token did not match any active Firebase user."}
            user_info = users[0]
            uid = str(user_info.get("localId") or "").strip()
            email = str(user_info.get("email") or "").strip().lower()
            email_verified = bool(user_info.get("emailVerified", False))
            if not uid:
                return 401, {"detail": "Verified Firebase token missing localId (uid)."}
            if bool(user_info.get("disabled", False)):
                return 403, {"detail": "Firebase user account is disabled."}
            return 200, {
                "uid": uid,
                "email": email,
                "emailVerified": email_verified,
                "claims": user_info,
            }
    except urllib.error.HTTPError as http_err:
        try:
            err_body = json.loads(http_err.read().decode("utf-8"))
            err_msg = err_body.get("error", {}).get("message", "INVALID_ID_TOKEN")
        except Exception:
            err_msg = f"HTTP {http_err.code}"
        return 401, {
            "detail": f"Invalid, expired, or revoked Firebase ID token ({err_msg})."
        }
    except Exception:
        return None


def verify_firebase_token_on_server(raw_id_token: str) -> Tuple[int, Dict[str, Any]]:
    """
    Verifies a Firebase ID token using `firebase_admin.auth.verify_id_token`
    (or Google Identity Toolkit `accounts:lookup` if `firebase-admin` is unavailable).
    Returns (http_status, decoded_claims_or_error).
    - 200: Validated token with `uid`, `email`, `email_verified`
    - 401: Invalid, expired, or revoked Firebase ID token
    - 503: Firebase Admin SDK not configured on server
    """
    if not raw_id_token or not raw_id_token.strip():
        return 401, {"detail": "Missing Firebase ID token in Authorization header."}

    cleaned = raw_id_token.strip()
    if cleaned.lower().startswith("bearer "):
        cleaned = cleaned[7:].strip()

    ready, msg = _ensure_firebase_admin_app()
    if ready:
        try:
            from firebase_admin import auth as fb_auth

            decoded = fb_auth.verify_id_token(cleaned, check_revoked=True)
            uid = str(decoded.get("uid") or decoded.get("sub") or "").strip()
            email = str(decoded.get("email") or "").strip().lower()
            email_verified = bool(decoded.get("email_verified", False))

            if not uid:
                return 401, {
                    "detail": "Verified Firebase token did not contain a valid 'uid' claim."
                }

            return 200, {
                "uid": uid,
                "email": email,
                "emailVerified": email_verified,
                "claims": decoded,
            }
        except Exception as exc:
            # If Application Default Credentials are not available in local/preview container,
            # attempt Google Identity Toolkit verification before returning 401.
            fallback_res = _verify_via_google_identity_toolkit(cleaned)
            if fallback_res is not None:
                return fallback_res
            return 401, {
                "detail": f"Invalid, expired, or revoked Firebase ID token: {exc}"
            }

    fallback_res = _verify_via_google_identity_toolkit(cleaned)
    if fallback_res is not None:
        return fallback_res

    return 503, {"detail": msg}
