"""
NotebookState — unified state for all capability workflows.
ResearchState — LangGraph state for research pipeline.
"""
from typing import Any, Dict, List, Optional, TypedDict


class ResearchState(TypedDict, total=False):
    """State for research LangGraph workflow (legacy + notebook research mode)."""

    query: str
    top_k: int
    source: Optional[str]
    doc_ids: Optional[List[str]]
    use_multi_doc: bool
    conversation_context: str

    chunks: List[str]
    sources: List[str]
    num_chunks_found: int
    searched_docs: List[str]

    initial_summary: str
    critique: str
    has_gaps: bool
    suggestions: List[str]
    final_answer: str
    editing_applied: bool

    workflow_log: List[str]
    status: str
    error_message: Optional[str]

    research_complete: bool
    summary_complete: bool
    critique_complete: bool
    editor_complete: bool


# Backward-compatible alias
AgentState = ResearchState


class RetrievalItem(TypedDict, total=False):
    citation_id: str
    chunk_id: str
    chunk_index: int
    doc_id: str
    source_name: str
    file_type: str
    chunk_text: str
    distance: float
    score: float
    vector_score: float
    keyword_score: float


class CitationItem(TypedDict, total=False):
    citation_id: str
    chunk_id: str
    source_name: str
    text_span: str
    start_index: int
    end_index: int
    chunk_text: str


class NotebookState(TypedDict, total=False):
  # Notebook context
  notebook_id: str
  documents: List[str]
  doc_ids: Optional[List[str]]

  # User input
  user_query: str
  mode: str
  top_k: int
  conversation_context: str
  conversation_messages: List[Dict[str, Any]]
  conversation_summary: str
  recent_messages: List[Dict[str, Any]]

  # Retrieval
  chunks: List[str]
  sources: List[str]
  retrieved_context: List[str]
  retrieval_items: List[RetrievalItem]
  num_chunks_found: int
  searched_docs: List[str]
  rewritten_query: str
  query_intent: str
  needs_retrieval: bool

  # Research pipeline
  initial_summary: str
  critique: str
  has_gaps: bool
  suggestions: List[str]
  editing_applied: bool

  # Output
  final_answer: str
  result: Dict[str, Any]
  citations: List[CitationItem]

  # Workflow metadata
  workflow_log: List[str]
  status: str
  error_message: Optional[str]

  research_complete: bool
  summary_complete: bool
  critique_complete: bool
  editor_complete: bool


def create_initial_state(
  notebook_id: str,
  user_query: str,
  mode: str,
  doc_ids: Optional[List[str]] = None,
  top_k: int = 5,
  conversation_context: str = "",
) -> NotebookState:
  return NotebookState(
    notebook_id=notebook_id,
    documents=doc_ids or [],
    doc_ids=doc_ids,
    user_query=user_query,
    mode=mode,
    top_k=top_k,
    conversation_context=conversation_context,
    conversation_messages=[],
    conversation_summary="",
    recent_messages=[],
    chunks=[],
    sources=[],
    retrieved_context=[],
    retrieval_items=[],
    num_chunks_found=0,
    searched_docs=[],
    rewritten_query=user_query,
    query_intent="factual_query",
    needs_retrieval=True,
    initial_summary="",
    critique="",
    has_gaps=False,
    suggestions=[],
    editing_applied=False,
    final_answer="",
    result={},
    citations=[],
    workflow_log=[],
    status="initialized",
    error_message=None,
    research_complete=False,
    summary_complete=False,
    critique_complete=False,
    editor_complete=False,
  )
