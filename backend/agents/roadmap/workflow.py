"""
Roadmap workflow: Planner → Resource → Reviewer → Formatter
"""
from agents.chat.agents.retriever import RetrieverAgent
from agents.roadmap.agents import (
    RoadmapFormatterAgent,
    RoadmapPlannerAgent,
    RoadmapResourceAgent,
    RoadmapReviewerAgent,
)
from agents.shared.state import NotebookState

_retriever = RetrieverAgent()
_planner = RoadmapPlannerAgent()
_resource = RoadmapResourceAgent()
_reviewer = RoadmapReviewerAgent()
_formatter = RoadmapFormatterAgent()


def run_roadmap_workflow(state: NotebookState) -> NotebookState:
    log = list(state.get("workflow_log", []))
    log.append("[Roadmap] Retrieving relevant content...")

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
    plan = _planner.plan(context, state["user_query"])
    if plan["status"] == "error":
        return {**state, "status": "error", "error_message": plan["message"], "workflow_log": log}

    log.append("[Roadmap] Resource: adding recommendations...")
    res = _resource.enrich(context, plan["roadmap"])

    log.append("[Roadmap] Reviewer: checking logic...")
    rev = _reviewer.review(context, res["roadmap"])

    log.append("[Roadmap] Formatter: finalizing...")
    fmt = _formatter.format(rev["reviewed"], sources)
    log.append("[Roadmap] Complete")

    return {
        **state,
        "chunks": retrieval["chunks"],
        "sources": retrieval["sources"],
        "retrieved_context": retrieval["chunks"],
        "final_answer": fmt["formatted"],
        "result": {"mode": "roadmap"},
        "workflow_log": log,
        "status": "complete",
    }
