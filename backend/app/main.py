from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    auth_router, sessions_router, answers_router,
    report_router, resume_router, coding_router,
)
from app.core.config import settings

app = FastAPI(
    title="InterviewAce API",
    description="AI mock interview coach with coding interview mode.",
    version="0.7.0",
)

# Comma-separated FRONTEND_ORIGIN supports multiple Vercel preview URLs
origins = [o.strip() for o in settings.FRONTEND_ORIGIN.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(sessions_router)
app.include_router(answers_router)
app.include_router(report_router)
app.include_router(resume_router)
app.include_router(coding_router)


@app.get("/api/health", tags=["health"])
async def health_check():
    return {"status": "ok"}