"""Roadmap Planner Agent — build learning/implementation phases."""
from agents.shared.prompts import ROADMAP_PLANNER_PROMPT
from config import LLM_PLANNER_MODEL, LLM_PLANNER_PROVIDER
from utils.llm_client import generate_text
from utils.logger import agent_logger


class RoadmapPlannerAgent:
    def __init__(self):
        self.name = "Roadmap Planner"
        agent_logger.info(f"{self.name} initialized")

    def plan(self, context: str, query: str) -> dict:
        agent_logger.info(f"{self.name}: planning roadmap")
        try:
            roadmap = generate_text(
                ROADMAP_PLANNER_PROMPT.format(context=context, query=query),
                model=LLM_PLANNER_MODEL,
                provider=LLM_PLANNER_PROVIDER,
                temperature=0.3,
            )
            return {"status": "success", "roadmap": roadmap}
        except Exception as e:
            agent_logger.error(f"{self.name}: {e}", exc_info=True)
            return {"status": "error", "message": str(e), "roadmap": ""}
