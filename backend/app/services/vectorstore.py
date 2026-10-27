"""ChromaDB wrapper. Every vector carries user_id + document_id metadata so
queries can be scoped to the requesting user."""
import chromadb
from chromadb.config import Settings as ChromaSettings

from app.services.ingest import Chunk


class VectorStore:
    def __init__(self, path: str):
        self.client = chromadb.PersistentClient(
            path=path, settings=ChromaSettings(anonymized_telemetry=False)
        )
        self.collection = self.client.get_or_create_collection(
            name="documents", metadata={"hnsw:space": "cosine"}
        )

    def add(self, document_id: int, user_id: int, filename: str,
            chunks: list[Chunk], embeddings: list[list[float]]) -> None:
        self.collection.add(
            ids=[f"{document_id}:{c.index}" for c in chunks],
            documents=[c.text for c in chunks],
            embeddings=embeddings,
            metadatas=[
                {"user_id": user_id, "document_id": document_id,
                 "filename": filename, "page": c.page}
                for c in chunks
            ],
        )

    def query(self, embedding: list[float], user_id: int, top_k: int,
              document_id: int | None = None) -> list[dict]:
        where: dict = {"user_id": user_id}
        if document_id is not None:
            where = {"$and": [{"user_id": user_id}, {"document_id": document_id}]}
        res = self.collection.query(
            query_embeddings=[embedding], n_results=top_k, where=where
        )
        hits = []
        for text, meta, dist in zip(
            res["documents"][0], res["metadatas"][0], res["distances"][0]
        ):
            hits.append({
                "text": text,
                "page": meta["page"],
                "filename": meta["filename"],
                "document_id": meta["document_id"],
                "distance": dist,
            })
        return hits

    def delete_document(self, document_id: int) -> None:
        self.collection.delete(where={"document_id": document_id})
