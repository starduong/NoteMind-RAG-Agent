"""Quiz Generator Agent — create questions and answers from source content."""
from agents.shared.prompts import QUIZ_GENERATOR_PROMPT
from config import LLM_QUIZ_GEN_MODEL, LLM_QUIZ_GEN_PROVIDER
from utils.llm_client import generate_text
from utils.logger import agent_logger


class QuizGeneratorAgent:
    def __init__(self):
        self.name = "Quiz Generator"
        agent_logger.info(f"{self.name} initialized")

    def generate(self, context: str, query: str) -> dict:
        agent_logger.info(f"{self.name}: generating quiz")
        try:
            draft = generate_text(
                QUIZ_GENERATOR_PROMPT.format(
                    context=context,
                    query=query or "Create a quiz on the main topics",
                ),
                model=LLM_QUIZ_GEN_MODEL,
                provider=LLM_QUIZ_GEN_PROVIDER,
                temperature=0.4,
                response_format={"type": "json_object"},
            )
            return {"status": "success", "draft": draft}
        except Exception as e:
            agent_logger.error(f"{self.name}: {e}", exc_info=True)
            return {"status": "error", "message": str(e), "draft": ""}
