"""Resource & Quiz Generator Agent — enrich milestones with resources and quizzes."""
import json
from agents.shared.prompts import RESOURCE_QUIZ_PROMPT
from config import LLM_PLANNER_MODEL, LLM_PLANNER_PROVIDER
from utils.llm_client import generate_text
from utils.logger import agent_logger


class ResourceQuizAgent:
    def __init__(self):
        self.name = "Resource & Quiz Generator"
        agent_logger.info(f"{self.name} initialized")

    def enrich(self, context: str, syllabus: dict) -> dict:
        """Enrich milestones with resources and quiz questions."""
        agent_logger.info(f"{self.name}: enriching milestones")
        try:
            raw = generate_text(
                RESOURCE_QUIZ_PROMPT.format(
                    syllabus=json.dumps(syllabus, ensure_ascii=False, indent=2),
                    context=context[:3000],  # Limit context size
                ),
                model=LLM_PLANNER_MODEL,
                provider=LLM_PLANNER_PROVIDER,
                temperature=0.4,
            )
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            enriched = json.loads(raw.strip())
            milestones = enriched.get("enriched_milestones", [])
            agent_logger.info(f"{self.name}: enriched {len(milestones)} milestones")
            return {"status": "success", "enriched_milestones": milestones}
        except json.JSONDecodeError as e:
            agent_logger.warning(f"{self.name}: JSON parse failed, using fallback. Error: {e}")
            # Build simple fallback enrichment
            milestones = syllabus.get("milestones", [])
            enriched = []
            for m in milestones:
                enriched.append({
                    "milestone_id": m["id"],
                    "resources": [
                        {
                            "title": f"Study Material for {m['title']}",
                            "type": "reading",
                            "description": m.get("description", "Core reading"),
                            "source": "From uploaded document",
                        }
                    ],
                    "quiz_questions": [
                        {
                            "question": f"What is the main objective of {m['title']}?",
                            "options": {
                                "A": m.get("description", "Core concepts"),
                                "B": "Not related",
                                "C": "Advanced topics only",
                                "D": "Prerequisites only",
                            },
                            "correct_answer": "A",
                            "explanation": "Based on milestone objectives",
                        }
                    ],
                    "practical_exercise": {
                        "title": f"Practice: {m['title']}",
                        "description": f"Apply what you learned in {m['title']}",
                        "expected_outcome": "Demonstrate understanding of core concepts",
                    },
                })
            return {"status": "fallback", "enriched_milestones": enriched}
        except Exception as e:
            agent_logger.error(f"{self.name}: {e}", exc_info=True)
            return {"status": "error", "message": str(e), "enriched_milestones": []}
