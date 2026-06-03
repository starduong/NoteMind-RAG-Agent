"""
Quiz workflow: Generator → Reviewer → Formatter
"""
from agents.chat.agents.retriever import RetrieverAgent
from agents.quiz.agents import QuizFormatterAgent, QuizGeneratorAgent, QuizReviewerAgent
from agents.shared.state import NotebookState

_retriever = RetrieverAgent()
_generator = QuizGeneratorAgent()
_reviewer = QuizReviewerAgent()
_formatter = QuizFormatterAgent()


def run_quiz_workflow(state: NotebookState) -> NotebookState:
    log = list(state.get("workflow_log", []))
    log.append("[Quiz] Retrieving source content...")

    retrieval = _retriever.retrieve(
        query=state["user_query"] or "key concepts and definitions",
        doc_ids=state.get("doc_ids"),
        top_k=max(state.get("top_k", 5), 8),
    )

    if retrieval["status"] == "error" or not retrieval["chunks"]:
        msg = retrieval.get("message", "No content available for quiz generation")
        return {**state, "status": "error", "error_message": msg, "workflow_log": log}

    context = "\n\n---\n\n".join(retrieval["chunks"][:10])
    sources = retrieval["sources"]

    log.append("[Quiz] Generator: creating questions...")
    gen = _generator.generate(context, state["user_query"])
    if gen["status"] == "error":
        return {**state, "status": "error", "error_message": gen["message"], "workflow_log": log}

    log.append("[Quiz] Reviewer: validating accuracy...")
    rev = _reviewer.review(context, gen["draft"])

    log.append("[Quiz] Formatter: finalizing output...")
    fmt = _formatter.format(rev["reviewed"], len(set(sources)))
    log.append("[Quiz] Complete")

    return {
        **state,
        "chunks": retrieval["chunks"],
        "sources": sources,
        "retrieved_context": retrieval["chunks"],
        "final_answer": fmt["formatted"],
        "result": {"mode": "quiz"},
        "workflow_log": log,
        "status": "complete",
    }
