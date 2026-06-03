"""Chat Answer Agent — generate grounded answer with inline citations."""

import re
from typing import Dict, List

from config import LLM_ANSWER_MODEL, LLM_ANSWER_PROVIDER
from utils.llm_client import chat_complete
from utils.logger import agent_logger


class AnswerAgent:
    def __init__(self):
        self.name = "Chat Answer"
        agent_logger.info(f"{self.name} initialized")

    def _build_context(self, retrieval_items: List[Dict]) -> str:
        blocks = []
        for item in retrieval_items:
            citation_id = item.get("citation_id", "?")
            source_name = item.get("source_name", "unknown")
            chunk_text = item.get("chunk_text", "").strip()
            blocks.append(f"[Chunk {citation_id}] Source: {source_name}\n{chunk_text}")
        return "\n\n".join(blocks)

    def _sanitize_answer(self, answer: str, valid_citation_ids: set[str]) -> str:
        def replacer(match: re.Match[str]) -> str:
            citation_id = match.group(1)
            return match.group(0) if citation_id in valid_citation_ids else ""

        cleaned = re.sub(r"\[([A-Z]+)\]", replacer, answer or "")
        cleaned = re.sub(r"[ \t]+\n", "\n", cleaned)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        return cleaned.strip()

    def _extract_text_span(self, answer: str, citation_start: int) -> str:
        prefix = answer[:citation_start].rstrip()
        span_start = max(prefix.rfind("."), prefix.rfind("\n"), prefix.rfind("!"), prefix.rfind("?"))
        text_span = prefix[span_start + 1 :].strip()
        if not text_span:
            text_span = prefix[-120:].strip()
        return text_span[-160:]

    def _build_citations(self, answer: str, retrieval_items: List[Dict]) -> List[Dict]:
        item_by_citation_id = {
            str(item.get("citation_id")): item
            for item in retrieval_items
            if item.get("citation_id")
        }
        citations: List[Dict] = []
        for match in re.finditer(r"\[([A-Z]+)\]", answer):
            citation_id = match.group(1)
            item = item_by_citation_id.get(citation_id)
            if not item:
                continue
            citations.append(
                {
                    "citation_id": citation_id,
                    "chunk_id": item.get("chunk_id", ""),
                    "source_name": item.get("source_name", "unknown"),
                    "text_span": self._extract_text_span(answer, match.start()),
                    "start_index": match.start(),
                    "end_index": match.end(),
                    "chunk_text": item.get("chunk_text", ""),
                }
            )
        return citations

    def answer(
        self,
        query: str,
        retrieval_items: List[Dict],
        conversation_context: str = "",
    ) -> dict:
        agent_logger.info(f"{self.name}: answer query='{query[:80]}'")

        if not retrieval_items:
            return {"status": "error", "message": "No context to answer from", "answer": ""}

        valid_citation_ids = {
            str(item.get("citation_id"))
            for item in retrieval_items
            if item.get("citation_id")
        }
        context = self._build_context(retrieval_items)
        conversation_prefix = f"{conversation_context}\n\n" if conversation_context else ""

        prompt = f"""{conversation_prefix}Answer ONLY using the context below.

Context:
{context}

Question: {query}

Rules:
1. Use only information from the provided context.
2. Cite factual claims inline using only these citation IDs: {", ".join(sorted(valid_citation_ids))}.
3. Never invent citation IDs or sources.
4. If the answer is not in the context, say "This information is not found in the document."
5. Keep citations inline, for example: "YOLOv8 is faster [A]."

Your answer:"""

        try:
            content, _usage = chat_complete(
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a document Q&A assistant. "
                            "Answer only from the provided context and cite claims inline."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                model=LLM_ANSWER_MODEL,
                provider=LLM_ANSWER_PROVIDER,
                temperature=0.1,
            )
            sanitized_answer = self._sanitize_answer(content, valid_citation_ids)
            citations = self._build_citations(sanitized_answer, retrieval_items)
            return {
                "status": "success",
                "answer": sanitized_answer,
                "citations": citations,
            }
        except Exception as e:
            agent_logger.error(f"{self.name}: {e}", exc_info=True)
            return {"status": "error", "message": str(e), "answer": ""}
