"""
Resume upload, text extraction, and personalized question generation.

POST /api/resume/analyze
  Accepts a PDF resume, extracts text with pdfplumber, sends to Groq to
  produce structured info + personalized questions. Returns everything
  the frontend needs to display a preview and then create a session.
"""

import logging
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.models.user import User
from app.services.groq_client import GroqGenerationError
from app.services.resume_parser import ResumeParseError, extract_text_from_pdf
from app.services.resume_questions import analyze_resume

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/resume", tags=["resume"])

MAX_PDF_BYTES = 5 * 1024 * 1024  # 5 MB


class ProjectInfo(BaseModel):
    name: str
    description: str


class ExperienceInfo(BaseModel):
    role: str
    company: str
    duration: str


class EducationInfo(BaseModel):
    degree: str
    institution: str


class ExtractedInfoResponse(BaseModel):
    name: str
    skills: list[str]
    technologies: list[str]
    projects: list[dict]
    experience: list[dict]
    education: list[dict]
    summary: str


class ResumeAnalysisResponse(BaseModel):
    resume_text: str
    extracted_info: ExtractedInfoResponse
    questions: list[str]


@router.post("/analyze", response_model=ResumeAnalysisResponse)
async def analyze_resume_endpoint(
    file: UploadFile = File(..., description="Resume PDF (max 5 MB)"),
    role: str = Query(default="Software Developer", max_length=100),
    question_count: int = Query(default=7, ge=3, le=10),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a resume PDF → extract text → generate personalized questions.

    The returned `resume_text` and `questions` should be passed to
    POST /api/sessions/ to create a resume-based interview session.
    """
    # Validate content type (browsers may send octet-stream for PDFs)
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only PDF files are accepted.",
        )

    pdf_bytes = await file.read()

    if len(pdf_bytes) > MAX_PDF_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Resume must be under 5 MB.",
        )

    # Step 1: Extract text from PDF
    try:
        resume_text = extract_text_from_pdf(pdf_bytes)
    except ResumeParseError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    # Step 2: LLM analysis + question generation
    try:
        result = await analyze_resume(
            resume_text=resume_text,
            role=role,
            question_count=question_count,
        )
    except (GroqGenerationError, ValueError) as exc:
        logger.error("Resume analysis failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not analyze resume: {exc}",
        )

    return ResumeAnalysisResponse(
        resume_text=resume_text,
        extracted_info=ExtractedInfoResponse(
            name=result.extracted_info.name,
            skills=result.extracted_info.skills,
            technologies=result.extracted_info.technologies,
            projects=result.extracted_info.projects,
            experience=result.extracted_info.experience,
            education=result.extracted_info.education,
            summary=result.extracted_info.summary,
        ),
        questions=result.questions,
    )