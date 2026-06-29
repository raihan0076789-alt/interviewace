import json
from unittest.mock import AsyncMock, patch

import pytest

from app.services.fallback_questions import get_fallback_questions
from app.services.question_cache import TTLCache
from app.services.question_generation import _parse_questions_response


MOCK_QUESTIONS = [
    "Tell me about a challenging backend project.",
    "How do you handle database migrations in production?",
    "Explain the CAP theorem.",
    "What is the difference between a process and a thread?",
    "How would you design a URL shortener?",
]

MOCK_LLM_RESPONSE = json.dumps(MOCK_QUESTIONS)


class TestFallbackBank:
    def test_known_role_returns_correct_questions(self):
        questions = get_fallback_questions("SDE-1 Backend", 3)
        assert len(questions) == 3
        assert all(isinstance(q, str) and q.strip() for q in questions)

    def test_case_insensitive_lookup(self):
        lower = get_fallback_questions("sde-1 backend", 3)
        upper = get_fallback_questions("SDE-1 BACKEND", 3)
        assert lower == upper

    def test_unknown_role_returns_default_questions(self):
        questions = get_fallback_questions("Quantum Entanglement Engineer", 3)
        assert len(questions) == 3

    def test_count_larger_than_bank_cycles_without_error(self):
        questions = get_fallback_questions("default", 100)
        assert len(questions) == 100

    def test_count_of_one_returns_one(self):
        questions = get_fallback_questions("full stack developer", 1)
        assert len(questions) == 1


class TestTTLCache:
    def test_miss_on_empty_cache(self):
        cache = TTLCache(ttl_seconds=60)
        assert cache.get("SDE-1 Backend", "medium", 5) is None

    def test_hit_after_set(self):
        cache = TTLCache(ttl_seconds=60)
        questions = ["Q1", "Q2", "Q3"]
        cache.set("SDE-1 Backend", "medium", 3, questions)
        assert cache.get("SDE-1 Backend", "medium", 3) == questions

    def test_different_count_is_different_key(self):
        cache = TTLCache(ttl_seconds=60)
        cache.set("SDE-1 Backend", "medium", 5, ["A"] * 5)
        assert cache.get("SDE-1 Backend", "medium", 3) is None

    def test_expired_entry_returns_none(self):
        import time
        cache = TTLCache(ttl_seconds=0)
        cache.set("SDE-1 Backend", "medium", 5, ["Q"] * 5)
        time.sleep(0.01)
        assert cache.get("SDE-1 Backend", "medium", 5) is None

    def test_clear_empties_cache(self):
        cache = TTLCache(ttl_seconds=60)
        cache.set("SDE-1 Backend", "medium", 5, ["Q"] * 5)
        cache.clear()
        assert cache.get("SDE-1 Backend", "medium", 5) is None


class TestParseQuestionsResponse:
    def test_clean_json_array(self):
        raw = json.dumps(["What is REST?", "Explain JWT.", "What is async?"])
        assert _parse_questions_response(raw, 3) == ["What is REST?", "Explain JWT.", "What is async?"]

    def test_strips_code_fence(self):
        raw = "```json\n[\"Question one\", \"Question two\"]\n```"
        assert _parse_questions_response(raw, 2) == ["Question one", "Question two"]

    def test_truncates_to_expected_count(self):
        raw = json.dumps(["Q1", "Q2", "Q3", "Q4", "Q5"])
        assert _parse_questions_response(raw, 3) == ["Q1", "Q2", "Q3"]

    def test_raises_on_no_array_found(self):
        with pytest.raises(ValueError, match="No JSON array found"):
            _parse_questions_response("Here are some questions: ...", 3)

    def test_raises_on_non_string_elements(self):
        with pytest.raises(ValueError):
            _parse_questions_response(json.dumps([1, 2, 3]), 3)

    def test_handles_text_before_json(self):
        raw = "Sure! Here are your questions:\n[\"Q1\", \"Q2\"]"
        assert _parse_questions_response(raw, 2) == ["Q1", "Q2"]


def _register_and_login(client) -> str:
    client.post("/api/auth/register", json={
        "email": "raihan@example.com",
        "password": "supersecret123",
        "target_role": "SDE-1 Backend",
    })
    resp = client.post("/api/auth/login", json={
        "email": "raihan@example.com",
        "password": "supersecret123",
    })
    return f"Bearer {resp.json()['access_token']}"


class TestSessionsAPI:
    def test_create_session_unauthenticated_returns_401(self, client):
        resp = client.post("/api/sessions/", json={
            "role": "SDE-1 Backend", "difficulty": "medium", "question_count": 5,
        })
        assert resp.status_code == 401

    def test_create_session_llm_success(self, client):
        token = _register_and_login(client)
        with patch(
            "app.services.question_generation.generate_chat_completion",
            new_callable=AsyncMock,
            return_value=MOCK_LLM_RESPONSE,
        ):
            resp = client.post(
                "/api/sessions/",
                json={"role": "SDE-1 Backend", "difficulty": "medium", "question_count": 5},
                headers={"Authorization": token},
            )
        assert resp.status_code == 201
        body = resp.json()
        assert body["role"] == "SDE-1 Backend"
        assert len(body["questions"]) == 5
        assert body["questions"][0]["order_index"] == 0

    def test_create_session_falls_back_when_llm_fails(self, client):
        from app.services.groq_client import GroqGenerationError
        token = _register_and_login(client)
        with patch(
            "app.services.question_generation.generate_chat_completion",
            new_callable=AsyncMock,
            side_effect=GroqGenerationError("Rate limited"),
        ):
            resp = client.post(
                "/api/sessions/",
                json={"role": "SDE-1 Backend", "difficulty": "medium", "question_count": 5},
                headers={"Authorization": token},
            )
        assert resp.status_code == 201
        assert len(resp.json()["questions"]) == 5

    def test_create_session_falls_back_when_llm_returns_bad_json(self, client):
        token = _register_and_login(client)
        with patch(
            "app.services.question_generation.generate_chat_completion",
            new_callable=AsyncMock,
            return_value="Sorry, I can't help with that today.",
        ):
            resp = client.post(
                "/api/sessions/",
                json={"role": "SDE-1 Backend", "difficulty": "medium", "question_count": 5},
                headers={"Authorization": token},
            )
        assert resp.status_code == 201
        assert len(resp.json()["questions"]) == 5

    def test_create_session_invalid_difficulty_returns_422(self, client):
        token = _register_and_login(client)
        resp = client.post(
            "/api/sessions/",
            json={"role": "SDE-1 Backend", "difficulty": "nightmare", "question_count": 5},
            headers={"Authorization": token},
        )
        assert resp.status_code == 422

    def test_create_session_question_count_too_high_returns_422(self, client):
        token = _register_and_login(client)
        resp = client.post(
            "/api/sessions/",
            json={"role": "SDE-1 Backend", "difficulty": "medium", "question_count": 99},
            headers={"Authorization": token},
        )
        assert resp.status_code == 422

    def test_list_sessions_returns_only_current_users_sessions(self, client):
        token = _register_and_login(client)
        with patch(
            "app.services.question_generation.generate_chat_completion",
            new_callable=AsyncMock,
            return_value=MOCK_LLM_RESPONSE,
        ):
            client.post("/api/sessions/",
                json={"role": "SDE-1 Backend", "difficulty": "medium", "question_count": 5},
                headers={"Authorization": token})
            client.post("/api/sessions/",
                json={"role": "Full Stack Developer", "difficulty": "easy", "question_count": 3},
                headers={"Authorization": token})

        resp = client.get("/api/sessions/", headers={"Authorization": token})
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_get_session_by_id(self, client):
        token = _register_and_login(client)
        with patch(
            "app.services.question_generation.generate_chat_completion",
            new_callable=AsyncMock,
            return_value=MOCK_LLM_RESPONSE,
        ):
            create_resp = client.post(
                "/api/sessions/",
                json={"role": "SDE-1 Backend", "difficulty": "hard", "question_count": 5},
                headers={"Authorization": token},
            )
        session_id = create_resp.json()["id"]
        resp = client.get(f"/api/sessions/{session_id}", headers={"Authorization": token})
        assert resp.status_code == 200
        assert resp.json()["id"] == session_id

    def test_get_other_users_session_returns_404(self, client):
        token_a = _register_and_login(client)
        client.post("/api/auth/register", json={
            "email": "other@example.com", "password": "otherpassword123",
        })
        resp = client.post("/api/auth/login", json={
            "email": "other@example.com", "password": "otherpassword123",
        })
        token_b = f"Bearer {resp.json()['access_token']}"
        with patch(
            "app.services.question_generation.generate_chat_completion",
            new_callable=AsyncMock,
            return_value=MOCK_LLM_RESPONSE,
        ):
            create_resp = client.post(
                "/api/sessions/",
                json={"role": "SDE-1 Backend", "difficulty": "medium", "question_count": 5},
                headers={"Authorization": token_a},
            )
        session_id = create_resp.json()["id"]
        resp = client.get(f"/api/sessions/{session_id}", headers={"Authorization": token_b})
        assert resp.status_code == 404