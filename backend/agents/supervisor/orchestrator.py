"""
Supervisor orchestrators — notebook routing + legacy API compatibility.
"""
from typing import Any, Dict, List, Optional

from agents.research.graph import get_workflow_visualization, research_graph
from agents.shared.state import NotebookState, ResearchState, create_initial_state
from agents.supervisor.routing import normalize_mode
from agents.supervisor.workflow_factory import get_workflow
from db.notebook_store import notebook_store


class NotebookOrchestrator:
    """Routes notebook actions to capability workflows."""

    def process(
        self,
        notebook_id: str,
        user_query: str,
        mode: str = "chat",
        top_k: int = 5,
        conversation_context: str = "",
        conversation_messages: Optional[List[Dict[str, Any]]] = None,
        conversation_summary: str = "",
        recent_messages: Optional[List[Dict[str, Any]]] = None,
        doc_ids: Optional[List[str]] = None,
    ) -> dict:
        notebook = notebook_store.get_notebook(notebook_id)
        if not notebook:
            return {"status": "error", "answer": "Notebook not found", "workflow_log": []}

        notebook_doc_ids = notebook.get("sources", [])
        if not notebook_doc_ids:
            return {
                "status": "error",
                "answer": "This notebook has no sources. Upload documents first.",
                "workflow_log": [],
            }

        effective_doc_ids = doc_ids if doc_ids else notebook_doc_ids
        normalized_mode = normalize_mode(mode)

        state = create_initial_state(
            notebook_id=notebook_id,
            user_query=user_query,
            mode=normalized_mode,
            doc_ids=effective_doc_ids,
            top_k=top_k,
            conversation_context=conversation_context,
        )
        state["conversation_messages"] = conversation_messages or []
        state["conversation_summary"] = conversation_summary
        state["recent_messages"] = recent_messages or []

        try:
            final_state: NotebookState = get_workflow(normalized_mode)(state)

            if final_state.get("status") == "error":
                return {
                    "status": "error",
                    "answer": final_state.get("error_message", "Workflow failed"),
                    "workflow_log": final_state.get("workflow_log", []),
                    "mode": normalized_mode,
                    "notebook_id": notebook_id,
                }

            return {
                "status": "success",
                "answer": final_state.get("final_answer", ""),
                "sources": final_state.get("sources", []),
                "citations": final_state.get("citations", []),
                "workflow_log": final_state.get("workflow_log", []),
                "metadata": {
                    "mode": normalized_mode,
                    "notebook_id": notebook_id,
                    "num_chunks": final_state.get("num_chunks_found", 0),
                    "searched_docs": final_state.get("searched_docs", []),
                    "rewritten_query": final_state.get("rewritten_query", user_query),
                    "intent": final_state.get("query_intent", "factual_query"),
                    "result": final_state.get("result", {}),
                },
                "mode": normalized_mode,
                "notebook_id": notebook_id,
            }
        except Exception as e:
            return {
                "status": "error",
                "answer": f"Error running {normalized_mode} workflow: {str(e)}",
                "workflow_log": [],
                "mode": normalized_mode,
                "notebook_id": notebook_id,
            }


class LegacyOrchestrator:
    """Legacy /ask-agents and /ask-v2 endpoints using research graph."""

    def __init__(self):
        self.workflow = research_graph

    def _base_state(
        self,
        query: str,
        top_k: int,
        conversation_context: str,
        source: Optional[str] = None,
        doc_ids: Optional[List[str]] = None,
        use_multi_doc: bool = False,
    ) -> ResearchState:
        return ResearchState(
            query=query,
            top_k=top_k,
            source=source,
            doc_ids=doc_ids,
            use_multi_doc=use_multi_doc,
            conversation_context=conversation_context,
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
            workflow_log=[],
            status="initialized",
            error_message=None,
            research_complete=False,
            summary_complete=False,
            critique_complete=False,
            editor_complete=False,
        )

    def process_query(
        self,
        query: str,
        top_k: int = 5,
        source: str = None,
        conversation_context: str = "",
    ) -> dict:
        return self._invoke(
            self._base_state(query, top_k, conversation_context, source=source, use_multi_doc=False)
        )

    def process_query_multi_doc(
        self,
        query: str,
        doc_ids: Optional[List[str]] = None,
        top_k: int = 5,
        conversation_context: str = "",
    ) -> dict:
        state = self._base_state(
            query, top_k, conversation_context, doc_ids=doc_ids, use_multi_doc=True
        )
        result = self._invoke(state)
        if "searched_docs" not in result and result.get("status") == "success":
            pass
        return result

    def _invoke(self, initial_state: ResearchState) -> dict:
        try:
            final_state = self.workflow.invoke(initial_state)
            if final_state.get("status") == "error":
                return {
                    "status": "error",
                    "answer": final_state.get("error_message", "Unknown error"),
                    "workflow_log": final_state.get("workflow_log", []),
                    "searched_docs": final_state.get("searched_docs", []),
                }
            return {
                "status": "success",
                "answer": final_state["final_answer"],
                "sources": final_state.get("sources", []),
                "searched_docs": final_state.get("searched_docs", []),
                "workflow_log": final_state.get("workflow_log", []),
                "metadata": {
                    "num_chunks": final_state.get("num_chunks_found", 0),
                    "editing_applied": final_state.get("editing_applied", False),
                    "has_gaps": final_state.get("has_gaps", False),
                },
            }
        except Exception as e:
            return {
                "status": "error",
                "answer": f"Error in research workflow: {str(e)}",
                "workflow_log": [],
            }

    def get_workflow_diagram(self) -> str:
        return get_workflow_visualization()


notebook_orchestrator = NotebookOrchestrator()
legacy_orchestrator = LegacyOrchestrator()
# Backward-compatible alias for main.py
Orchestrator = LegacyOrchestrator
