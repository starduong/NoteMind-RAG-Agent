"""Quiz Reviewer Agent — validate accuracy and difficulty."""
from agents.shared.prompts import QUIZ_REVIEWER_PROMPT
from config import LLM_QUIZ_REVIEW_MODEL, LLM_QUIZ_REVIEW_PROVIDER
from utils.llm_client import generate_text
from utils.logger import agent_logger


class QuizReviewerAgent:
    def __init__(self):
        self.name = "Quiz Reviewer"
        agent_logger.info(f"{self.name} initialized")

    def review(self, context: str, draft: str) -> dict:
        agent_logger.info(f"{self.name}: reviewing quiz")
        try:
            reviewed = generate_text(
                QUIZ_REVIEWER_PROMPT.format(context=context[:4000], draft=draft),
                model=LLM_QUIZ_REVIEW_MODEL,
                provider=LLM_QUIZ_REVIEW_PROVIDER,
                temperature=0.2,
            )
            return {"status": "success", "reviewed": reviewed}
        except Exception as e:
            agent_logger.error(f"{self.name}: {e}", exc_info=True)
            return {"status": "warning", "reviewed": draft, "message": str(e)}
