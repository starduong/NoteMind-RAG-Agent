"""Chat Retriever Agent — fetch relevant chunks from vector store."""
from typing import List, Optional

from agents.shared.retrieval import VectorRetriever
from utils.logger import agent_logger


class RetrieverAgent:
    def __init__(self):
        self.name = "Chat Retriever"
        self._retriever = VectorRetriever()
        agent_logger.info(f"{self.name} initialized")

    def retrieve(
        self,
        query: str,
        doc_ids: Optional[List[str]] = None,
        top_k: int = 5,
    ) -> dict:
        agent_logger.info(f"{self.name}: retrieve query='{query[:80]}'")
        result = self._retriever.search_multi_doc(query=query, doc_ids=doc_ids, top_k=top_k)
        if result["status"] == "error":
            return result
        return {
            "status": "success",
            "chunks": result["chunks"],
            "sources": result["sources"],
            "retrieval_items": result.get("retrieval_items", []),
            "searched_docs": result.get("searched_docs", []),
            "num_results": result["num_results"],
        }
