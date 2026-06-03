"""Research Summarizer Agent — synthesize research report from chunks."""

from config import LLM_SUMMARY_MODEL, LLM_SUMMARY_PROVIDER
from utils.llm_client import chat_complete
from utils.logger import agent_logger


class SummarizerAgent:
    def __init__(self):
        self.name = "Research Summarizer"
        agent_logger.info(f"{self.name} initialized")

    def summarize(self, query: str, chunks: list[str], conversation_context: str = "") -> dict:
        agent_logger.info(f"{self.name}: summarize for query='{query[:80]}'")

        if not chunks:
            return {"status": "error", "message": "No chunks to summarize", "summary": ""}

        context = "\n\n---\n\n".join(chunks)
        conversation_prefix = f"{conversation_context}\n\n" if conversation_context else ""

        prompt = f"""{conversation_prefix}You are a research assistant. Produce a structured research summary ONLY from the context.

Context:
{context}

Research question: {query}

Rules:
1. Use only information from the context
2. Organize with clear sections if the question is broad
3. State when information is missing from sources

Research summary:"""

        try:
            summary, _usage = chat_complete(
                messages=[
                    {
                        "role": "system",
                        "content": "You produce grounded research summaries from document context only.",
                    },
                    {"role": "user", "content": prompt},
                ],
                model=LLM_SUMMARY_MODEL,
                provider=LLM_SUMMARY_PROVIDER,
                temperature=0.2,
            )
            return {"status": "success", "summary": summary, "num_chunks_used": len(chunks)}
        except Exception as e:
            agent_logger.error(f"{self.name}: {e}", exc_info=True)
            return {"status": "error", "message": str(e), "summary": ""}
