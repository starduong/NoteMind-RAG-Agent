"""Roadmap Formatter Agent — convert structured data to Markdown output."""
import json
from agents.shared.prompts import ROADMAP_FORMATTER_PROMPT
from config import LLM_PLANNER_MODEL, LLM_PLANNER_PROVIDER
from utils.llm_client import generate_text
from utils.logger import agent_logger


class RoadmapFormatterAgent:
    def __init__(self):
        self.name = "Roadmap Formatter"
        agent_logger.info(f"{self.name} initialized")

    def format(
        self,
        schedule_data: dict,
        enriched_milestones: list,
        sources: list,
    ) -> dict:
        """Format the complete roadmap as structured Markdown."""
        agent_logger.info(f"{self.name}: formatting final roadmap")
        try:
            raw = generate_text(
                ROADMAP_FORMATTER_PROMPT.format(
                    schedule=json.dumps(schedule_data, ensure_ascii=False, indent=2),
                    enriched_milestones=json.dumps(enriched_milestones, ensure_ascii=False, indent=2),
                    sources=", ".join(sources) if sources else "No sources",
                ),
                model=LLM_PLANNER_MODEL,
                provider=LLM_PLANNER_PROVIDER,
                temperature=0.3,
            )
            agent_logger.info(f"{self.name}: formatting complete, {len(raw)} chars")
            return {"status": "success", "formatted": raw}
        except Exception as e:
            agent_logger.error(f"{self.name}: {e}", exc_info=True)
            # Fallback: build simple markdown from schedule data
            fallback = self._build_fallback_markdown(schedule_data, enriched_milestones, sources)
            return {"status": "fallback", "formatted": fallback}

    def _build_fallback_markdown(
        self, schedule_data: dict, enriched_milestones: list, sources: list
    ) -> str:
        """Build a minimal Markdown roadmap without LLM."""
        lines = ["# 🗺️ Lộ Trình Học Tập\n"]
        schedule = schedule_data.get("schedule", [])

        # Group by milestone
        milestone_days: dict = {}
        for day in schedule:
            mid = day.get("milestone_id", "m1")
            mtitle = day.get("milestone_title", "Milestone")
            if mid not in milestone_days:
                milestone_days[mid] = {"title": mtitle, "days": []}
            milestone_days[mid]["days"].append(day)

        # Enrichment lookup
        enrich_map = {e["milestone_id"]: e for e in enriched_milestones}

        for mid, data in milestone_days.items():
            lines.append(f"\n## {data['title']}\n")
            for day in data["days"]:
                lines.append(f"\n### Ngày {day['day']} — {day.get('day_summary', day['title'])}\n")
                for act in day.get("activities", []):
                    act_type = act.get("type", "theory").capitalize()
                    mins = act.get("duration_minutes", 60)
                    lines.append(f"- **{act_type}** ({mins} phút): {act.get('description', act.get('topic', ''))}")

            # Resources
            enrich = enrich_map.get(mid)
            if enrich:
                resources = enrich.get("resources", [])
                if resources:
                    lines.append("\n### 📚 Tài Liệu Tham Khảo\n")
                    for r in resources:
                        lines.append(f"- **{r['title']}** ({r.get('type', 'reading')}): {r.get('description', '')}")

                # Quiz
                quiz_qs = enrich.get("quiz_questions", [])
                if quiz_qs:
                    lines.append("\n### ✅ Kiểm Tra Kiến Thức\n")
                    for i, q in enumerate(quiz_qs, 1):
                        lines.append(f"{i}. {q['question']}")

        # Summary table
        total_days = schedule_data.get("total_days", len(schedule))
        total_hours = schedule_data.get("total_hours", total_days * 2)
        lines.append(f"\n---\n\n| Tổng số ngày | Tổng giờ học | Tài liệu |")
        lines.append(f"|---|---|---|")
        lines.append(f"| {total_days} ngày | {total_hours:.0f} giờ | {', '.join(sources) if sources else 'N/A'} |")

        if sources:
            lines.append("\n## 📖 Nguồn Tài Liệu\n")
            for s in sources:
                lines.append(f"- {s}")

        return "\n".join(lines)
