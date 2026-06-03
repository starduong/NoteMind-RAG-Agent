"""
Chat workflow: Intent Router → Query Rewrite → Retriever → Answer
"""
from agents.chat.agents import AnswerAgent, IntentRouter, QueryRewriteAgent, RetrieverAgent
from agents.shared.state import NotebookState

_router = IntentRouter()
_rewriter = QueryRewriteAgent()
_retriever = RetrieverAgent()
_answer = AnswerAgent()


def run_chat_workflow(state: NotebookState) -> NotebookState:
    log = list(state.get("workflow_log", []))
    route = _router.route(state.get("user_query", ""))
    log.append(f"[Chat] Intent Router: {route['intent']}")

    if not route.get("needs_retrieval", True):
        log.append("[Chat] Complete")
        return {
            **state,
            "status": "complete",
            "query_intent": route["intent"],
            "needs_retrieval": False,
            "final_answer": route.get("direct_answer", ""),
            "citations": [],
            "sources": [],
            "result": {"mode": "chat", "citations": [], "rewritten_query": state["user_query"]},
            "workflow_log": log,
        }

    log.append("[Chat] Rewriter: resolving conversational query...")
    rewrite = _rewriter.rewrite(
        query=state["user_query"],
        conversation_context=state.get("conversation_context", ""),
        recent_messages=state.get("recent_messages", []),
    )
    rewritten_query = rewrite.get("standalone_query", state["user_query"])
    log.append(f"[Chat] Rewriter: retrieval query ready")

    log.append("[Chat] Retriever: searching knowledge base...")

    retrieval = _retriever.retrieve(
        query=rewritten_query,
        doc_ids=state.get("doc_ids"),
        top_k=state.get("top_k", 5),
    )

    if retrieval["status"] == "error":
        return {
            **state,
            "status": "error",
            "error_message": retrieval.get("message", "Retrieval failed"),
            "workflow_log": log + [f"[Chat] Retriever error"],
        }

    chunks = retrieval["chunks"]
    sources = retrieval["sources"]
    retrieval_items = retrieval.get("retrieval_items", [])
    log.append(f"[Chat] Retriever: found {len(chunks)} chunks")

    if not chunks:
        return {
            **state,
            "status": "error",
            "error_message": "No relevant content found in notebook sources.",
            "workflow_log": log,
        }

    log.append("[Chat] Answer: generating grounded response...")
    answer_result = _answer.answer(
        query=rewritten_query,
        retrieval_items=retrieval_items,
        conversation_context=state.get("conversation_context", ""),
    )

    if answer_result["status"] == "error":
        return {
            **state,
            "status": "error",
            "error_message": answer_result.get("message", "Answer generation failed"),
            "workflow_log": log,
        }

    log.append("[Chat] Complete")

    return {
        **state,
        "chunks": chunks,
        "sources": sources,
        "retrieved_context": chunks,
        "retrieval_items": retrieval_items,
        "num_chunks_found": len(chunks),
        "searched_docs": retrieval.get("searched_docs", []),
        "rewritten_query": rewritten_query,
        "query_intent": rewrite.get("intent", route["intent"]),
        "needs_retrieval": rewrite.get("needs_retrieval", True),
        "final_answer": answer_result["answer"],
        "citations": answer_result.get("citations", []),
        "result": {
            "mode": "chat",
            "citations": answer_result.get("citations", []),
            "rewritten_query": rewritten_query,
            "intent": rewrite.get("intent", route["intent"]),
        },
        "workflow_log": log,
        "status": "complete",
    }
