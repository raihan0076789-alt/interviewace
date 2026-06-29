"""
Evaluation engine — Phase 5.

Given a question, the candidate's transcript, their role, and optional
CV-derived delivery scores, this service calls Groq to produce:
  - content_score  (0–10): how good the answer was, assessed by LLM
  - feedback       (str):  specific, actionable written feedback
  - strengths      (list): 2–3 things the candidate did well
  - improvements   (list): 2–3 concrete things to do differently

An overall_score per question is then derived by combining content_score
with a delivery_score derived from the CV signals:

    delivery_score = average(eye_contact, posture) * 10   (if both present)
    overall_score  = 0.6 * content_score + 0.4 * delivery_score
                   = content_score                         (if no CV data)

The session overall_score is the mean of all per-question overall scores.
"""

import json
import logging
from dataclasses import dataclass

from app.services.groq_client import GroqGenerationError, generate_chat_completion

logger = logging.getLogger(__name__)


@dataclass
class EvaluationResult:
    content_score: float          # 0–10, from LLM
    overall_score: float          # 0–10, blended with delivery
    feedback: str                 # paragraph of written feedback
    strengths: list[str]          # 2–3 bullet points
    improvements: list[str]       # 2–3 bullet points


def _build_evaluation_prompt(
    question: str,
    transcript: str,
    role: str,
    eye_contact_score: float | None,
    posture_score: float | None,
) -> str:
    delivery_section = ""
    if eye_contact_score is not None or posture_score is not None:
        ec = f"{eye_contact_score:.0%}" if eye_contact_score is not None else "not measured"
        ps = f"{posture_score:.0%}" if posture_score is not None else "not measured"
        delivery_section = (
            f"\nDelivery signals (from video analysis):\n"
            f"- Eye contact maintained: {ec}\n"
            f"- Posture stability: {ps}\n"
        )

    if not transcript or not transcript.strip():
        transcript_section = "[No transcript available — the audio could not be transcribed]"
    else:
        transcript_section = transcript.strip()

    return (
        f"You are an expert interview coach evaluating a candidate for a '{role}' role.\n\n"
        f"Interview question:\n{question}\n\n"
        f"Candidate's answer (transcribed from audio):\n{transcript_section}\n"
        f"{delivery_section}\n"
        "Evaluate the answer on these criteria:\n"
        "- Clarity and structure (did they communicate clearly?)\n"
        "- Specificity (did they use concrete examples?)\n"
        "- Technical/role accuracy (was the content correct for the role?)\n"
        "- Completeness (did they actually answer the question?)\n\n"
        "Respond with ONLY a JSON object, no preamble, no markdown fences:\n"
        "{\n"
        '  "content_score": <number 0-10, one decimal place>,\n'
        '  "feedback": "<2-3 sentence paragraph of specific, actionable feedback>",\n'
        '  "strengths": ["<strength 1>", "<strength 2>"],\n'
        '  "improvements": ["<improvement 1>", "<improvement 2>"]\n'
        "}"
    )


def _parse_evaluation_response(raw_text: str) -> dict:
    """
    Same defensive parsing as question_generation — strip code fences,
    find the JSON object, parse and validate the required fields.
    """
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").removeprefix("json").strip()

    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON object found in evaluation response: {raw_text!r}")

    parsed = json.loads(cleaned[start : end + 1])

    required = {"content_score", "feedback", "strengths", "improvements"}
    missing = required - parsed.keys()
    if missing:
        raise ValueError(f"Evaluation JSON missing fields: {missing}")

    score = float(parsed["content_score"])
    if not (0.0 <= score <= 10.0):
        raise ValueError(f"content_score out of range: {score}")

    return {
        "content_score": round(score, 1),
        "feedback": str(parsed["feedback"]).strip(),
        "strengths": [str(s) for s in parsed.get("strengths", [])],
        "improvements": [str(i) for i in parsed.get("improvements", [])],
    }


def _compute_overall_score(
    content_score: float,
    eye_contact_score: float | None,
    posture_score: float | None,
) -> float:
    """
    Blend content score (from LLM) with delivery score (from CV signals).
    If CV data is absent, overall equals content score alone.
    """
    cv_scores = [s for s in [eye_contact_score, posture_score] if s is not None]
    if not cv_scores:
        return round(content_score, 1)

    delivery_score = (sum(cv_scores) / len(cv_scores)) * 10  # 0–1 → 0–10
    blended = 0.6 * content_score + 0.4 * delivery_score
    return round(blended, 1)


async def evaluate_answer(
    question: str,
    transcript: str | None,
    role: str,
    eye_contact_score: float | None = None,
    posture_score: float | None = None,
) -> EvaluationResult:
    """
    Public entry point used by the /evaluate route.

    Raises GroqGenerationError or ValueError on failure — unlike
    question_generation, evaluation failures ARE surfaced to the caller
    (as a 502) because there's no sensible static fallback for scoring.
    The frontend should handle this with a "try again" button.
    """
    prompt = _build_evaluation_prompt(
        question=question,
        transcript=transcript or "",
        role=role,
        eye_contact_score=eye_contact_score,
        posture_score=posture_score,
    )

    raw_response = await generate_chat_completion(prompt)
    parsed = _parse_evaluation_response(raw_response)

    content_score = parsed["content_score"]
    overall_score = _compute_overall_score(content_score, eye_contact_score, posture_score)

    return EvaluationResult(
        content_score=content_score,
        overall_score=overall_score,
        feedback=parsed["feedback"],
        strengths=parsed["strengths"],
        improvements=parsed["improvements"],
    )


def compute_session_overall_score(overall_scores: list[float]) -> float | None:
    """Average of all per-question overall scores. Returns None if list is empty."""
    if not overall_scores:
        return None
    return round(sum(overall_scores) / len(overall_scores), 1)