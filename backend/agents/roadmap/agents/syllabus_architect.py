"""Syllabus Architect Agent — group concepts into milestones."""
import json
from agents.shared.prompts import SYLLABUS_ARCHITECT_PROMPT
from config import LLM_PLANNER_MODEL, LLM_PLANNER_PROVIDER
from utils.llm_client import generate_text
from utils.logger import agent_logger


class SyllabusArchitectAgent:
    def __init__(self):
        self.name = "Syllabus Architect"
        agent_logger.info(f"{self.name} initialized")

    def build_syllabus(self, knowledge_graph: dict, assessment: dict, goal: str) -> dict:
        agent_logger.info(f"{self.name}: building syllabus structure")
        try:
            raw = generate_text(
                SYLLABUS_ARCHITECT_PROMPT.format(
                    knowledge_graph=json.dumps(knowledge_graph, ensure_ascii=False, indent=2),
                    assessment=json.dumps(assessment, ensure_ascii=False, indent=2),
                    goal=goal,
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
            syllabus = json.loads(raw.strip())
            agent_logger.info(
                f"{self.name}: created {len(syllabus.get('milestones', []))} milestones"
            )
            return {"status": "success", "syllabus": syllabus}
        except json.JSONDecodeError as e:
            agent_logger.warning(f"{self.name}: JSON parse failed, using fallback. Error: {e}")
            concepts = knowledge_graph.get("concepts", [])
            # Build simple milestones grouping by difficulty
            groups = {"Foundation": [], "Core": [], "Advanced": []}
            for c in concepts:
                diff = c.get("difficulty", "intermediate")
                if diff == "beginner":
                    groups["Foundation"].append(c["id"])
                elif diff == "advanced":
                    groups["Advanced"].append(c["id"])
                else:
                    groups["Core"].append(c["id"])

            milestones = []
            phase_map = {"Foundation": "Foundation", "Core": "Core", "Advanced": "Advanced"}
            for idx, (phase, cids) in enumerate(groups.items()):
                if cids:
                    milestones.append({
                        "id": f"m{idx+1}",
                        "title": f"{phase} Phase",
                        "phase": phase_map[phase],
                        "description": f"Master {phase.lower()} concepts",
                        "concepts": cids,
                        "estimated_days": max(1, len(cids)),
                        "learning_objectives": [f"Understand {phase.lower()} topics"],
                        "has_quiz": True,
                    })
            return {"status": "fallback", "syllabus": {"milestones": milestones}}
        except Exception as e:
            agent_logger.error(f"{self.name}: {e}", exc_info=True)
            return {"status": "error", "message": str(e), "syllabus": None}
