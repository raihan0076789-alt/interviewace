"""
Phase 5 test suite — evaluation engine.

Three groups:
1. Evaluation service unit tests (prompt parser, score blending)
2. /evaluate endpoint integration tests
3. /report endpoint integration tests
"""

import json
from unittest.mock import AsyncMock, patch

import pytest

from app.services.evaluation import (
    EvaluationResult,
    _compute_overall_score,
    _parse_evaluation_response,
    compute_session_overall_score,
)

# ─────────────────────────────────────────────
# 1. Evaluation service unit tests
# ─────────────────────────────────────────────

VALID_EVAL_JSON = json.dumps({
    "content_score": 7.5,
    "feedback": "Good answer with clear structure. Add more specific examples next time.",
    "strengths": ["Clear explanation", "Relevant experience mentioned"],
    "improvements": ["Add concrete metrics", "Be more concise"],
})


class TestParseEvaluationResponse:

    def test_parses_valid_json(self):
        result = _parse_evaluation_response(VALID_EVAL_JSON)
        assert result["content_score"] == 7.5
        assert "feedback" in result
        assert isinstance(result["strengths"], list)
        assert isinstance(result["improvements"], list)

    def test_strips_code_fence(self):
        fenced = f"```json\n{VALID_EVAL_JSON}\n```"
        result = _parse_evaluation_response(fenced)
        assert result["content_score"] == 7.5

    def test_handles_text_before_json(self):
        prefixed = f"Here is my evaluation:\n{VALID_EVAL_JSON}"
        result = _parse_evaluation_response(prefixed)
        assert result["content_score"] == 7.5

    def test_raises_on_no_json_object(self):
        with pytest.raises(ValueError, match="No JSON object found"):
            _parse_evaluation_response("Sorry, I cannot evaluate this.")

    def test_raises_on_missing_required_field(self):
        incomplete = json.dumps({"content_score": 7.5, "feedback": "ok"})
        with pytest.raises(ValueError, match="missing fields"):
            _parse_evaluation_response(incomplete)

    def test_raises_on_score_out_of_range(self):
        bad = json.dumps({
            "content_score": 15.0,
            "feedback": "x",
            "strengths": [],
            "improvements": [],
        })
        with pytest.raises(ValueError, match="out of range"):
            _parse_evaluation_response(bad)

    def test_rounds_score_to_one_decimal(self):
        raw = json.dumps({
            "content_score": 7.123456,
            "feedback": "ok",
            "strengths": [],
            "improvements": [],
        })
        result = _parse_evaluation_response(raw)
        assert result["content_score"] == 7.1


class TestComputeOverallScore:

    def test_no_cv_data_returns_content_score(self):
        assert _compute_overall_score(8.0, None, None) == 8.0

    def test_both_cv_scores_present_blends_correctly(self):
        # delivery = (0.8 + 0.6) / 2 * 10 = 7.0
        # overall = 0.6 * 8.0 + 0.4 * 7.0 = 4.8 + 2.8 = 7.6
        result = _compute_overall_score(8.0, 0.8, 0.6)
        assert result == 7.6

    def test_only_eye_contact_provided(self):
        # delivery = 0.9 * 10 = 9.0
        # overall = 0.6 * 8.0 + 0.4 * 9.0 = 4.8 + 3.6 = 8.4
        result = _compute_overall_score(8.0, 0.9, None)
        assert result == 8.4

    def test_perfect_scores(self):
        result = _compute_overall_score(10.0, 1.0, 1.0)
        assert result == 10.0

    def test_zero_scores(self):
        result = _compute_overall_score(0.0, 0.0, 0.0)
        assert result == 0.0


class TestComputeSessionOverallScore:

    def test_empty_list_returns_none(self):
        assert compute_session_overall_score([]) is None

    def test_single_score(self):
        assert compute_session_overall_score([7.5]) == 7.5

    def test_averages_multiple_scores(self):
        result = compute_session_overall_score([8.0, 6.0, 7.0])
        assert result == 7.0

    def test_rounds_to_one_decimal(self):
        result = compute_session_overall_score([7.0, 8.0, 9.0])
        assert result == 8.0


# ─────────────────────────────────────────────
# Shared test helpers
# ─────────────────────────────────────────────

MOCK_QUESTIONS_JSON = json.dumps([
    "Tell me about a challenging backend project.",
    "How do you handle database migrations in production?",
    "Explain the CAP theorem.",
    "What is the difference between a process and a thread?",
    "How would you design a URL shortener?",
])

MOCK_TRANSCRIPT = "I worked on a FastAPI project using PostgreSQL and Docker."

MOCK_EVAL_RESPONSE = json.dumps({
    "content_score": 7.5,
    "feedback": "Good answer. You explained the project well but could add metrics.",
    "strengths": ["Clear communication", "Relevant tech stack mentioned"],
    "improvements": ["Add quantitative results", "Mention challenges faced"],
})


def _full_setup(client):
    """Register, login, create session, submit answer, return all IDs and token."""
    client.post("/api/auth/register", json={
        "email": "raihan@test.com", "password": "testpass123",
    })
    login = client.post("/api/auth/login", json={
        "email": "raihan@test.com", "password": "testpass123",
    })
    token = f"Bearer {login.json()['access_token']}"

    with patch(
        "app.services.question_generation.generate_chat_completion",
        new_callable=AsyncMock,
        return_value=MOCK_QUESTIONS_JSON,
    ):
        session = client.post(
            "/api/sessions/",
            json={"role": "SDE-1 Backend", "difficulty": "medium", "question_count": 5},
            headers={"Authorization": token},
        ).json()

    session_id = session["id"]
    question_id = session["questions"][0]["id"]

    import io
    with patch(
        "app.api.routes.answers.transcribe_audio",
        new_callable=AsyncMock,
        return_value=MOCK_TRANSCRIPT,
    ):
        client.post(
            f"/api/sessions/{session_id}/answers/{question_id}",
            files={"audio": ("rec.webm", io.BytesIO(b"fake"), "audio/webm")},
            data={"eye_contact_score": "0.8", "posture_score": "0.7"},
            headers={"Authorization": token},
        )

    return token, session_id, question_id


# ─────────────────────────────────────────────
# 2. /evaluate endpoint tests
# ─────────────────────────────────────────────

class TestEvaluateEndpoint:

    def test_evaluate_unauthenticated_returns_401(self, client):
        resp = client.post("/api/sessions/1/answers/1/evaluate")
        assert resp.status_code == 401

    def test_evaluate_stores_score_and_feedback(self, client):
        token, session_id, question_id = _full_setup(client)

        with patch(
            "app.api.routes.answers.evaluate_answer",
            new_callable=AsyncMock,
            return_value=EvaluationResult(
                content_score=7.5,
                overall_score=7.6,
                feedback="Good answer. Add more examples.",
                strengths=["Clear", "Relevant"],
                improvements=["More examples"],
            ),
        ):
            resp = client.post(
                f"/api/sessions/{session_id}/answers/{question_id}/evaluate",
                headers={"Authorization": token},
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["content_score"] == 7.5
        assert body["feedback"] == "Good answer. Add more examples."

    def test_evaluate_404_when_no_answer_exists(self, client):
        """Must submit audio before evaluating."""
        client.post("/api/auth/register", json={
            "email": "user2@test.com", "password": "testpass123",
        })
        login = client.post("/api/auth/login", json={
            "email": "user2@test.com", "password": "testpass123",
        })
        token = f"Bearer {login.json()['access_token']}"

        with patch(
            "app.services.question_generation.generate_chat_completion",
            new_callable=AsyncMock,
            return_value=MOCK_QUESTIONS_JSON,
        ):
            session = client.post(
                "/api/sessions/",
                json={"role": "SDE-1 Backend", "difficulty": "medium", "question_count": 5},
                headers={"Authorization": token},
            ).json()

        question_id = session["questions"][0]["id"]
        resp = client.post(
            f"/api/sessions/{session['id']}/answers/{question_id}/evaluate",
            headers={"Authorization": token},
        )
        assert resp.status_code == 404

    def test_evaluate_502_on_llm_failure(self, client):
        from app.services.groq_client import GroqGenerationError
        token, session_id, question_id = _full_setup(client)

        with patch(
            "app.api.routes.answers.evaluate_answer",
            new_callable=AsyncMock,
            side_effect=GroqGenerationError("LLM down"),
        ):
            resp = client.post(
                f"/api/sessions/{session_id}/answers/{question_id}/evaluate",
                headers={"Authorization": token},
            )
        assert resp.status_code == 502

    def test_evaluate_wrong_session_returns_404(self, client):
        token, _, question_id = _full_setup(client)
        resp = client.post(
            f"/api/sessions/9999/answers/{question_id}/evaluate",
            headers={"Authorization": token},
        )
        assert resp.status_code == 404


# ─────────────────────────────────────────────
# 3. /report endpoint tests
# ─────────────────────────────────────────────

class TestReportEndpoint:

    def test_report_unauthenticated_returns_401(self, client):
        assert client.get("/api/sessions/1/report").status_code == 401

    def test_report_404_for_unknown_session(self, client):
        client.post("/api/auth/register", json={
            "email": "rep@test.com", "password": "testpass123",
        })
        login = client.post("/api/auth/login", json={
            "email": "rep@test.com", "password": "testpass123",
        })
        token = f"Bearer {login.json()['access_token']}"
        assert client.get(
            "/api/sessions/9999/report", headers={"Authorization": token}
        ).status_code == 404

    def test_report_shows_unanswered_questions(self, client):
        client.post("/api/auth/register", json={
            "email": "rep2@test.com", "password": "testpass123",
        })
        login = client.post("/api/auth/login", json={
            "email": "rep2@test.com", "password": "testpass123",
        })
        token = f"Bearer {login.json()['access_token']}"

        with patch(
            "app.services.question_generation.generate_chat_completion",
            new_callable=AsyncMock,
            return_value=MOCK_QUESTIONS_JSON,
        ):
            session = client.post(
                "/api/sessions/",
                json={"role": "SDE-1 Backend", "difficulty": "medium", "question_count": 5},
                headers={"Authorization": token},
            ).json()

        resp = client.get(
            f"/api/sessions/{session['id']}/report",
            headers={"Authorization": token},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_questions"] == 5
        assert body["answered_questions"] == 0
        assert body["evaluated_questions"] == 0
        assert body["overall_score"] is None
        assert body["completed_at"] is None

    def test_report_partial_answers_no_completion(self, client):
        token, session_id, question_id = _full_setup(client)
        # Only 1 of 5 questions answered, not evaluated
        resp = client.get(
            f"/api/sessions/{session_id}/report",
            headers={"Authorization": token},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["answered_questions"] == 1
        assert body["evaluated_questions"] == 0
        assert body["completed_at"] is None

    def test_report_aggregates_scores_after_evaluation(self, client):
        token, session_id, question_id = _full_setup(client)

        with patch(
            "app.api.routes.answers.evaluate_answer",
            new_callable=AsyncMock,
            return_value=EvaluationResult(
                content_score=8.0,
                overall_score=7.8,
                feedback="Solid answer.",
                strengths=["Clear"],
                improvements=["More examples"],
            ),
        ):
            client.post(
                f"/api/sessions/{session_id}/answers/{question_id}/evaluate",
                headers={"Authorization": token},
            )

        resp = client.get(
            f"/api/sessions/{session_id}/report",
            headers={"Authorization": token},
        )
        assert resp.status_code == 200
        body = resp.json()
        # 1 of 5 evaluated — overall score present, session NOT completed yet
        assert body["evaluated_questions"] == 1
        assert body["overall_score"] is not None
        assert body["completed_at"] is None  # only 1/5 done

    def test_report_wrong_user_returns_404(self, client):
        token_a, session_id, _ = _full_setup(client)

        client.post("/api/auth/register", json={
            "email": "other@test.com", "password": "otherpass123",
        })
        login_b = client.post("/api/auth/login", json={
            "email": "other@test.com", "password": "otherpass123",
        })
        token_b = f"Bearer {login_b.json()['access_token']}"

        resp = client.get(
            f"/api/sessions/{session_id}/report",
            headers={"Authorization": token_b},
        )
        assert resp.status_code == 404