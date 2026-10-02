import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str
    gemini_model: str
    gemini_fallback_models: list[str]
    allow_mock_fallback: bool
    kakao_rest_api_key: str
    database_path: str
    cors_origins: list[str]


@lru_cache
def get_settings() -> Settings:
    return Settings(
        gemini_api_key=os.getenv("GEMINI_API_KEY", "").strip(),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip(),
        gemini_fallback_models=[
            m.strip()
            for m in os.getenv("GEMINI_FALLBACK_MODELS", "gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-flash-lite-latest").split(",")
            if m.strip()
        ],
        allow_mock_fallback=os.getenv("ALLOW_MOCK_FALLBACK", "1") == "1",
        kakao_rest_api_key=os.getenv("KAKAO_REST_API_KEY", "").strip(),
        database_path=os.getenv("DATABASE_PATH", "./tripplan.db"),
        cors_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()],
    )
