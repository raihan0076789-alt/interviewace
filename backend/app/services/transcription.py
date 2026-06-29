"""
Audio transcription using Groq's Whisper endpoint.

Kept as a separate service module (not inside groq_client.py) because
transcription has different inputs, error conditions, and future-upgrade
paths than the chat completion calls used for question generation. If we
ever swap Whisper for a different STT provider, this is the only file
that changes.

Supported audio formats by Groq Whisper: mp3, mp4, mpeg, mpga, m4a,
wav, webm. The browser's MediaRecorder API produces webm/opus by default,
which is what the Phase 6 frontend will send.
"""

import logging

from groq import APIConnectionError, APIError, APIStatusError, AsyncGroq, RateLimitError

from app.core.config import settings

logger = logging.getLogger(__name__)


class TranscriptionError(Exception):
    """
    Wraps any Whisper failure into one exception type so the API route can
    catch a single thing and decide how to respond (store empty transcript
    + warning, rather than crashing the whole answer-submission flow).
    """


async def transcribe_audio(audio_bytes: bytes, filename: str) -> str:
    """
    Send raw audio bytes to Groq Whisper and return the transcribed text.

    Args:
        audio_bytes: Raw audio file content (webm, mp3, wav, etc.)
        filename:    Original filename including extension — Groq uses the
                     extension to detect the audio format, so this matters.

    Returns:
        Transcribed text string. May be empty string if Whisper detected
        silence or couldn't make out speech (not an error — caller decides
        how to handle an empty transcript).

    Raises:
        TranscriptionError: on any network, auth, or API-level failure.
    """
    if not settings.GROQ_API_KEY:
        raise TranscriptionError("GROQ_API_KEY is not set")

    if not audio_bytes:
        raise TranscriptionError("Empty audio data received")

    client = AsyncGroq(api_key=settings.GROQ_API_KEY)

    # Groq expects a (filename, bytes, mime_type) tuple for the file field.
    # We infer a basic mime type from the extension; webm is the default
    # because that's what browsers produce via MediaRecorder.
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "webm"
    mime_map = {
        "webm": "audio/webm",
        "mp3":  "audio/mpeg",
        "mp4":  "audio/mp4",
        "wav":  "audio/wav",
        "m4a":  "audio/mp4",
        "ogg":  "audio/ogg",
    }
    mime_type = mime_map.get(ext, "audio/webm")

    try:
        response = await client.audio.transcriptions.create(
            model=settings.WHISPER_MODEL,
            file=(filename, audio_bytes, mime_type),
            response_format="text",   # plain string, not a JSON object
            language="en",            # removes multilingual detection overhead
        )
    except RateLimitError as exc:
        raise TranscriptionError(f"Groq rate limit hit: {exc}") from exc
    except APIConnectionError as exc:
        raise TranscriptionError(f"Could not reach Groq: {exc}") from exc
    except (APIStatusError, APIError) as exc:
        raise TranscriptionError(f"Groq Whisper error: {exc}") from exc

    # response_format="text" returns a plain string directly
    transcript = str(response).strip() if response else ""
    logger.info("Transcription complete: %d characters", len(transcript))
    return transcript