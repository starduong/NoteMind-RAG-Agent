"""Roadmap Formatter Agent — standardize roadmap output."""
from typing import List

from utils.logger import agent_logger


class RoadmapFormatterAgent:
    def __init__(self):
        self.name = "Roadmap Formatter"
        agent_logger.info(f"{self.name} initialized")

    def format(self, reviewed: str, sources: List[str]) -> dict:
        agent_logger.info(f"{self.name}: formatting roadmap")
        source_list = "\n".join(f"- {s}" for s in sources) if sources else "- Notebook sources"
        formatted = (
            f"# Learning Roadmap\n\n{reviewed.strip()}\n\n"
            f"## Notebook Sources\n{source_list}"
        )
        return {"status": "success", "formatted": formatted}
