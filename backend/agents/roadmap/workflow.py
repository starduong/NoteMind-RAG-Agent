"""
Multi-Agent Roadmap Workflow (5-agent pipeline):
  ContentAnalyzer → Assessment → SyllabusArchitect → Scheduler → ResourceQuiz → Formatter

Falls back to legacy 3-agent flow if learner_profile is not provided.
"""
from datetime import date

from agents.chat.agents.retriever import RetrieverAgent
from agents.roadmap.agents import (
    ContentAnalyzerAgent,
    AssessmentAgent,
    SyllabusArchitectAgent,
    SchedulerAgent,
    ResourceQuizAgent,
    RoadmapFormatterAgent,
    # Legacy
    RoadmapPlannerAgent,
    RoadmapReviewerAgent,
)
from agents.shared.state import NotebookState
from utils.ics_generator import generate_ics
from utils.logger import agent_logger

_retriever = RetrieverAgent()
_content_analyzer = ContentAnalyzerAgent()
_assessment = AssessmentAgent()
_syllabus_architect = SyllabusArchitectAgent()
_scheduler = SchedulerAgent()
_resource_quiz = ResourceQuizAgent()
_formatter = RoadmapFormatterAgent()

# Legacy agents
_legacy_planner = RoadmapPlannerAgent()
_legacy_reviewer = RoadmapReviewerAgent()


def run_roadmap_workflow(state: NotebookState) -> NotebookState:
    """
    Run the full 5-agent roadmap workflow.
    If learner_profile is provided, uses the new multi-agent pipeline.
    Otherwise falls back to the legacy simple pipeline.
    """
    learner_profile = state.get("learner_profile")

    if learner_profile:
        return _run_multi_agent_pipeline(state, learner_profile)
    else:
        return _run_legacy_pipeline(state)


def _run_multi_agent_pipeline(state: NotebookState, learner_profile: dict) -> NotebookState:
    """Full 5-agent personalized roadmap generation."""
    log = list(state.get("workflow_log", []))

    # ── Step 1: Retrieve content ──────────────────────────────────────────────
    log.append("[Roadmap] Step 1/5: Retrieving document content...")
    retrieval = _retriever.retrieve(
        query=state["user_query"],
        doc_ids=state.get("doc_ids"),
        top_k=max(state.get("top_k", 5), 12),
    )

    if retrieval["status"] == "error" or not retrieval["chunks"]:
        msg = retrieval.get("message", "No content available for roadmap")
        return {**state, "status": "error", "error_message": msg, "workflow_log": log}

    context = "\n\n---\n\n".join(retrieval["chunks"][:15])
    sources = list(dict.fromkeys(retrieval["sources"]))

    # ── Step 2: Content Analyzer ──────────────────────────────────────────────
    log.append("[Roadmap] Step 2/5: Content Analyzer — extracting knowledge graph...")
    ca_result = _content_analyzer.analyze(context)
    if ca_result["status"] == "error":
        agent_logger.warning("Content Analyzer failed, using empty graph")
        knowledge_graph = {"concepts": [], "relationships": []}
    else:
        knowledge_graph = ca_result["knowledge_graph"]
    log.append(f"[Roadmap] → {len(knowledge_graph.get('concepts', []))} concepts extracted")

    # ── Step 3: Assessment Agent ──────────────────────────────────────────────
    log.append("[Roadmap] Step 3/5: Assessment — profiling learner...")
    # Ensure start_date is set
    if not learner_profile.get("start_date"):
        learner_profile = {**learner_profile, "start_date": date.today().isoformat()}

    assess_result = _assessment.assess(knowledge_graph, learner_profile)
    if assess_result["status"] == "error":
        agent_logger.warning("Assessment failed, using default assessment")
        assessment = {
            "known_concepts": [],
            "gap_concepts": [c["id"] for c in knowledge_graph.get("concepts", [])],
            "priority_concepts": [c["id"] for c in knowledge_graph.get("concepts", [])],
            "total_estimated_hours": 20,
            "recommended_pace": "2 hours/day",
            "personalization_notes": "",
            "start_date": learner_profile.get("start_date", date.today().isoformat()),
        }
    else:
        assessment = assess_result["assessment"]
    log.append(f"[Roadmap] → {len(assessment.get('gap_concepts', []))} knowledge gaps identified")

    # ── Step 4: Syllabus Architect ────────────────────────────────────────────
    log.append("[Roadmap] Step 4/5: Syllabus Architect — designing curriculum...")
    goal = learner_profile.get("goal", state["user_query"])
    syllabus_result = _syllabus_architect.build_syllabus(knowledge_graph, assessment, goal)
    if syllabus_result["status"] == "error":
        return {**state, "status": "error", "error_message": syllabus_result.get("message"), "workflow_log": log}
    syllabus = syllabus_result["syllabus"]
    log.append(f"[Roadmap] → {len(syllabus.get('milestones', []))} milestones designed")

    # ── Step 5: Scheduler Agent ────────────────────────────────────────────────
    log.append("[Roadmap] Step 5/5a: Scheduler — creating daily plan...")
    schedule_result = _scheduler.schedule(syllabus, knowledge_graph, learner_profile)
    if schedule_result["status"] == "error":
        agent_logger.warning("Scheduler failed, building fallback schedule")
        schedule_data = _scheduler._build_fallback_schedule(
            syllabus,
            learner_profile.get("start_date", date.today().isoformat()),
            float(learner_profile.get("hours_per_day", 2.0)),
        )
    else:
        schedule_data = schedule_result["schedule"]
    log.append(f"[Roadmap] → {schedule_data.get('total_days', 0)} days scheduled")

    # Generate iCalendar
    try:
        ics_content = generate_ics(
            schedule_data,
            calendar_name=f"NoteMind — {goal}",
        )
        log.append("[Roadmap] → iCalendar (.ics) generated")
    except Exception as e:
        agent_logger.warning(f"ICS generation failed: {e}")
        ics_content = ""

    # ── Step 6: Resource & Quiz Generator ────────────────────────────────────
    log.append("[Roadmap] Step 5/5b: Resource & Quiz Generator — enriching milestones...")
    enrich_result = _resource_quiz.enrich(context, syllabus)
    enriched_milestones = enrich_result.get("enriched_milestones", [])
    log.append(f"[Roadmap] → {len(enriched_milestones)} milestones enriched with resources & quizzes")

    # ── Final: Formatter ──────────────────────────────────────────────────────
    log.append("[Roadmap] Formatter: rendering final roadmap...")
    fmt_result = _formatter.format(schedule_data, enriched_milestones, sources)
    formatted = fmt_result.get("formatted", "")
    log.append("[Roadmap] Multi-Agent Pipeline Complete ✓")

    return {
        **state,
        "chunks": retrieval["chunks"],
        "sources": sources,
        "retrieved_context": retrieval["chunks"],
        "knowledge_graph": knowledge_graph,
        "assessment_result": assessment,
        "syllabus": syllabus,
        "daily_schedule": schedule_data,
        "enriched_milestones": enriched_milestones,
        "ics_content": ics_content,
        "final_answer": formatted,
        "result": {
            "mode": "roadmap",
            "pipeline": "multi-agent",
            "total_days": schedule_data.get("total_days", 0),
            "total_hours": schedule_data.get("total_hours", 0),
            "milestones_count": len(syllabus.get("milestones", [])),
            "has_ics": bool(ics_content),
            "schedule": schedule_data.get("schedule", []),
            "milestones": syllabus.get("milestones", []),
            "enriched_milestones": enriched_milestones,
            "knowledge_graph": knowledge_graph,
            "learner_profile": learner_profile,
        },
        "workflow_log": log,
        "status": "complete",
    }


def _run_legacy_pipeline(state: NotebookState) -> NotebookState:
    """Legacy 3-agent pipeline for backward compatibility (no learner_profile)."""
    log = list(state.get("workflow_log", []))
    log.append("[Roadmap] Running legacy pipeline (no learner profile)...")

    retrieval = _retriever.retrieve(
        query=state["user_query"],
        doc_ids=state.get("doc_ids"),
        top_k=max(state.get("top_k", 5), 8),
    )

    if retrieval["status"] == "error" or not retrieval["chunks"]:
        msg = retrieval.get("message", "No content available for roadmap")
        return {**state, "status": "error", "error_message": msg, "workflow_log": log}

    context = "\n\n---\n\n".join(retrieval["chunks"][:12])
    sources = list(dict.fromkeys(retrieval["sources"]))

    log.append("[Roadmap] Planner: building phases...")
    plan = _legacy_planner.plan(context, state["user_query"])
    if plan["status"] == "error":
        return {**state, "status": "error", "error_message": plan["message"], "workflow_log": log}

    log.append("[Roadmap] Reviewer: checking logic...")
    rev = _legacy_reviewer.review(context, plan["roadmap"])

    # Use the formatter with minimal data
    log.append("[Roadmap] Formatter: finalizing...")
    final_text = rev.get("reviewed", plan["roadmap"])
    if sources:
        final_text += f"\n\n## 📖 Nguồn Tài Liệu\n" + "\n".join(f"- {s}" for s in sources)

    log.append("[Roadmap] Legacy Pipeline Complete")

    return {
        **state,
        "chunks": retrieval["chunks"],
        "sources": sources,
        "retrieved_context": retrieval["chunks"],
        "final_answer": final_text,
        "result": {"mode": "roadmap", "pipeline": "legacy"},
        "workflow_log": log,
        "status": "complete",
    }
