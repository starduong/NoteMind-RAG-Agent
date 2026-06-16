"""
Supervisor orchestrators — notebook routing + legacy API compatibility.
"""
from typing import Any, Dict, List, Optional

from agents.shared.state import NotebookState, create_initial_state
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
        learner_profile: Optional[Dict[str, Any]] = None,
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
            learner_profile=learner_profile,
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
                "result": final_state.get("result", {}),
                "ics_content": final_state.get("ics_content", ""),
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
                "tools_data": final_state.get("tools_data"),
            }
        except Exception as e:
            return {
                "status": "error",
                "answer": f"Error running {normalized_mode} workflow: {str(e)}",
                "workflow_log": [],
                "mode": normalized_mode,
                "notebook_id": notebook_id,
            }


notebook_orchestrator = NotebookOrchestrator()
