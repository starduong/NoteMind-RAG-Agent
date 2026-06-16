"""Assessment Agent — profile the learner against the knowledge graph."""
import json
from datetime import date
from agents.shared.prompts import ASSESSMENT_PROMPT
from config import LLM_PLANNER_MODEL, LLM_PLANNER_PROVIDER
from utils.llm_client import generate_text
from utils.logger import agent_logger


class AssessmentAgent:
    def __init__(self):
        self.name = "Assessment Agent"
        agent_logger.info(f"{self.name} initialized")

    def assess(self, knowledge_graph: dict, learner_profile: dict) -> dict:
        agent_logger.info(f"{self.name}: profiling learner")
        try:
            goal = learner_profile.get("goal", "General learning")
            level = learner_profile.get("level", "beginner")
            hours = learner_profile.get("hours_per_day", 2.0)
            preference = learner_profile.get("preference", "mixed")

            raw = generate_text(
                ASSESSMENT_PROMPT.format(
                    goal=goal,
                    level=level,
                    hours_per_day=hours,
                    preference=preference,
                    knowledge_graph=json.dumps(knowledge_graph, ensure_ascii=False, indent=2),
                ),
                model=LLM_PLANNER_MODEL,
                provider=LLM_PLANNER_PROVIDER,
                temperature=0.3,
            )
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            assessment = json.loads(raw.strip())
            agent_logger.info(
                f"{self.name}: {len(assessment.get('gap_concepts', []))} gaps identified"
            )
            # Attach start_date if provided
            if not learner_profile.get("start_date"):
                assessment["start_date"] = date.today().isoformat()
            else:
                assessment["start_date"] = learner_profile["start_date"]
            return {"status": "success", "assessment": assessment}
        except json.JSONDecodeError as e:
            agent_logger.warning(f"{self.name}: JSON parse failed, using fallback. Error: {e}")
            concepts = knowledge_graph.get("concepts", [])
            concept_ids = [c["id"] for c in concepts]
            return {
                "status": "fallback",
                "assessment": {
                    "known_concepts": [],
                    "gap_concepts": concept_ids,
                    "priority_concepts": concept_ids,
                    "total_estimated_hours": len(concepts) * 2,
                    "recommended_pace": f"{learner_profile.get('hours_per_day', 2)} hours/day",
                    "personalization_notes": "Personalized based on provided profile",
                    "start_date": learner_profile.get("start_date", date.today().isoformat()),
                }
            }
        except Exception as e:
            agent_logger.error(f"{self.name}: {e}", exc_info=True)
            return {"status": "error", "message": str(e), "assessment": None}
