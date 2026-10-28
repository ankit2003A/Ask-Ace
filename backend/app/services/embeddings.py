"""Embedding backends. The app depends only on the `embed` method,
so tests can swap in a deterministic fake."""
import os
from typing import Protocol


class Embedder(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]: ...


class FastEmbedder:
    """Runs a small ONNX model on CPU (no PyTorch, fits free-tier RAM).
    The model is downloaded on first use and loaded lazily."""

    def __init__(self, model_name: str, batch_size: int = 1):
        self.model_name = model_name
        self.batch_size = batch_size
        self._model = None

    def embed(self, texts: list[str]) -> list[list[float]]:
        if self._model is None:
            from fastembed import TextEmbedding

            self._model = TextEmbedding(
                model_name=self.model_name, cache_dir=os.getenv("FASTEMBED_CACHE_PATH")
            )
        # batch_size matters a lot on CPU; see Settings.embedding_batch_size.
        return [vec.tolist() for vec in self._model.embed(texts, batch_size=self.batch_size)]
