from groq import AsyncGroq
from groq import APIError, APIConnectionError, APIStatusError, RateLimitError

from app.core.config import settings


class GroqGenerationError(Exception):
    pass


async def generate_chat_completion(prompt: str) -> str:
    if not settings.GROQ_API_KEY:
        raise GroqGenerationError("GROQ_API_KEY is not set")

    client = AsyncGroq(api_key=settings.GROQ_API_KEY)

    try:
        response = await client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=1024,
        )
    except RateLimitError as exc:
        raise GroqGenerationError(f"Groq rate limit hit: {exc}") from exc
    except APIConnectionError as exc:
        raise GroqGenerationError(f"Could not reach Groq: {exc}") from exc
    except (APIStatusError, APIError) as exc:
        raise GroqGenerationError(f"Groq API error: {exc}") from exc

    content = response.choices[0].message.content if response.choices else None
    if not content:
        raise GroqGenerationError("Groq returned an empty response")

    return content