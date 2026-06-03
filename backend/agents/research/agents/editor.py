"""Research Editor Agent — polish final research report."""

from config import LLM_EDITOR_MODEL, LLM_EDITOR_PROVIDER
from utils.llm_client import chat_complete
from utils.logger import agent_logger


class EditorAgent:
    def __init__(self):
        self.name = "Research Editor"
        agent_logger.info(f"{self.name} initialized")

    def edit(self, query: str, summary: str, critique: str, chunks: list[str]) -> dict:
        agent_logger.info(f"{self.name}: edit query='{query[:80]}'")

        if not summary:
            return {"status": "error", "message": "No summary to edit", "final_answer": ""}

        context = "\n\n---\n\n".join(chunks)
        prompt = f"""Refine this research report using ONLY the document context.

Question: {query}

Draft:
{summary}

Reviewer feedback:
{critique}

Document context:
{context}

Provide the polished final report (context-only):"""

        try:
            final_answer, _usage = chat_complete(
                messages=[
                    {"role": "system", "content": "You are an expert research editor."},
                    {"role": "user", "content": prompt},
                ],
                model=LLM_EDITOR_MODEL,
                provider=LLM_EDITOR_PROVIDER,
                temperature=0.3,
            )
            return {"status": "success", "final_answer": final_answer, "editing_applied": True}
        except Exception as e:
            agent_logger.error(f"{self.name}: {e}", exc_info=True)
            return {
                "status": "warning",
                "message": str(e),
                "final_answer": summary,
                "editing_applied": False,
            }
