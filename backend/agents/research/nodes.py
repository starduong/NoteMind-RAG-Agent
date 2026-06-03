"""LangGraph nodes for research capability."""
from agents.research.agents import CriticAgent, EditorAgent, ResearcherAgent, SummarizerAgent
from agents.shared.state import ResearchState

_researcher = ResearcherAgent()
_summarizer = SummarizerAgent()
_critic = CriticAgent()
_editor = EditorAgent()


def research_node(state: ResearchState) -> ResearchState:
    workflow_log = list(state.get("workflow_log", []))
    use_multi_doc = state.get("use_multi_doc", False)

    if use_multi_doc:
        workflow_log.append("[Research] Researcher: searching notebook sources...")
        result = _researcher.research(
            query=state["query"],
            doc_ids=state.get("doc_ids"),
            top_k=state.get("top_k", 5),
            use_multi_doc=True,
        )
    else:
        workflow_log.append("[Research] Researcher: searching FAISS index...")
        result = _researcher.research(
            query=state["query"],
            top_k=state.get("top_k", 5),
            source=state.get("source"),
            use_multi_doc=False,
        )

    if result["status"] == "error":
        return {
            **state,
            "status": "error",
            "error_message": result["message"],
            "workflow_log": workflow_log,
            "chunks": [],
            "sources": [],
            "searched_docs": [],
            "num_chunks_found": 0,
            "research_complete": False,
        }

    workflow_log.append(f"[Research] Researcher: found {len(result['chunks'])} chunks")
    return {
        **state,
        "chunks": result["chunks"],
        "sources": result["sources"],
        "searched_docs": result.get("searched_docs", []),
        "num_chunks_found": len(result["chunks"]),
        "workflow_log": workflow_log,
        "research_complete": True,
        "status": "research_complete",
    }


def summarizer_node(state: ResearchState) -> ResearchState:
    workflow_log = state.get("workflow_log", [])
    workflow_log.append("[Research] Summarizer: drafting report...")

    result = _summarizer.summarize(
        query=state["query"],
        chunks=state["chunks"],
        conversation_context=state.get("conversation_context", ""),
    )

    if result["status"] == "error":
        return {
            **state,
            "status": "error",
            "error_message": result["message"],
            "workflow_log": workflow_log,
            "initial_summary": "",
            "summary_complete": False,
        }

    workflow_log.append("[Research] Summarizer: draft complete")
    return {
        **state,
        "initial_summary": result["summary"],
        "workflow_log": workflow_log,
        "summary_complete": True,
        "status": "summary_complete",
    }


def critic_node(state: ResearchState) -> ResearchState:
    workflow_log = state.get("workflow_log", [])
    workflow_log.append("[Research] Critic: evaluating quality...")

    result = _critic.critique(
        query=state["query"],
        summary=state["initial_summary"],
        chunks=state["chunks"],
    )

    if result["status"] == "error":
        workflow_log.append("[Research] Critic: skipped (using draft)")
        return {
            **state,
            "critique": "Critique unavailable",
            "has_gaps": False,
            "suggestions": [],
            "workflow_log": workflow_log,
            "critique_complete": True,
            "status": "critique_complete",
        }

    has_gaps = result.get("has_gaps", False)
    workflow_log.append(f"[Research] Critic: gaps={has_gaps}")
    return {
        **state,
        "critique": result["critique"],
        "has_gaps": has_gaps,
        "suggestions": result.get("suggestions", []),
        "workflow_log": workflow_log,
        "critique_complete": True,
        "status": "critique_complete",
    }


def editor_node(state: ResearchState) -> ResearchState:
    workflow_log = state.get("workflow_log", [])
    workflow_log.append("[Research] Editor: polishing report...")

    result = _editor.edit(
        query=state["query"],
        summary=state["initial_summary"],
        critique=state["critique"],
        chunks=state["chunks"],
    )

    workflow_log.append("[Research] Editor: complete")
    return {
        **state,
        "final_answer": result.get("final_answer", state["initial_summary"]),
        "editing_applied": result.get("editing_applied", False),
        "workflow_log": workflow_log,
        "editor_complete": True,
        "status": "complete",
    }


def skip_editor_node(state: ResearchState) -> ResearchState:
    workflow_log = state.get("workflow_log", [])
    workflow_log.append("[Research] Editor: skipped (draft accepted)")
    return {
        **state,
        "final_answer": state["initial_summary"],
        "editing_applied": False,
        "workflow_log": workflow_log,
        "editor_complete": True,
        "status": "complete",
    }


def should_edit(state: ResearchState) -> str:
    return "edit" if state.get("has_gaps", False) else "skip_edit"
