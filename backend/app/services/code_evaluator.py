"""
LLM-based code quality evaluation.
"""

import json
import logging
from dataclasses import dataclass, field

from app.services.groq_client import generate_chat_completion

logger = logging.getLogger(__name__)


@dataclass
class CodeEvaluationResult:
    code_quality_score: float
    overall_score: float
    time_complexity: str
    space_complexity: str
    feedback: str
    strengths: list[str] = field(default_factory=list)
    weaknesses: list[str] = field(default_factory=list)
    optimizations: list[str] = field(default_factory=list)
    readability: str = ""


def _build_eval_prompt(
    problem_title: str, problem_description: str, code: str,
    language: str, passed: int, total: int, role: str,
) -> str:
    pass_pct = round((passed / max(total, 1)) * 100)
    return (
        f"You are an expert {role} interviewer evaluating a coding solution.\n\n"
        f"Problem: {problem_title}\n"
        f"{problem_description[:600]}\n\n"
        f"Candidate's {language} solution:\n```{language}\n{code[:2000]}\n```\n\n"
        f"Test results: {passed}/{total} test cases passed ({pass_pct}%)\n\n"
        f"Evaluate the solution on: correctness, code quality, complexity, readability, best practices.\n\n"
        f"Respond with ONLY valid JSON (no markdown, no extra text):\n"
        f"{{\n"
        f'  "code_quality_score": <float 0-10, 1 decimal>,\n'
        f'  "time_complexity": "O(...)",\n'
        f'  "space_complexity": "O(...)",\n'
        f'  "feedback": "2-3 sentence overall assessment",\n'
        f'  "strengths": ["specific strength 1", "specific strength 2"],\n'
        f'  "weaknesses": ["specific weakness 1"],\n'
        f'  "optimizations": ["concrete optimization suggestion 1"],\n'
        f'  "readability": "one sentence on code clarity and style"\n'
        f"}}"
    )


def _parse_eval_json(raw: str) -> dict:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").removeprefix("json").strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON object in evaluation response: {raw[:200]!r}")
    parsed = json.loads(cleaned[start:end + 1])
    required = {"code_quality_score", "time_complexity", "space_complexity", "feedback"}
    missing = required - parsed.keys()
    if missing:
        raise ValueError(f"Evaluation JSON missing: {missing}")
    score = float(parsed["code_quality_score"])
    if not (0.0 <= score <= 10.0):
        raise ValueError(f"code_quality_score out of range: {score}")
    return parsed


def _compute_overall(code_quality: float, passed: int, total: int) -> float:
    pass_score = (passed / max(total, 1)) * 10
    return round(0.4 * code_quality + 0.6 * pass_score, 1)


async def evaluate_code(
    problem_title: str, problem_description: str, code: str,
    language: str, passed: int, total: int, role: str,
) -> CodeEvaluationResult:
    prompt = _build_eval_prompt(
        problem_title, problem_description, code, language, passed, total, role
    )
    raw = await generate_chat_completion(prompt)
    parsed = _parse_eval_json(raw)
    code_quality = round(float(parsed["code_quality_score"]), 1)
    return CodeEvaluationResult(
        code_quality_score=code_quality,
        overall_score=_compute_overall(code_quality, passed, total),
        time_complexity=str(parsed.get("time_complexity", "O(?)")),
        space_complexity=str(parsed.get("space_complexity", "O(?)")),
        feedback=str(parsed.get("feedback", "")),
        strengths=[str(s) for s in parsed.get("strengths", [])],
        weaknesses=[str(w) for w in parsed.get("weaknesses", [])],
        optimizations=[str(o) for o in parsed.get("optimizations", [])],
        readability=str(parsed.get("readability", "")),
    )