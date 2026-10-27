import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import DEFAULT_SECRET, Settings
from app.db import Database
from app.routers import auth, chat, documents
from app.services.embeddings import FastEmbedder
from app.services.llm import LLMClient
from app.services.vectorstore import VectorStore

log = logging.getLogger("documind")


def create_app(settings: Settings | None = None, *, embedder=None, llm=None) -> FastAPI:
    """App factory. Embedder and LLM can be injected (used by the tests)."""
    settings = settings or Settings()
    if settings.secret_key == DEFAULT_SECRET:
        log.warning("SECRET_KEY is the default value; set a strong one before deploying.")

    data = Path(settings.data_dir)
    data.mkdir(parents=True, exist_ok=True)

    app = FastAPI(title="DocuMind AI", version="1.0.0",
                  description="RAG question-answering over your PDFs, with page-level citations.")
    app.state.settings = settings
    app.state.db = Database(str(data / "app.db"))
    app.state.store = VectorStore(str(data / "chroma"))
    app.state.embedder = embedder or FastEmbedder(settings.embedding_model)
    app.state.llm = llm or LLMClient(settings.llm_api_key, settings.llm_base_url,
                                     settings.llm_model, settings.llm_timeout_seconds)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
        allow_methods=["*"], allow_headers=["*"],
    )
    app.include_router(auth.router)
    app.include_router(documents.router)
    app.include_router(chat.router)

    @app.get("/health", tags=["meta"])
    def health():
        return {"status": "ok"}

    return app


def app_factory() -> FastAPI:  # uvicorn --factory app.main:app_factory
    return create_app()
