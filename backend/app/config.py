"""Application settings, loaded from environment variables / .env."""
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SECRET = "change-me-in-production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Security
    secret_key: str = DEFAULT_SECRET
    access_token_minutes: int = 60

    # Storage
    data_dir: str = "./data"

    # LLM (any OpenAI-compatible endpoint; Groq and Gemini both work)
    llm_api_key: str = ""
    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_model: str = "llama-3.3-70b-versatile"
    llm_timeout_seconds: float = 30.0

    # Embeddings
    embedding_model: str = "BAAI/bge-small-en-v1.5"

    # RAG tuning
    chunk_size: int = 1000
    chunk_overlap: int = 150
    top_k: int = 4
    # Cosine distance; chunks farther than this are treated as irrelevant.
    max_distance: float = 0.65

    # Upload limits
    max_upload_mb: int = 10
    max_pages: int = 200

    # CORS (comma-separated origins)
    cors_origins: str = "http://localhost:5173"
