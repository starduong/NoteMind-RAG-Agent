from pydantic import BaseModel
from typing import Optional, List, Dict, Literal

class AskRequest(BaseModel):
    query: str
    top_k: int = 5
    source: Optional[str] = None  # Filter by document source (legacy)
    doc_ids: Optional[List[str]] = None  # Phase 5: List of document IDs to search
    session_id: Optional[str] = None  # Session ID for conversation memory
    mode: Optional[str] = "chat"  # chat | research | quiz | roadmap


class NotebookCreateRequest(BaseModel):
    title: str
    description: str = ""


class NotebookUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class NotebookAskRequest(BaseModel):
    query: str
    mode: Literal["chat", "research", "quiz", "roadmap"] = "chat"
    top_k: int = 5
    session_id: Optional[str] = None
    doc_ids: Optional[List[str]] = None


class AddSourceRequest(BaseModel):
    doc_id: str

class SessionCreateResponse(BaseModel):
    session_id: str
    created_at: str

class SessionHistoryResponse(BaseModel):
    session_id: str
    messages: List[Dict]
    metadata: Dict
