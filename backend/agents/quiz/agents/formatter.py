"""Quiz Formatter Agent — standardize quiz output format."""
from utils.logger import agent_logger


class QuizFormatterAgent:
    def __init__(self):
        self.name = "Quiz Formatter"
        agent_logger.info(f"{self.name} initialized")

    def format(self, reviewed: str, source_count: int) -> dict:
        agent_logger.info(f"{self.name}: formatting quiz")
        formatted = (
            f"```json\n{reviewed.strip()}\n```\n\n"
            f"*Generated from {source_count} source(s) in this notebook.*"
        )
        return {"status": "success", "formatted": formatted}
