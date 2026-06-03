"""LangGraph definition for research capability."""
from langgraph.graph import END, StateGraph

from agents.research.nodes import (
    critic_node,
    editor_node,
    research_node,
    should_edit,
    skip_editor_node,
    summarizer_node,
)
from agents.shared.state import ResearchState


def create_research_graph():
    workflow = StateGraph(ResearchState)
    workflow.add_node("research", research_node)
    workflow.add_node("summarize", summarizer_node)
    workflow.add_node("critique", critic_node)
    workflow.add_node("edit", editor_node)
    workflow.add_node("skip_edit", skip_editor_node)

    workflow.set_entry_point("research")
    workflow.add_edge("research", "summarize")
    workflow.add_edge("summarize", "critique")
    workflow.add_conditional_edges(
        "critique",
        should_edit,
        {"edit": "edit", "skip_edit": "skip_edit"},
    )
    workflow.add_edge("edit", END)
    workflow.add_edge("skip_edit", END)
    return workflow.compile()


def get_workflow_visualization() -> str:
    graph = create_research_graph()
    try:
        return graph.get_graph().draw_mermaid()
    except Exception:
        return """
graph TD
    START --> research[Researcher]
    research --> summarize[Summarizer]
    summarize --> critique[Critic]
    critique -->|gaps| edit[Editor]
    critique -->|ok| skip[Skip Editor]
    edit --> END
    skip --> END
"""


research_graph = create_research_graph()
