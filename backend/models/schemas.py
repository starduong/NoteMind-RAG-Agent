from pydantic import BaseModel
from typing import Optional, List, Dict, Literal

class AskRequest(BaseModel):
    query: str
    top_k: int = 5
    source: Optional[str] = None  # Filter by document source (legacy)
    doc_ids: Optional[List[str]] = None  # Phase 5: List of document IDs to search
    session_id: Optional[str] = None  # Session ID for conversation memory
    mode: Optional[str] = "chat"  # chat | quiz | roadmap


class NotebookCreateRequest(BaseModel):
    title: str
    description: str = ""


class NotebookUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class LearnerProfileInput(BaseModel):
    """Structured learner profile for personalized roadmap generation."""
    goal: str = "General learning"
    level: str = "beginner"           # beginner | intermediate | advanced
    hours_per_day: float = 2.0
    preference: str = "mixed"         # theory | practice | mixed | video
    start_date: Optional[str] = None  # ISO date string


class NotebookAskRequest(BaseModel):
    query: str
    mode: Literal["chat", "quiz", "roadmap"] = "chat"
    top_k: int = 5
    session_id: Optional[str] = None
    doc_ids: Optional[List[str]] = None
    learner_profile: Optional[LearnerProfileInput] = None  # For roadmap mode


class AddSourceRequest(BaseModel):
    doc_id: str

class SessionCreateResponse(BaseModel):
    session_id: str
    created_at: str

class SessionHistoryResponse(BaseModel):
    session_id: str
    messages: List[Dict]
    metadata: Dict
