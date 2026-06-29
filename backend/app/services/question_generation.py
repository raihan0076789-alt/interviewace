import json
import logging

from app.core.config import settings
from app.services.fallback_questions import get_fallback_questions
from app.services.groq_client import GroqGenerationError, generate_chat_completion
from app.services.question_cache import TTLCache

logger = logging.getLogger(__name__)

_cache = TTLCache(ttl_seconds=settings.QUESTION_CACHE_TTL_SECONDS)


def _build_prompt(role: str, difficulty: str, count: int) -> str:
    return (
        f"You are an experienced technical interviewer. Generate exactly {count} "
        f"interview questions for a candidate applying to a '{role}' role at "
        f"'{difficulty}' difficulty.\n\n"
        "Rules:\n"
        "- Mix behavioral and technical questions appropriate to the role.\n"
        "- Each question should be answerable out loud in 1-3 minutes.\n"
        "- Do not number the questions or add any commentary.\n"
        "- Respond with ONLY a JSON array of strings, nothing else. "
        'Example: ["question one", "question two"]'
    )


def _parse_questions_response(raw_text: str, expected_count: int) -> list[str]:
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.removeprefix("json").strip()

    start, end = cleaned.find("["), cleaned.rfind("]")
    if start == -1 or end == -1 or end < start:
        raise ValueError(f"No JSON array found in LLM response: {raw_text!r}")

    parsed = json.loads(cleaned[start : end + 1])

    if not isinstance(parsed, list) or not all(isinstance(q, str) and q.strip() for q in parsed):
        raise ValueError(f"Parsed JSON was not a list of non-empty strings: {parsed!r}")

    return parsed[:expected_count] if len(parsed) > expected_count else parsed


async def generate_questions(role: str, difficulty: str, count: int = 5) -> list[str]:
    cached = _cache.get(role, difficulty, count)
    if cached is not None:
        logger.info("Question cache hit for role=%r difficulty=%r", role, difficulty)
        return cached

    try:
        prompt = _build_prompt(role, difficulty, count)
        raw_response = await generate_chat_completion(prompt)
        questions = _parse_questions_response(raw_response, expected_count=count)

        if len(questions) < count:
            questions += get_fallback_questions(role, count - len(questions))

        _cache.set(role, difficulty, count, questions)
        return questions

    except GroqGenerationError as exc:
        logger.warning("Groq generation failed, using fallback bank: %s", exc)
    except (ValueError, json.JSONDecodeError) as exc:
        logger.warning("Could not parse Groq response, using fallback bank: %s", exc)

    return get_fallback_questions(role, count)