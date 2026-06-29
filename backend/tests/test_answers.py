"""
Phase 3 test suite — recording pipeline.

Two groups:

1. Transcription service unit tests — mock the Groq SDK so no real API
   call happens, verify our wrapper behaves correctly for both success
   and every failure case.

2. Answer endpoint integration tests — mock transcribe_audio (not the
   SDK directly) to test the full HTTP layer: auth, ownership checks,
   retake overwrite, graceful fallback when transcription fails.

We don't test with a real audio file because:
- tests must run offline with no API key
- a fake bytes payload is enough to verify the pipeline wiring
- the live Groq call is verified manually (same as Phase 2)
"""

import io
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.transcription import TranscriptionError, transcribe_audio


# ─────────────────────────────────────────────
# 1. Transcription service unit tests
# ─────────────────────────────────────────────

class TestTranscriptionService:

    @pytest.mark.asyncio
    async def test_raises_when_api_key_missing(self):
        with patch("app.services.transcription.settings") as mock_settings:
            mock_settings.GROQ_API_KEY = ""
            with pytest.raises(TranscriptionError, match="GROQ_API_KEY is not set"):
                await transcribe_audio(b"fake audio", "recording.webm")

    @pytest.mark.asyncio
    async def test_raises_on_empty_audio(self):
        with patch("app.services.transcription.settings") as mock_settings:
            mock_settings.GROQ_API_KEY = "fake-key"
            with pytest.raises(TranscriptionError, match="Empty audio data"):
                await transcribe_audio(b"", "recording.webm")

    @pytest.mark.asyncio
    async def test_returns_transcript_on_success(self):
        mock_response = "Tell me about yourself and your experience."

        with patch("app.services.transcription.AsyncGroq") as MockGroq:
            mock_client = AsyncMock()
            MockGroq.return_value = mock_client
            mock_client.audio.transcriptions.create = AsyncMock(return_value=mock_response)

            with patch("app.services.transcription.settings") as mock_settings:
                mock_settings.GROQ_API_KEY = "fake-key"
                mock_settings.WHISPER_MODEL = "whisper-large-v3-turbo"

                result = await transcribe_audio(b"fake audio bytes", "recording.webm")

        assert result == "Tell me about yourself and your experience."

    @pytest.mark.asyncio
    async def test_raises_transcription_error_on_rate_limit(self):
        from groq import RateLimitError
        with patch("app.services.transcription.AsyncGroq") as MockGroq:
            mock_client = AsyncMock()
            MockGroq.return_value = mock_client
            mock_client.audio.transcriptions.create = AsyncMock(
                side_effect=RateLimitError(
                    "rate limited",
                    response=MagicMock(status_code=429),
                    body={}
                )
            )
            with patch("app.services.transcription.settings") as mock_settings:
                mock_settings.GROQ_API_KEY = "fake-key"
                mock_settings.WHISPER_MODEL = "whisper-large-v3-turbo"

                with pytest.raises(TranscriptionError, match="rate limit"):
                    await transcribe_audio(b"fake audio", "recording.webm")

    @pytest.mark.asyncio
    async def test_webm_extension_gets_correct_mime_type(self):
        """Ensure the correct MIME type is passed to Groq for webm files."""
        captured_call = {}

        async def fake_create(**kwargs):
            captured_call.update(kwargs)
            return "transcript text"

        with patch("app.services.transcription.AsyncGroq") as MockGroq:
            mock_client = AsyncMock()
            MockGroq.return_value = mock_client
            mock_client.audio.transcriptions.create = fake_create

            with patch("app.services.transcription.settings") as mock_settings:
                mock_settings.GROQ_API_KEY = "fake-key"
                mock_settings.WHISPER_MODEL = "whisper-large-v3-turbo"

                await transcribe_audio(b"fake audio", "answer.webm")

        filename, audio_bytes, mime_type = captured_call["file"]
        assert mime_type == "audio/webm"
        assert filename == "answer.webm"


# ─────────────────────────────────────────────
# 2. Answer endpoint integration tests
# ─────────────────────────────────────────────

MOCK_QUESTIONS = json.dumps([
    "Tell me about a challenging backend project.",
    "How do you handle database migrations in production?",
    "Explain the CAP theorem.",
    "What is the difference between a process and a thread?",
    "How would you design a URL shortener?",
])

MOCK_TRANSCRIPT = "I worked on a REST API project using FastAPI and PostgreSQL."


def _make_audio_file(content: bytes = b"fake audio data") -> dict:
    """Helper that builds the multipart files dict for TestClient."""
    return {"audio": ("recording.webm", io.BytesIO(content), "audio/webm")}


def _setup_user_and_session(client) -> tuple[str, int]:
    """Register, login, create a session, return (auth_header, session_id)."""
    client.post("/api/auth/register", json={
        "email": "raihan@test.com",
        "password": "testpass123",
    })
    login_resp = client.post("/api/auth/login", json={
        "email": "raihan@test.com",
        "password": "testpass123",
    })
    token = f"Bearer {login_resp.json()['access_token']}"

    with patch(
        "app.services.question_generation.generate_chat_completion",
        new_callable=AsyncMock,
        return_value=MOCK_QUESTIONS,
    ):
        session_resp = client.post(
            "/api/sessions/",
            json={"role": "SDE-1 Backend", "difficulty": "medium", "question_count": 5},
            headers={"Authorization": token},
        )
    session_id = session_resp.json()["id"]
    return token, session_id


class TestAnswerEndpoints:

    def test_submit_answer_unauthenticated_returns_401(self, client):
        resp = client.post(
            "/api/sessions/1/answers/1",
            files=_make_audio_file(),
        )
        assert resp.status_code == 401

    def test_submit_answer_wrong_session_returns_404(self, client):
        token, _ = _setup_user_and_session(client)

        with patch(
            "app.api.routes.answers.transcribe_audio",
            new_callable=AsyncMock,
            return_value=MOCK_TRANSCRIPT,
        ):
            resp = client.post(
                "/api/sessions/9999/answers/1",   # session 9999 doesn't exist
                files=_make_audio_file(),
                headers={"Authorization": token},
            )
        assert resp.status_code == 404

    def test_submit_answer_stores_transcript(self, client):
        token, session_id = _setup_user_and_session(client)

        # Get question id from the session
        session_resp = client.get(
            f"/api/sessions/{session_id}",
            headers={"Authorization": token},
        )
        question_id = session_resp.json()["questions"][0]["id"]

        with patch(
            "app.api.routes.answers.transcribe_audio",
            new_callable=AsyncMock,
            return_value=MOCK_TRANSCRIPT,
        ):
            resp = client.post(
                f"/api/sessions/{session_id}/answers/{question_id}",
                files=_make_audio_file(),
                headers={"Authorization": token},
            )

        assert resp.status_code == 201
        body = resp.json()
        assert body["transcript"] == MOCK_TRANSCRIPT
        assert body["question_id"] == question_id
        assert body["content_score"] is None   # Phase 5 fills this
        assert body["feedback"] is None         # Phase 5 fills this

    def test_submit_answer_stores_cv_scores(self, client):
        token, session_id = _setup_user_and_session(client)
        question_id = client.get(
            f"/api/sessions/{session_id}", headers={"Authorization": token}
        ).json()["questions"][0]["id"]

        with patch(
            "app.api.routes.answers.transcribe_audio",
            new_callable=AsyncMock,
            return_value=MOCK_TRANSCRIPT,
        ):
            resp = client.post(
                f"/api/sessions/{session_id}/answers/{question_id}",
                files=_make_audio_file(),
                data={
                    "eye_contact_score": "0.85",
                    "posture_score": "0.72",
                    "audio_duration_seconds": "47.3",
                },
                headers={"Authorization": token},
            )

        assert resp.status_code == 201
        body = resp.json()
        assert abs(body["eye_contact_score"] - 0.85) < 0.001
        assert abs(body["posture_score"] - 0.72) < 0.001
        assert abs(body["audio_duration_seconds"] - 47.3) < 0.001

    def test_submit_answer_gracefully_handles_transcription_failure(self, client):
        """Transcription failure should NOT cause a 500 — answer is saved with null transcript."""
        token, session_id = _setup_user_and_session(client)
        question_id = client.get(
            f"/api/sessions/{session_id}", headers={"Authorization": token}
        ).json()["questions"][0]["id"]

        with patch(
            "app.api.routes.answers.transcribe_audio",
            new_callable=AsyncMock,
            side_effect=TranscriptionError("Groq is down"),
        ):
            resp = client.post(
                f"/api/sessions/{session_id}/answers/{question_id}",
                files=_make_audio_file(),
                headers={"Authorization": token},
            )

        assert resp.status_code == 201
        assert resp.json()["transcript"] is None  # saved, just no transcript

    def test_retake_overwrites_previous_answer(self, client):
        token, session_id = _setup_user_and_session(client)
        question_id = client.get(
            f"/api/sessions/{session_id}", headers={"Authorization": token}
        ).json()["questions"][0]["id"]

        url = f"/api/sessions/{session_id}/answers/{question_id}"

        # First submission
        with patch(
            "app.api.routes.answers.transcribe_audio",
            new_callable=AsyncMock,
            return_value="First attempt answer.",
        ):
            resp1 = client.post(url, files=_make_audio_file(), headers={"Authorization": token})
        assert resp1.json()["transcript"] == "First attempt answer."

        # Retake — second submission to the same question
        with patch(
            "app.api.routes.answers.transcribe_audio",
            new_callable=AsyncMock,
            return_value="Better second attempt.",
        ):
            resp2 = client.post(url, files=_make_audio_file(), headers={"Authorization": token})
        assert resp2.status_code == 201
        assert resp2.json()["transcript"] == "Better second attempt."

    def test_get_answer_returns_stored_answer(self, client):
        token, session_id = _setup_user_and_session(client)
        question_id = client.get(
            f"/api/sessions/{session_id}", headers={"Authorization": token}
        ).json()["questions"][0]["id"]

        with patch(
            "app.api.routes.answers.transcribe_audio",
            new_callable=AsyncMock,
            return_value=MOCK_TRANSCRIPT,
        ):
            client.post(
                f"/api/sessions/{session_id}/answers/{question_id}",
                files=_make_audio_file(),
                headers={"Authorization": token},
            )

        resp = client.get(
            f"/api/sessions/{session_id}/answers/{question_id}",
            headers={"Authorization": token},
        )
        assert resp.status_code == 200
        assert resp.json()["transcript"] == MOCK_TRANSCRIPT

    def test_get_answer_404_when_not_yet_answered(self, client):
        token, session_id = _setup_user_and_session(client)
        question_id = client.get(
            f"/api/sessions/{session_id}", headers={"Authorization": token}
        ).json()["questions"][0]["id"]

        resp = client.get(
            f"/api/sessions/{session_id}/answers/{question_id}",
            headers={"Authorization": token},
        )
        assert resp.status_code == 404

    def test_cannot_access_other_users_session_answers(self, client):
        """User B cannot submit answers for User A's session."""
        token_a, session_id = _setup_user_and_session(client)

        # Register User B
        client.post("/api/auth/register", json={
            "email": "other@test.com", "password": "otherpass123",
        })
        login_b = client.post("/api/auth/login", json={
            "email": "other@test.com", "password": "otherpass123",
        })
        token_b = f"Bearer {login_b.json()['access_token']}"

        question_id = client.get(
            f"/api/sessions/{session_id}", headers={"Authorization": token_a}
        ).json()["questions"][0]["id"]

        with patch(
            "app.api.routes.answers.transcribe_audio",
            new_callable=AsyncMock,
            return_value=MOCK_TRANSCRIPT,
        ):
            resp = client.post(
                f"/api/sessions/{session_id}/answers/{question_id}",
                files=_make_audio_file(),
                headers={"Authorization": token_b},  # wrong user
            )
        assert resp.status_code == 404