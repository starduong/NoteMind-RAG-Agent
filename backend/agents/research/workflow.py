"""
Research workflow — LangGraph: Researcher → Summarizer → Critic → Editor
"""
from agents.research.graph import research_graph
from agents.shared.state import NotebookState, ResearchState


def _to_research_state(state: NotebookState) -> ResearchState:
    return ResearchState(
        query=state["user_query"],
        top_k=state.get("top_k", 5),
        source=None,
        doc_ids=state.get("doc_ids"),
        use_multi_doc=True,
        conversation_context=state.get("conversation_context", ""),
        chunks=[],
        sources=[],
        num_chunks_found=0,
        initial_summary="",
        critique="",
        has_gaps=False,
        suggestions=[],
        final_answer="",
        editing_applied=False,
        searched_docs=[],
        workflow_log=list(state.get("workflow_log", [])),
        status="initialized",
        error_message=None,
        research_complete=False,
        summary_complete=False,
        critique_complete=False,
        editor_complete=False,
    )


def run_research_workflow(state: NotebookState) -> NotebookState:
    log = list(state.get("workflow_log", []))
    log.append("[Research] Starting multi-agent pipeline...")

    final = research_graph.invoke(_to_research_state({**state, "workflow_log": log}))

    if final.get("status") == "error":
        return {
            **state,
            "status": "error",
            "error_message": final.get("error_message", "Research workflow failed"),
            "workflow_log": final.get("workflow_log", log),
        }

    return {
        **state,
        "chunks": final.get("chunks", []),
        "sources": final.get("sources", []),
        "retrieved_context": final.get("chunks", []),
        "num_chunks_found": final.get("num_chunks_found", 0),
        "searched_docs": final.get("searched_docs", []),
        "initial_summary": final.get("initial_summary", ""),
        "critique": final.get("critique", ""),
        "has_gaps": final.get("has_gaps", False),
        "suggestions": final.get("suggestions", []),
        "editing_applied": final.get("editing_applied", False),
        "final_answer": final.get("final_answer", ""),
        "result": {
            "mode": "research",
            "has_gaps": final.get("has_gaps", False),
            "editing_applied": final.get("editing_applied", False),
        },
        "workflow_log": final.get("workflow_log", log),
        "status": "complete",
        "research_complete": final.get("research_complete", False),
        "summary_complete": final.get("summary_complete", False),
        "critique_complete": final.get("critique_complete", False),
        "editor_complete": final.get("editor_complete", False),
    }
