"""Research Researcher Agent — collect relevant information from documents."""
from typing import List, Optional

from agents.shared.retrieval import VectorRetriever
from utils.logger import agent_logger


class ResearcherAgent:
    def __init__(self):
        self.name = "Researcher"
        self._retriever = VectorRetriever()
        agent_logger.info(f"{self.name} initialized")

    def research(
        self,
        query: str,
        top_k: int = 5,
        source: Optional[str] = None,
        doc_ids: Optional[List[str]] = None,
        use_multi_doc: bool = False,
    ) -> dict:
        agent_logger.info(f"{self.name}: research query='{query[:80]}'")

        if use_multi_doc:
            return self._retriever.search_multi_doc(query=query, doc_ids=doc_ids, top_k=top_k)
        return self._retriever.search(query=query, top_k=top_k, source=source)
