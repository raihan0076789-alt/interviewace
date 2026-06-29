from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central app configuration, loaded from environment variables / .env file.
    Keeping every secret and tunable value here (instead of scattered through
    the codebase) is what makes this swappable from local SQLite -> Neon Postgres
    with zero code changes, just an env var.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./interviewace.db"

    # JWT
    JWT_SECRET_KEY: str = "dev-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    FRONTEND_ORIGIN: str = "http://localhost:3000"
    # Groq (LLM question generation)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    QUESTION_CACHE_TTL_SECONDS: int = 3600

    # Groq Whisper (audio transcription)    
    WHISPER_MODEL: str = "whisper-large-v3-turbo"

settings = Settings()
