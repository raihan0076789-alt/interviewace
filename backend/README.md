# InterviewAce — Backend

AI mock interview coach. This is **Phase 1: Foundation** — project structure, database schema, and JWT authentication. Question generation, recording, computer vision, and evaluation land in later phases.

## What's implemented in Phase 1

- FastAPI app with async SQLAlchemy 2.0 models for `users`, `interview_sessions`, `questions`, `answers`
- Alembic migrations (autogenerate already verified against the schema)
- JWT auth: register, login, refresh, and a protected `/me` route
- 11 passing pytest tests covering the full auth flow, run against an isolated in-memory test database
- A GitHub Actions workflow (`.github/workflows/backend-tests.yml`, at the repo root) that runs the test suite on every push

## Project layout

```
backend/
├── app/
│   ├── main.py            # FastAPI app, CORS, router registration
│   ├── core/
│   │   ├── config.py      # Settings loaded from .env
│   │   └── security.py    # bcrypt hashing + JWT create/decode
│   ├── db/
│   │   ├── base.py        # Declarative Base
│   │   └── session.py     # Async engine, session factory, get_db dependency
│   ├── models/             # SQLAlchemy ORM models (the 4 tables above)
│   ├── schemas/             # Pydantic request/response models
│   └── api/
│       ├── deps.py          # get_current_user — the auth dependency
│       └── routes/auth.py   # /api/auth/* endpoints
├── alembic/                # Migrations (env.py wired to read DATABASE_URL from settings)
├── tests/                  # pytest suite, isolated in-memory SQLite per test
├── requirements.txt        # Production dependencies
├── requirements-dev.txt    # + pytest/httpx for testing
└── .env.example
```

## Running it locally

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt

cp .env.example .env               # defaults to local SQLite, zero setup needed

alembic upgrade head                # creates the 4 tables in interviewace.db

uvicorn app.main:app --reload       # http://localhost:8000
```

Open `http://localhost:8000/docs` — FastAPI's interactive Swagger UI. You can register a user, log in, click "Authorize," paste the access token, and call `/api/auth/me` directly from the browser. This is the fastest way to demo Phase 1 to anyone without writing a single curl command.

### Manual testing with curl

```bash
# Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"supersecret123","target_role":"SDE-1 Backend"}'

# Login (save the access_token from the response)
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"supersecret123"}'

# Call a protected route
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer <paste access_token here>"
```

## Running the tests

```bash
pytest -v
```

Tests run against an in-memory SQLite database created fresh for every test function (see `tests/conftest.py`) — they never touch your local `interviewace.db`, so running the suite is always safe and order-independent.

## Switching from local SQLite to Neon Postgres

This is a one-line change, by design:

1. Create a free project at [neon.tech](https://neon.tech), copy the connection string.
2. In `.env`, replace `DATABASE_URL` with:
   ```
   DATABASE_URL=postgresql+asyncpg://<user>:<password>@<neon-host>/<dbname>?ssl=require
   ```
3. Run `alembic upgrade head` again — it connects to Neon this time and creates the same 4 tables there.

No code changes. The async/sync driver split in `alembic/env.py` and the single `DATABASE_URL` source of truth in `app/core/config.py` are exactly what make this swap trivial — worth mentioning explicitly if an interviewer asks how you'd move this from a laptop demo to production.

## Generating a real JWT secret before deploying

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```
Paste the output as `JWT_SECRET_KEY` in your `.env` (and in Render's environment variables once deployed). Never commit the real value — `.env` is already in `.gitignore`.

## What's next (Phase 2)

Question generation: an endpoint that calls the Groq API to generate role-specific interview questions, plus a static fallback question bank for when the LLM call fails or rate-limits.
