"""
Resume analysis and personalized question generation.

Two things happen in one LLM call:
1. Extract structured info from the resume (skills, projects, experience)
2. Generate personalized questions that reference actual resume content

Follow-up question generation is a separate function used during the
practice session when the user asks Aira to dig deeper on their answer.
"""

import json
import logging
from dataclasses import dataclass, field

from app.services.groq_client import generate_chat_completion

logger = logging.getLogger(__name__)


@dataclass
class ExtractedResumeInfo:
    name: str = ""
    skills: list[str] = field(default_factory=list)
    technologies: list[str] = field(default_factory=list)
    projects: list[dict] = field(default_factory=list)
    experience: list[dict] = field(default_factory=list)
    education: list[dict] = field(default_factory=list)
    summary: str = ""


@dataclass
class ResumeAnalysisResult:
    extracted_info: ExtractedResumeInfo
    questions: list[str]


def _build_analysis_prompt(resume_text: str, role: str, count: int) -> str:
    # Trim resume to avoid hitting token limits — first 3000 chars covers
    # all relevant content for most resumes
    trimmed = resume_text[:3000]
    return (
        f"You are an expert technical interviewer preparing for a '{role}' interview.\n\n"
        f"Here is the candidate's resume:\n\n{trimmed}\n\n"
        f"Do two things:\n"
        f"1. Extract key information from the resume.\n"
        f"2. Generate exactly {count} highly personalized interview questions based SPECIFICALLY "
        f"on this resume. Reference actual project names, technologies, and experiences. "
        f"Do NOT ask generic questions — every question must reference something specific "
        f"from the resume.\n\n"
        f"Good question examples (personalized):\n"
        f"- 'You listed YOLOv5 for helmet detection — what was the biggest challenge in "
        f"achieving real-time inference speed?'\n"
        f"- 'Your FastAPI project uses JWT auth — how did you handle token refresh and "
        f"rotation in production?'\n"
        f"- 'Walk me through the architecture of your SmartArch platform.'\n\n"
        f"Mix behavioral and technical questions. Probe depth of understanding.\n\n"
        f"Respond ONLY with this JSON object, no markdown, no preamble:\n"
        f"{{\n"
        f'  "name": "<candidate full name or empty string>",\n'
        f'  "skills": ["skill1", "skill2"],\n'
        f'  "technologies": ["tech1", "tech2"],\n'
        f'  "projects": [{{"name": "...", "description": "one line"}}],\n'
        f'  "experience": [{{"role": "...", "company": "...", "duration": "..."}}],\n'
        f'  "education": [{{"degree": "...", "institution": "..."}}],\n'
        f'  "summary": "<2 sentence professional summary of the candidate>",\n'
        f'  "questions": ["question 1", "question 2", ...]\n'
        f"}}"
    )


def _parse_json(raw: str) -> dict:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").removeprefix("json").strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON object in response: {raw[:200]!r}")
    return json.loads(cleaned[start:end + 1])


async def analyze_resume(
    resume_text: str,
    role: str,
    question_count: int = 7,
) -> ResumeAnalysisResult:
    """
    Analyze resume and generate personalized questions in one LLM call.
    Raises GroqGenerationError or ValueError on failure.
    """
    prompt = _build_analysis_prompt(resume_text, role, question_count)
    raw = await generate_chat_completion(prompt)
    parsed = _parse_json(raw)

    questions = parsed.get("questions", [])
    if not questions:
        raise ValueError("LLM returned no questions from resume analysis")

    info = ExtractedResumeInfo(
        name=str(parsed.get("name", "")),
        skills=[str(s) for s in parsed.get("skills", [])],
        technologies=[str(t) for t in parsed.get("technologies", [])],
        projects=parsed.get("projects", []),
        experience=parsed.get("experience", []),
        education=parsed.get("education", []),
        summary=str(parsed.get("summary", "")),
    )

    return ResumeAnalysisResult(
        extracted_info=info,
        questions=questions[:question_count],
    )


async def generate_followup_question(
    original_question: str,
    transcript: str,
    role: str,
    resume_text: str | None = None,
) -> str:
    """
    Generate one follow-up question based on the candidate's actual answer.
    Simulates a real interviewer digging deeper on what was just said.
    """
    resume_ctx = ""
    if resume_text:
        resume_ctx = f"\nCandidate's resume (excerpt):\n{resume_text[:800]}\n"

    prompt = (
        f"You are conducting a '{role}' interview.{resume_ctx}\n"
        f"You asked: \"{original_question}\"\n\n"
        f"The candidate answered: \"{transcript or '[no clear answer given]'}\"\n\n"
        f"Generate exactly ONE natural follow-up question that:\n"
        f"- Probes deeper into something specific they just mentioned\n"
        f"- Asks for a concrete example if they were vague\n"
        f"- Challenges an assumption if appropriate for the role\n"
        f"- Sounds like a real interviewer following up naturally\n"
        f"- Does NOT introduce a completely new topic\n\n"
        f"Respond with ONLY the follow-up question, no preamble, no quotes around it."
    )

    raw = await generate_chat_completion(prompt)
    followup = raw.strip().strip('"').strip()
    if not followup:
        raise ValueError("Empty follow-up question returned")
    return followup