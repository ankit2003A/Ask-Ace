"""Application settings, loaded from environment variables / .env."""
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SECRET = "change-me-in-production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Security
    secret_key: str = DEFAULT_SECRET
    access_token_minutes: int = 60

    # Google Sign-In. Empty disables it: the frontend asks for this at
    # /auth/config and only draws the Google button when it comes back set.
    # It is the OAuth client ID from the Google Cloud console, not a secret.
    google_client_id: str = ""

    # Storage
    data_dir: str = "./data"

    # LLM (any OpenAI-compatible endpoint; Groq and Gemini both work)
    llm_api_key: str = ""
    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_model: str = "openai/gpt-oss-120b"
    llm_timeout_seconds: float = 30.0

    # Embeddings
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    # Texts per ONNX call. Counter-intuitively 1 is the fastest on CPU: every
    # text in a batch is padded to the longest one in it, and that wasted
    # compute costs more than the per-call overhead it saves. Measured on a
    # 143-page PDF (211 chunks): 4.7s at 1, 18.6s at 256, with identical
    # vectors. Raise it if you move embedding to a GPU, where batching wins.
    embedding_batch_size: int = 1

    # RAG tuning
    chunk_size: int = 1000
    chunk_overlap: int = 150
    top_k: int = 4
    # Cosine distance; chunks farther than this are treated as irrelevant.
    max_distance: float = 0.65

    # Exam generation. Writing 30 questions takes far longer than one answer,
    # so it gets its own, larger timeout.
    exam_timeout_seconds: float = 180.0
    exam_max_questions: int = 30
    # How much of the document to put in front of the model, in characters.
    exam_context_chars: int = 24000

    # Upload limits
    max_upload_mb: int = 10
    max_pages: int = 200

    # CORS (comma-separated origins)
    cors_origins: str = "http://localhost:5173"

    # Built React app, served by app.site in production (the Docker image sets it).
    frontend_dir: str = "../frontend/dist"
