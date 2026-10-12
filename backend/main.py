"""
StudentSuccess AI — FastAPI Application Entry Point.
Configures environment-aware CORS origins (never unrestricted '*' in production)
and mounts all analytical and student API routes.

Run locally with:
    uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
"""

import os
from typing import List
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import auth_router
from .auth_db import init_auth_db
from .routes import router

load_dotenv()
init_auth_db()


def get_allowed_origins() -> List[str]:
    """
    Parses ALLOWED_ORIGINS from environment variables.
    Enforces strict explicit origins and rejects wildcard '*' in production.
    """
    app_env = os.getenv("APP_ENV", "development").strip().lower()
    raw_origins = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173",
    )
    origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

    if app_env == "production":
        # Never allow unrestricted '*' origins in production
        origins = [o for o in origins if o != "*"]
        if not origins:
            app_url = os.getenv("APP_URL", "").strip()
            if app_url and app_url != "MY_APP_URL":
                origins = [app_url]

    return origins


def create_app() -> FastAPI:
    app = FastAPI(
        title="StudentSuccess AI — Smart Campus Analytics API",
        description=(
            "Modular Python FastAPI + Pandas + NumPy backend for calculating Student Success Scores, "
            "independent Academic and Placement risk assessments, cohort segmentation, and CSV validation."
        ),
        version="1.0.0",
    )

    allowed_origins = get_allowed_origins()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "Accept"],
    )

    app.include_router(auth_router)
    app.include_router(router)
    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn

    host = os.getenv("FASTAPI_HOST", "0.0.0.0")
    port = int(os.getenv("FASTAPI_PORT", "8000"))
    uvicorn.run("backend.main:app", host=host, port=port, reload=True)
