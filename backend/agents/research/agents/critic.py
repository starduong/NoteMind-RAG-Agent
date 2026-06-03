"""Research Critic Agent — evaluate quality and find gaps."""

from config import LLM_CRITIC_MODEL, LLM_CRITIC_PROVIDER
from utils.llm_client import chat_complete
from utils.logger import agent_logger


class CriticAgent:
    def __init__(self):
        self.name = "Research Critic"
        agent_logger.info(f"{self.name} initialized")

    def critique(self, query: str, summary: str, chunks: list[str]) -> dict:
        agent_logger.info(f"{self.name}: critique query='{query[:80]}'")

        if not summary:
            return {
                "status": "error",
                "message": "No summary to critique",
                "critique": "",
                "suggestions": [],
            }

        context = "\n\n---\n\n".join(chunks[:3])
        prompt = f"""Evaluate this research summary against the source context.

Question: {query}

Summary:
{summary}

Context:
{context}

Respond with:
STRENGTHS: ...
GAPS: ...
SUGGESTIONS: ..."""

        try:
            critique, _usage = chat_complete(
                messages=[
                    {"role": "system", "content": "You are a rigorous research quality reviewer."},
                    {"role": "user", "content": prompt},
                ],
                model=LLM_CRITIC_MODEL,
                provider=LLM_CRITIC_PROVIDER,
                temperature=0.4,
            )

            suggestions = []
            if "SUGGESTIONS:" in critique:
                suggestions_text = critique.split("SUGGESTIONS:")[-1].strip()
                suggestions = [
                    s.strip()
                    for s in suggestions_text.split("\n")
                    if s.strip() and not s.startswith("STRENGTHS") and not s.startswith("GAPS")
                ]

            has_gaps = "GAPS:" in critique and len(critique.split("GAPS:")[-1].strip()) > 10

            return {
                "status": "success",
                "critique": critique,
                "suggestions": suggestions[:5],
                "has_gaps": has_gaps,
            }
        except Exception as e:
            agent_logger.error(f"{self.name}: {e}", exc_info=True)
            return {
                "status": "error",
                "message": str(e),
                "critique": "",
                "suggestions": [],
            }
