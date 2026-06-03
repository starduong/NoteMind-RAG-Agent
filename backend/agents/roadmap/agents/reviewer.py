"""Roadmap Reviewer Agent — validate logic and grounding."""
from agents.shared.prompts import ROADMAP_REVIEWER_PROMPT
from config import LLM_ROADMAP_REVIEW_MODEL, LLM_ROADMAP_REVIEW_PROVIDER
from utils.llm_client import generate_text
from utils.logger import agent_logger


class RoadmapReviewerAgent:
    def __init__(self):
        self.name = "Roadmap Reviewer"
        agent_logger.info(f"{self.name} initialized")

    def review(self, context: str, roadmap: str) -> dict:
        agent_logger.info(f"{self.name}: reviewing roadmap")
        try:
            reviewed = generate_text(
                ROADMAP_REVIEWER_PROMPT.format(context=context[:4000], roadmap=roadmap),
                model=LLM_ROADMAP_REVIEW_MODEL,
                provider=LLM_ROADMAP_REVIEW_PROVIDER,
                temperature=0.2,
            )
            return {"status": "success", "reviewed": reviewed}
        except Exception as e:
            agent_logger.error(f"{self.name}: {e}", exc_info=True)
            return {"status": "warning", "reviewed": roadmap, "message": str(e)}
