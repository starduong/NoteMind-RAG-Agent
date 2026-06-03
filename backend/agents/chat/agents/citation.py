"""Chat Citation Agent — attach source references to answers."""
from typing import List

from agents.shared.prompts import CITATION_PROMPT
from config import LLM_CITATION_MODEL, LLM_CITATION_PROVIDER
from utils.llm_client import generate_text
from utils.logger import agent_logger


class CitationAgent:
    def __init__(self):
        self.name = "Chat Citation"
        agent_logger.info(f"{self.name} initialized")

    def cite(self, answer: str, sources: List[str]) -> dict:
        agent_logger.info(f"{self.name}: citing {len(sources)} source(s)")

        unique = list(dict.fromkeys(sources))
        if not unique:
            return {
                "status": "success",
                "final_answer": answer,
                "citations": [],
            }

        prompt = CITATION_PROMPT.format(
            answer=answer,
            sources=", ".join(unique),
        )
        try:
            final_answer = generate_text(
                prompt,
                model=LLM_CITATION_MODEL,
                provider=LLM_CITATION_PROVIDER,
                temperature=0.1,
            )
            citations = [{"source": s, "type": "document"} for s in unique]
            return {
                "status": "success",
                "final_answer": final_answer,
                "citations": citations,
            }
        except Exception as e:
            agent_logger.error(f"{self.name}: {e}", exc_info=True)
            citations = [{"source": s, "type": "document"} for s in unique]
            footer = "\n\n## Sources\n" + "\n".join(f"- {s}" for s in unique)
            return {
                "status": "warning",
                "final_answer": answer + footer,
                "citations": citations,
            }
