import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import DEFAULT_SECRET, Settings
from app.db import Database
from app.routers import auth, chat, documents, exams
from app.services.embeddings import FastEmbedder
from app.services.llm import LLMClient
from app.services.vectorstore import VectorStore
from app.winperf import keep_server_responsive

log = logging.getLogger("documind")


def create_app(settings: Settings | None = None, *, embedder=None, llm=None) -> FastAPI:
    """App factory. Embedder and LLM can be injected (used by the tests)."""
    settings = settings or Settings()
    if settings.secret_key == DEFAULT_SECRET:
        log.warning("SECRET_KEY is the default value; set a strong one before deploying.")

    data = Path(settings.data_dir)
    data.mkdir(parents=True, exist_ok=True)

    app = FastAPI(title="Ask & Ace", version="1.0.0",
                  description="Bring your PDF to life: ask it questions with page-cited answers, then generate and mark practice exams from it.")
    app.state.settings = settings
    app.state.db = Database(str(data / "app.db"))
    app.state.store = VectorStore(str(data / "chroma"))
    app.state.embedder = embedder or FastEmbedder(
        settings.embedding_model, settings.embedding_batch_size
    )
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
    app.include_router(exams.router)

    @app.get("/health", tags=["meta"])
    def health():
        return {"status": "ok"}

    return app


def app_factory() -> FastAPI:  # uvicorn --factory app.main:app_factory
    # uvicorn only configures its own loggers, so without this the app's own
    # INFO lines (such as indexing timings) never reach the console.
    logging.basicConfig(
        level=logging.INFO,
        # Timestamps matter here: they are what let you tell a slow upload
        # apart from an upload that ran while the machine was busy.
        format="%(levelname)s:     %(asctime)s %(message)s",
        datefmt="%H:%M:%S",
    )
    keep_server_responsive()
    return create_app()
