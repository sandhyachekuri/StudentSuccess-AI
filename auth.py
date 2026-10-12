"""
StudentSuccess AI — FastAPI Authentication Router & RBAC Dependencies.
Implements:
- POST /auth/login
- POST /auth/logout
- GET /auth/me
- POST /auth/forgot-password
And provides `get_current_user` and `require_roles` dependencies for protecting backend APIs.
"""

from typing import Callable, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .auth_db import (
    authenticate_user,
    authenticate_with_firebase_id_token,
    request_password_reset,
    revoke_session_token,
    verify_session_token,
)
from .models import (
    AuthenticatedUserModel,
    AuthMeResponse,
    FirebaseLoginRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    UserRoleLiteral,
)

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
security_scheme = HTTPBearer(auto_error=False)


def _extract_raw_token(
    credentials: Optional[HTTPAuthorizationCredentials],
    authorization_header: Optional[str],
) -> Optional[str]:
    if credentials and credentials.credentials:
        return credentials.credentials
    if authorization_header:
        return authorization_header
    return None


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    authorization: Optional[str] = Header(default=None),
) -> AuthenticatedUserModel:
    """
    FastAPI dependency that validates the Bearer session token against SQLite
    and returns the authenticated user profile (or raises HTTP 401/403).
    """
    raw_token = _extract_raw_token(credentials, authorization)
    status_code, body = verify_session_token(raw_token)
    if status_code != 200:
        raise HTTPException(
            status_code=status_code,
            detail=body.get("detail", "Authentication failed."),
        )
    return AuthenticatedUserModel(**body["user"])


def require_roles(*allowed_roles: UserRoleLiteral) -> Callable:
    """
    FastAPI dependency factory that enforces role-based access control (RBAC)
    on protected routes.
    """
    def _role_checker(
        current_user: AuthenticatedUserModel = Depends(get_current_user),
    ) -> AuthenticatedUserModel:
        if current_user.role not in allowed_roles:
            allowed_str = ", ".join(r.upper() for r in allowed_roles)
            raise HTTPException(
                status_code=403,
                detail=(
                    f"Access denied: Role '{current_user.role.upper()}' is not authorized "
                    f"for this endpoint. Required role(s): {allowed_str}."
                ),
            )
        return current_user

    return _role_checker


@auth_router.post("/login", response_model=LoginResponse)
def login_endpoint(payload: LoginRequest) -> LoginResponse:
    """
    Authenticates an Admin, Faculty, or Student user against SQLite `users` using
    PBKDF2-HMAC-SHA256 password verification, enforces role tab matching, and issues
    an expiring session token.
    """
    status_code, body = authenticate_user(
        email=payload.email,
        password=payload.password,
        requested_role=payload.role,
        remember_me=payload.rememberMe,
    )
    if status_code != 200:
        raise HTTPException(
            status_code=status_code,
            detail=body.get("detail", "Invalid login credentials."),
        )
    return LoginResponse(**body)


@auth_router.post("/firebase-login", response_model=LoginResponse)
def firebase_login_endpoint(
    payload: FirebaseLoginRequest,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    authorization: Optional[str] = Header(default=None),
) -> LoginResponse:
    """
    Verifies a Firebase Authentication ID token on the backend using the Firebase Admin SDK,
    maps the verified Firebase UID to the SQLite `users` record, enforces `is_active == 1`,
    and issues an authorized session response.
    """
    header_token = _extract_raw_token(credentials, authorization)
    effective_token = header_token or payload.idToken
    status_code, body = authenticate_with_firebase_id_token(
        raw_id_token=effective_token,
        requested_role=payload.role,
        remember_me=payload.rememberMe,
    )
    if status_code != 200:
        raise HTTPException(
            status_code=status_code,
            detail=body.get("detail", "Firebase authentication failed."),
        )
    return LoginResponse(**body)


@auth_router.post("/logout", response_model=LogoutResponse)
def logout_endpoint(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    authorization: Optional[str] = Header(default=None),
) -> LogoutResponse:
    """
    Revokes the caller's active Bearer session token in SQLite `auth_sessions`.
    """
    raw_token = _extract_raw_token(credentials, authorization)
    status_code, body = revoke_session_token(raw_token)
    if status_code != 200:
        raise HTTPException(
            status_code=status_code,
            detail=body.get("detail", "Logout failed."),
        )
    return LogoutResponse(**body)


@auth_router.get("/me", response_model=AuthMeResponse)
def auth_me_endpoint(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    authorization: Optional[str] = Header(default=None),
) -> AuthMeResponse:
    """
    Verifies the active Bearer token and returns the current user's profile, role,
    linked Student/Faculty ID, and session expiration timestamp.
    """
    raw_token = _extract_raw_token(credentials, authorization)
    status_code, body = verify_session_token(raw_token)
    if status_code != 200:
        raise HTTPException(
            status_code=status_code,
            detail=body.get("detail", "Unauthorized session."),
        )
    return AuthMeResponse(**body)


@auth_router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password_endpoint(
    payload: ForgotPasswordRequest,
) -> ForgotPasswordResponse:
    """
    Records a password reset request in SQLite and returns an institutional
    confirmation message.
    """
    status_code, body = request_password_reset(
        email=payload.email,
        role=payload.role,
    )
    if status_code != 200:
        raise HTTPException(
            status_code=status_code,
            detail=body.get("detail", "Invalid email address."),
        )
    return ForgotPasswordResponse(**body)
