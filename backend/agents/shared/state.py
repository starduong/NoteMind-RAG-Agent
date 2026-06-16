"""
NotebookState — unified state for all capability workflows.
"""
from typing import Any, Dict, List, Optional, TypedDict


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


class LearnerProfile(TypedDict, total=False):
    """Structured learner profile for personalized roadmap generation."""
    goal: str           # e.g. "AWS Certification", "Job readiness", "Research"
    level: str          # "beginner" | "intermediate" | "advanced"
    hours_per_day: float  # e.g. 2.0
    preference: str     # "theory" | "practice" | "mixed" | "video"
    start_date: str     # ISO date string, e.g. "2025-01-20"


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

  # Learner profile (for roadmap mode)
  learner_profile: Optional[Dict[str, Any]]

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

  # Multi-Agent Roadmap Pipeline
  knowledge_graph: Optional[Dict[str, Any]]   # ContentAnalyzer output
  assessment_result: Optional[Dict[str, Any]] # Assessment output
  syllabus: Optional[Dict[str, Any]]          # SyllabusArchitect output
  daily_schedule: Optional[Dict[str, Any]]    # Scheduler output
  enriched_milestones: Optional[List[Dict[str, Any]]]  # ResourceQuiz output
  ics_content: Optional[str]                  # iCalendar string

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

  # External tool enrichment
  tool_triggers: List[str]           # e.g. ["wikipedia", "github"]
  tools_data: Optional[Dict[str, Any]]  # {"wikipedia": {...}, "github": [...]}


def create_initial_state(
  notebook_id: str,
  user_query: str,
  mode: str,
  doc_ids: Optional[List[str]] = None,
  top_k: int = 5,
  conversation_context: str = "",
  learner_profile: Optional[Dict[str, Any]] = None,
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
    learner_profile=learner_profile,
    chunks=[],
    sources=[],
    retrieved_context=[],
    retrieval_items=[],
    num_chunks_found=0,
    searched_docs=[],
    rewritten_query=user_query,
    query_intent="factual_query",
    needs_retrieval=True,
    knowledge_graph=None,
    assessment_result=None,
    syllabus=None,
    daily_schedule=None,
    enriched_milestones=None,
    ics_content=None,
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
    tool_triggers=[],
    tools_data=None,
  )
