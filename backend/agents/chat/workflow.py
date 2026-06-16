"""
Chat workflow: Intent Router → Query Rewrite → Retriever → Answer → Tool Enrichment
"""
from agents.chat.agents import AnswerAgent, IntentRouter, QueryRewriteAgent, RetrieverAgent
from agents.chat.agents.tool_runner import ToolRunner
from agents.shared.state import NotebookState

_router = IntentRouter()
_rewriter = QueryRewriteAgent()
_retriever = RetrieverAgent()
_answer = AnswerAgent()
_tool_runner = ToolRunner()


def run_chat_workflow(state: NotebookState) -> NotebookState:
    log = list(state.get("workflow_log", []))
    user_query = state.get("user_query", "")

    # ── Step 1: Intent Router ──────────────────────────────────────────────
    route = _router.route(user_query)
    tool_triggers = route.get("tool_triggers", [])
    log.append(f"[Chat] Intent Router: {route['intent']}")
    if tool_triggers:
        log.append(f"[Chat] Tool triggers detected: {tool_triggers}")

    if not route.get("needs_retrieval", True):
        # Direct answer (greeting / thanks) — still run tools if triggered
        tools_data = None
        if tool_triggers:
            log.append("[Chat] Running tool enrichment (no-retrieval path)...")
            tools_data = _tool_runner.run(triggers=tool_triggers, query=user_query)
            log.append(f"[Chat] Tools completed: {list(tools_data.keys())}")

        log.append("[Chat] Complete")
        return {
            **state,
            "status": "complete",
            "query_intent": route["intent"],
            "needs_retrieval": False,
            "final_answer": route.get("direct_answer", ""),
            "citations": [],
            "sources": [],
            "result": {"mode": "chat", "citations": [], "rewritten_query": user_query},
            "workflow_log": log,
            "tool_triggers": tool_triggers,
            "tools_data": tools_data,
        }

    # ── Step 2: Query Rewriter ─────────────────────────────────────────────
    log.append("[Chat] Rewriter: resolving conversational query...")
    rewrite = _rewriter.rewrite(
        query=user_query,
        conversation_context=state.get("conversation_context", ""),
        recent_messages=state.get("recent_messages", []),
    )
    rewritten_query = rewrite.get("standalone_query", user_query)
    log.append("[Chat] Rewriter: retrieval query ready")

    # ── Step 3: Retriever ──────────────────────────────────────────────────
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
            "workflow_log": log + ["[Chat] Retriever error"],
            "tool_triggers": tool_triggers,
            "tools_data": None,
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
            "tool_triggers": tool_triggers,
            "tools_data": None,
        }

    # ── Step 4: Answer Generator ───────────────────────────────────────────
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
            "tool_triggers": tool_triggers,
            "tools_data": None,
        }

    # ── Step 5: Tool Enrichment (runs concurrently via ToolRunner) ─────────
    tools_data = None
    if tool_triggers:
        log.append(f"[Chat] Tool Enrichment: running {tool_triggers}...")
        tools_data = _tool_runner.run(
            triggers=tool_triggers,
            query=user_query,
        )
        active_tools = [k for k, v in tools_data.items() if v]
        log.append(f"[Chat] Tool Enrichment: completed {active_tools}")

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
        "tool_triggers": tool_triggers,
        "tools_data": tools_data,
    }
