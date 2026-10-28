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

    def document_chunks(self, document_id: int, user_id: int) -> list[dict]:
        """Every chunk of one document, in reading order.

        Used by exam generation, which needs coverage of the whole document
        rather than the nearest neighbours of a single query.
        """
        res = self.collection.get(
            where={"$and": [{"user_id": user_id}, {"document_id": document_id}]},
            include=["documents", "metadatas"],
        )
        chunks = []
        for cid, text, meta in zip(res["ids"], res["documents"], res["metadatas"]):
            # Ids are "<document_id>:<chunk index>"; the suffix is the order.
            try:
                index = int(str(cid).split(":")[-1])
            except ValueError:
                index = 0
            chunks.append({"index": index, "text": text, "page": meta["page"]})
        chunks.sort(key=lambda c: c["index"])
        return chunks

    def delete_document(self, document_id: int) -> None:
        self.collection.delete(where={"document_id": document_id})
