"""Scheduler Agent — generate daily learning plan from syllabus."""
import json
from datetime import date, timedelta
from agents.shared.prompts import SCHEDULER_PROMPT
from config import LLM_PLANNER_MODEL, LLM_PLANNER_PROVIDER
from utils.llm_client import generate_text
from utils.logger import agent_logger


class SchedulerAgent:
    def __init__(self):
        self.name = "Scheduler Agent"
        agent_logger.info(f"{self.name} initialized")

    def schedule(
        self,
        syllabus: dict,
        knowledge_graph: dict,
        learner_profile: dict,
    ) -> dict:
        agent_logger.info(f"{self.name}: creating daily schedule")
        hours_per_day = learner_profile.get("hours_per_day", 2.0)
        preference = learner_profile.get("preference", "mixed")
        start_date = learner_profile.get("start_date", date.today().isoformat())

        try:
            raw = generate_text(
                SCHEDULER_PROMPT.format(
                    syllabus=json.dumps(syllabus, ensure_ascii=False, indent=2),
                    knowledge_graph=json.dumps(knowledge_graph, ensure_ascii=False, indent=2),
                    hours_per_day=hours_per_day,
                    preference=preference,
                    start_date=start_date,
                ),
                model=LLM_PLANNER_MODEL,
                provider=LLM_PLANNER_PROVIDER,
                temperature=0.2,
            )
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            schedule_data = json.loads(raw.strip())
            agent_logger.info(
                f"{self.name}: scheduled {schedule_data.get('total_days', 0)} days"
            )
            return {"status": "success", "schedule": schedule_data}
        except json.JSONDecodeError as e:
            agent_logger.warning(f"{self.name}: JSON parse failed, using fallback. Error: {e}")
            return {"status": "fallback", "schedule": self._build_fallback_schedule(syllabus, start_date, hours_per_day)}
        except Exception as e:
            agent_logger.error(f"{self.name}: {e}", exc_info=True)
            return {"status": "error", "message": str(e), "schedule": None}

    def _build_fallback_schedule(self, syllabus: dict, start_date: str, hours_per_day: float) -> dict:
        """Build a simple schedule from syllabus without LLM."""
        milestones = syllabus.get("milestones", [])
        schedule = []
        day_num = 1
        try:
            current_date = date.fromisoformat(start_date)
        except Exception:
            current_date = date.today()

        for milestone in milestones:
            est_days = milestone.get("estimated_days", 3)
            for d in range(est_days):
                schedule.append({
                    "day": day_num,
                    "date": current_date.isoformat(),
                    "milestone_id": milestone["id"],
                    "milestone_title": milestone["title"],
                    "title": f"Day {day_num}: {milestone['title']}",
                    "activities": [
                        {
                            "type": "theory",
                            "topic": milestone["title"],
                            "description": milestone.get("description", "Study the material"),
                            "duration_minutes": int(hours_per_day * 60),
                        }
                    ],
                    "total_hours": hours_per_day,
                    "day_summary": f"Focus on {milestone['title']}",
                })
                day_num += 1
                current_date += timedelta(days=1)

        return {
            "schedule": schedule,
            "total_days": len(schedule),
            "total_hours": len(schedule) * hours_per_day,
        }
