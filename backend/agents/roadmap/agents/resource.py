"""Roadmap Resource Agent — suggest materials and activities per phase."""
from agents.shared.prompts import ROADMAP_RESOURCE_PROMPT
from config import LLM_ROADMAP_RESOURCE_MODEL, LLM_ROADMAP_RESOURCE_PROVIDER
from utils.llm_client import generate_text
from utils.logger import agent_logger


class RoadmapResourceAgent:
    def __init__(self):
        self.name = "Roadmap Resource"
        agent_logger.info(f"{self.name} initialized")

    def enrich(self, context: str, roadmap: str) -> dict:
        agent_logger.info(f"{self.name}: adding resources")
        try:
            enriched = generate_text(
                ROADMAP_RESOURCE_PROMPT.format(context=context[:5000], roadmap=roadmap),
                model=LLM_ROADMAP_RESOURCE_MODEL,
                provider=LLM_ROADMAP_RESOURCE_PROVIDER,
                temperature=0.3,
            )
            return {"status": "success", "roadmap": enriched}
        except Exception as e:
            agent_logger.error(f"{self.name}: {e}", exc_info=True)
            return {"status": "warning", "roadmap": roadmap, "message": str(e)}
