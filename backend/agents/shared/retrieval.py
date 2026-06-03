"""
Shared vector retrieval — used by Chat Retriever and Research Researcher.
"""
import numpy as np
from typing import List, Optional

from db.faiss_store import load_faiss_index
from db.multi_doc_store import multi_doc_store
from utils.embeddings import get_embedding
from utils.logger import agent_logger


class VectorRetriever:
    """Retrieve relevant chunks from FAISS / multi-document store."""

    def _build_citation_id(self, index: int) -> str:
        alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        result = ""
        current = index
        while True:
            result = alphabet[current % 26] + result
            current = (current // 26) - 1
            if current < 0:
                break
        return result

    def search(self, query: str, top_k: int = 5, source: Optional[str] = None) -> dict:
        agent_logger.info(f"VectorRetriever: legacy search query='{query[:80]}'")

        index, metadata, _documents = load_faiss_index()
        if index is None:
            return {
                "status": "error",
                "message": "No documents in database",
                "chunks": [],
                "sources": [],
            }

        q_vec = np.array([get_embedding(query)]).astype("float32")
        search_k = top_k * 10 if source else top_k
        distances, indices = index.search(q_vec, search_k)

        retrieved_chunks: List[str] = []
        retrieved_sources: List[str] = []

        for i in indices[0]:
            if i < len(metadata):
                chunk_data = metadata[i]
                if source is None or chunk_data.get("source") == source:
                    retrieved_chunks.append(chunk_data["chunk"])
                    retrieved_sources.append(chunk_data.get("source", "unknown"))
                    if len(retrieved_chunks) >= top_k:
                        break

        return {
            "status": "success",
            "query": query,
            "chunks": retrieved_chunks,
            "sources": retrieved_sources,
            "num_results": len(retrieved_chunks),
        }

    def search_multi_doc(
        self,
        query: str,
        doc_ids: Optional[List[str]] = None,
        top_k: int = 5,
    ) -> dict:
        agent_logger.info(f"VectorRetriever: multi-doc search query='{query[:80]}'")

        all_docs = multi_doc_store.list_documents()
        if not all_docs:
            return {
                "status": "error",
                "message": "No documents in database",
                "chunks": [],
                "sources": [],
            }

        if not doc_ids:
            doc_ids = [doc["doc_id"] for doc in all_docs]

        available = {doc["doc_id"] for doc in all_docs}
        invalid = [d for d in doc_ids if d not in available]
        if invalid:
            agent_logger.warning(f"VectorRetriever: invalid doc_ids {invalid}")
            doc_ids = [d for d in doc_ids if d in available]
            if not doc_ids:
                return {
                    "status": "error",
                    "message": f"Invalid document IDs: {invalid}",
                    "chunks": [],
                    "sources": [],
                }

        q_vec = np.array(get_embedding(query))
        chunks, sources, distances, retrieval_items = multi_doc_store.search_documents(
            doc_ids=doc_ids,
            query_vector=q_vec,
            top_k=top_k,
            query_text=query,
        )

        for idx, item in enumerate(retrieval_items):
            item["citation_id"] = self._build_citation_id(idx)

        return {
            "status": "success",
            "query": query,
            "chunks": chunks,
            "sources": sources,
            "distances": distances,
            "retrieval_items": retrieval_items,
            "num_results": len(chunks),
            "searched_docs": doc_ids,
        }
