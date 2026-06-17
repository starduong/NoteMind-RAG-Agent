import os
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from utils.document_parser import extract_text_from_file, chunk_text, SUPPORTED_EXTENSIONS
from utils.embeddings import get_embedding
from utils.llm_client import chat_complete
from config import LLM_CHAT_MODEL, LLM_CHAT_PROVIDER
from db.faiss_store import save_faiss_index, load_faiss_index, get_documents
from db.multi_doc_store import multi_doc_store
from db.sqlite_memory import conversation_memory
from models.schemas import (
    AskRequest,
    SessionCreateResponse,
    SessionHistoryResponse,
    NotebookCreateRequest,
    NotebookUpdateRequest,
    NotebookAskRequest,
    AddSourceRequest,
    LearnerProfileInput,
)
from fastapi.responses import Response
from utils.ics_generator import generate_ics
from db.notebook_store import notebook_store
import faiss
import numpy as np
import tempfile
from fastapi.middleware.cors import CORSMiddleware
from agents.chat.memory import build_memory_payload
from agents.supervisor.orchestrator import notebook_orchestrator
from utils.logger import api_logger

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For dev only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/health")
def health():
    api_logger.info("Health check endpoint called")
    return {"status": "ok"}

@app.get("/documents")
def list_documents():
    """Get list of all uploaded documents (legacy + multi-doc)"""
    api_logger.info("Fetching list of documents")

    # Get legacy documents
    legacy_docs = get_documents()

    # Get multi-doc documents
    multi_docs = multi_doc_store.list_documents()

    # Combine and deduplicate
    all_docs = list(set(legacy_docs + [doc.get("original_filename", doc["doc_id"]) for doc in multi_docs]))

    api_logger.info(f"Retrieved {len(all_docs)} documents ({len(legacy_docs)} legacy, {len(multi_docs)} multi-doc)")
    return {
        "documents": all_docs,
        "multi_docs": multi_docs,
        "count": len(all_docs)
    }

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), source: str = Form("document")):
    """
    Upload and index documents
    Supports: PDF, DOCX, HTML, TXT
    """
    # Get file extension
    filename = file.filename or "document"
    _, ext = os.path.splitext(filename)
    ext = ext.lower()

    api_logger.info(f"Upload request received: filename={filename}, extension={ext}, source={source}")

    # Validate file type
    if ext not in SUPPORTED_EXTENSIONS:
        api_logger.warning(f"Unsupported file format attempted: {ext}")
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format: {ext}. Supported: {', '.join(SUPPORTED_EXTENSIONS)}"
        )

    # Save uploaded file temporarily
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    temp_file.write(await file.read())
    temp_file.close()

    api_logger.debug(f"Temporary file created: {temp_file.name}")

    try:
        # Extract text using unified parser
        api_logger.info(f"Extracting text from {file_type if 'file_type' in locals() else ext} file")
        text, file_type = extract_text_from_file(temp_file.name)
        api_logger.info(f"Text extraction successful: {len(text)} characters extracted")

        chunks = chunk_text(text)
        api_logger.info(f"Text chunked into {len(chunks)} chunks")

        if not chunks:
            api_logger.error("No chunks generated from file")
            raise HTTPException(status_code=400, detail="No text could be extracted from the file")

        # Generate embeddings
        api_logger.info(f"🔢 Generating embeddings for {len(chunks)} chunks")
        vectors = [get_embedding(c) for c in chunks]
        dim = len(vectors[0])
        api_logger.info(f"✅ All embeddings generated | Dimension: {dim}, Total vectors: {len(vectors)}")

        # Load or create FAISS index
        api_logger.info("Loading FAISS index")
        index, metadata, documents = load_faiss_index()
        if index is None:
            api_logger.info("Creating new FAISS index")
            index = faiss.IndexFlatL2(dim)
            metadata = []
            documents = []
        else:
            api_logger.info(f"Loaded existing index with {index.ntotal} vectors")

        # Track document names
        if source not in documents:
            documents.append(source)
            api_logger.info(f"Added new document to tracking: {source}")

        # Add vectors to index
        index.add(np.array(vectors).astype("float32"))
        metadata.extend([{"chunk": c, "source": source, "file_type": file_type} for c in chunks])
        api_logger.info(f"Added {len(chunks)} vectors to FAISS index")

        # Save updated index
        save_faiss_index(index, metadata, documents)
        api_logger.info(f"FAISS index saved successfully. Total vectors: {index.ntotal}")

        result = {
            "status": "uploaded",
            "chunks": len(chunks),
            "source": source,
            "file_type": file_type,
            "characters": len(text)
        }
        api_logger.info(f"Upload completed successfully: {result}")
        return result

    except ValueError as e:
        api_logger.error(f"ValueError during file processing: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        api_logger.error(f"Unexpected error during file processing: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")
    finally:
        # Clean up temp file
        if os.path.exists(temp_file.name):
            os.unlink(temp_file.name)
            api_logger.debug(f"Temporary file cleaned up: {temp_file.name}")


@app.post("/upload-v2")
async def upload_file_v2(file: UploadFile = File(...)):
    """
    Phase 5: Multi-document upload with separate FAISS indices
    Each document gets its own vector store for clean retrieval
    """
    filename = file.filename or "document"
    _, ext = os.path.splitext(filename)
    ext = ext.lower()

    api_logger.info(f"[Phase 5] Upload request: filename={filename}, extension={ext}")

    # Validate file type
    if ext not in SUPPORTED_EXTENSIONS:
        api_logger.warning(f"Unsupported file format: {ext}")
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format: {ext}. Supported: {', '.join(SUPPORTED_EXTENSIONS)}"
        )

    # Save temp file
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    temp_file.write(await file.read())
    temp_file.close()

    try:
        # Extract text
        api_logger.info(f"Extracting text from {ext} file")
        text, file_type = extract_text_from_file(temp_file.name)
        api_logger.info(f"Extracted {len(text)} characters")

        # Chunk text
        chunks = chunk_text(text)
        api_logger.info(f"Created {len(chunks)} chunks")

        if not chunks:
            raise HTTPException(status_code=400, detail="No text extracted")

        # Generate embeddings
        api_logger.info(f"🔢 Generating embeddings for {len(chunks)} chunks")
        vectors = [get_embedding(c) for c in chunks]
        dim = len(vectors[0])
        api_logger.info(f"✅ Embeddings generated | Dimension: {dim}")

        # Create FAISS index for this document
        index = faiss.IndexFlatL2(dim)
        index.add(np.array(vectors).astype("float32"))

        # Document info
        from datetime import datetime
        doc_info = {
            "original_filename": filename,
            "file_type": file_type,
            "upload_date": datetime.now().isoformat(),
            "characters": len(text),
            "chunks": len(chunks),
            "vectors": index.ntotal
        }

        doc_path = multi_doc_store._get_document_path(filename)
        doc_id = os.path.basename(doc_path)

        # Create metadata
        metadata = [
            {
                "chunk": chunk_text,
                "chunk_id": f"{doc_id}_chunk_{idx}",
                "chunk_index": idx,
                "doc_id": doc_id,
                "source": filename,
                "source_name": filename,
                "file_type": file_type,
            }
            for idx, chunk_text in enumerate(chunks)
        ]

        # Save to multi-document store
        multi_doc_store.save_document_index(
            doc_id=filename,
            index=index,
            metadata=metadata,
            doc_info=doc_info
        )

        api_logger.info(f"✅ Document saved with separate index: {filename}")

        return {
            "status": "uploaded",
            "filename": filename,
            "doc_id": doc_id,
            "file_type": file_type,
            "chunks": len(chunks),
            "characters": len(text),
            "vectors": index.ntotal,
            "storage_type": "multi-doc"
        }

    except ValueError as e:
        api_logger.error(f"ValueError: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        api_logger.error(f"Error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    finally:
        if os.path.exists(temp_file.name):
            os.unlink(temp_file.name)


@app.post("/ask")
async def ask(req: AskRequest):
    api_logger.info(f"Query received: '{req.query}' (top_k={req.top_k}, source={req.source})")

    index, metadata, documents = load_faiss_index()
    if index is None:
        api_logger.warning("Query attempted with no documents available")
        raise HTTPException(status_code=400, detail="No documents available")

    api_logger.debug(f"Generating embedding for query")
    q_vec = np.array([get_embedding(req.query)]).astype("float32")

    # If source filter is specified, search more chunks to ensure we get enough matches
    search_k = req.top_k * 10 if req.source else req.top_k
    api_logger.debug(f"Searching FAISS index for top {search_k} chunks")
    distances, indices = index.search(q_vec, search_k)

    # Filter by source if specified
    retrieved = []
    sources = []
    for i in indices[0]:
        if i < len(metadata):
            chunk_data = metadata[i]
            # Apply source filter if specified
            if req.source is None or chunk_data["source"] == req.source:
                retrieved.append(chunk_data["chunk"])
                sources.append(chunk_data["source"])
                if len(retrieved) >= req.top_k:
                    break

    api_logger.info(f"Retrieved {len(retrieved)} chunks from {len(set(sources))} unique sources")

    if not retrieved:
        api_logger.warning(f"No content found for query with source filter: {req.source}")
        raise HTTPException(status_code=404, detail=f"No content found for document: {req.source}")

    context = "\n\n".join(retrieved)

    prompt = f"Answer using context below:\n{context}\n\nQuestion: {req.query}"
    api_logger.info(f"Invoking LLM | provider={LLM_CHAT_PROVIDER} | model={LLM_CHAT_MODEL}")

    answer, usage = chat_complete(
        messages=[{"role": "user", "content": prompt}],
        model=LLM_CHAT_MODEL,
        provider=LLM_CHAT_PROVIDER,
        temperature=0.3,
    )

    if usage:
        api_logger.info(
            f"✅ LLM Response received | "
            f"Tokens: {usage.prompt_tokens} input + {usage.completion_tokens} output "
            f"= {usage.total_tokens} total"
        )
    else:
        api_logger.info("✅ LLM Response received")

    return {
        "answer": answer,
        "sources": sources[:req.top_k]
    }




# Session Management Endpoints

@app.post("/sessions/create", response_model=SessionCreateResponse)
def create_session():
    """Create a new conversation session"""
    api_logger.info("Creating new session")
    session_id = conversation_memory.create_session()
    metadata = conversation_memory.get_session_metadata(session_id)
    api_logger.info(f"Session created: {session_id}")
    return {
        "session_id": session_id,
        "created_at": metadata["created_at"]
    }


@app.get("/sessions/{session_id}/history", response_model=SessionHistoryResponse)
def get_session_history(session_id: str):
    """Get conversation history for a session"""
    api_logger.info(f"Fetching history for session: {session_id}")
    if not conversation_memory.session_exists(session_id):
        api_logger.warning(f"Session not found: {session_id}")
        raise HTTPException(status_code=404, detail="Session not found")

    messages = conversation_memory.get_history(session_id)
    metadata = conversation_memory.get_session_metadata(session_id)
    api_logger.info(f"Retrieved {len(messages)} messages for session {session_id}")

    return {
        "session_id": session_id,
        "messages": messages,
        "metadata": metadata
    }


@app.delete("/sessions/{session_id}")
def clear_session(session_id: str):
    """Clear conversation history for a session"""
    api_logger.info(f"Clearing session: {session_id}")
    if not conversation_memory.session_exists(session_id):
        api_logger.warning(f"Attempted to clear non-existent session: {session_id}")
        raise HTTPException(status_code=404, detail="Session not found")

    conversation_memory.clear_session(session_id)
    api_logger.info(f"Session cleared: {session_id}")
    return {"status": "cleared", "session_id": session_id}


@app.get("/sessions")
def list_sessions():
    """Get list of all active sessions"""
    api_logger.info("Fetching all sessions")
    sessions = conversation_memory.get_all_sessions()
    api_logger.info(f"Retrieved {len(sessions)} active sessions")
    return {"sessions": sessions, "count": len(sessions)}





# --- Notebook endpoints (NotebookLM-style) ---

@app.get("/notebooks")
def list_notebooks():
    """List all notebooks with source counts."""
    notebooks = notebook_store.list_notebooks()
    return {"notebooks": notebooks, "count": len(notebooks)}


@app.post("/notebooks")
def create_notebook(req: NotebookCreateRequest):
    """Create a new notebook."""
    notebook = notebook_store.create_notebook(req.title, req.description)
    return notebook


@app.get("/notebooks/{notebook_id}")
def get_notebook(notebook_id: str):
    """Get notebook details and sources."""
    notebook = notebook_store.get_notebook(notebook_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    multi_docs = multi_doc_store.list_documents()
    doc_map = {d["doc_id"]: d for d in multi_docs}
    sources_detail = [
        doc_map[doc_id] for doc_id in notebook.get("sources", []) if doc_id in doc_map
    ]
    return {**notebook, "sources_detail": sources_detail}


@app.patch("/notebooks/{notebook_id}")
def update_notebook(notebook_id: str, req: NotebookUpdateRequest):
    notebook = notebook_store.update_notebook(
        notebook_id, title=req.title, description=req.description
    )
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return notebook


@app.delete("/notebooks/{notebook_id}")
def delete_notebook(notebook_id: str):
    if not notebook_store.delete_notebook(notebook_id):
        raise HTTPException(status_code=404, detail="Notebook not found")
    return {"status": "deleted", "notebook_id": notebook_id}


@app.post("/notebooks/{notebook_id}/sources")
def add_notebook_source(notebook_id: str, req: AddSourceRequest):
    """Link an existing indexed document to a notebook."""
    if not multi_doc_store.document_exists(req.doc_id):
        raise HTTPException(status_code=404, detail=f"Document not found: {req.doc_id}")
    if not notebook_store.add_source(notebook_id, req.doc_id):
        raise HTTPException(status_code=404, detail="Notebook not found")
    return notebook_store.get_notebook(notebook_id)


@app.delete("/notebooks/{notebook_id}/sources/{doc_id}")
def remove_notebook_source(notebook_id: str, doc_id: str):
    notebook_store.remove_source(notebook_id, doc_id)
    notebook = notebook_store.get_notebook(notebook_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return notebook


@app.post("/notebooks/{notebook_id}/sources/upload")
async def upload_notebook_source(notebook_id: str, file: UploadFile = File(...)):
    """Upload a document and attach it to the notebook."""
    if not notebook_store.get_notebook(notebook_id):
        raise HTTPException(status_code=404, detail="Notebook not found")

    result = await upload_file_v2(file)
    doc_id = result.get("doc_id")
    if doc_id:
        notebook_store.add_source(notebook_id, doc_id)
    notebook = notebook_store.get_notebook(notebook_id)
    return {"upload": result, "notebook": notebook}


@app.post("/notebooks/{notebook_id}/ask")
async def ask_notebook(notebook_id: str, req: NotebookAskRequest):
    """
    Run a capability workflow on the notebook knowledge base.
    Modes: chat | research | quiz | roadmap
    """
    api_logger.info(
        f"Notebook ask: notebook={notebook_id}, mode={req.mode}, query='{req.query[:80]}...'"
    )

    session_id = req.session_id
    if not session_id:
        session_id = conversation_memory.create_session()
    elif not conversation_memory.session_exists(session_id):
        conversation_memory.create_session(session_id)

    conversation_memory.add_message(session_id, "user", req.query)

    # Intercept tool command
    if req.query.startswith("@search_external_quizzes:"):
        # Get recent history to understand context
        history = conversation_memory.get_history(session_id, limit=6)
        # Exclude the current command itself for context if needed, but it's fine.
        history_text = "\n".join([f"{msg['role']}: {msg['content'][:800]}" for msg in history[:-1] if msg['role'] in ('user', 'assistant')])
        
        prompt = f"""Dựa vào lịch sử trò chuyện ngắn dưới đây (đặc biệt là yêu cầu gốc của người dùng và các câu trắc nghiệm AI đã sinh ra), hãy xác định chính xác chủ đề, phạm vi kiến thức cốt lõi.
Lịch sử:
{history_text}

Nhiệm vụ: Tạo ra một câu truy vấn tìm kiếm siêu ngắn gọn (tối đa 5-8 từ) để tìm các đề trắc nghiệm tương tự trên mạng. (VD: "trắc nghiệm lịch sử việt nam thế kỷ 19", "quiz chu trình krebs sinh học").
Lưu ý: CHỈ trả về đúng câu truy vấn tìm kiếm, không giải thích gì thêm, không dùng dấu ngoặc kép.
"""
        api_logger.info("Calling LLM to generate optimized quiz search query...")
        optimized_query, _ = chat_complete(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2
        )
        optimized_query = optimized_query.strip(' \n"')
        api_logger.info(f"Optimized search query: {optimized_query}")
        
        from tools.quiz_search_tool import search_external_quizzes
        results = search_external_quizzes(optimized_query)
        
        import json
        answer_json = json.dumps({"external_quizzes": results}, ensure_ascii=False)
        answer = f"```json\n{answer_json}\n```"
        
        conversation_memory.add_message(
            session_id,
            "assistant",
            answer,
            metadata={"mode": req.mode, "notebook_id": notebook_id}
        )
        return {
            "answer": answer,
            "sources": [],
            "workflow_log": [f"[QuizTool] Generated query: {optimized_query}", "[QuizTool] Fetched external quizzes"],
            "session_id": session_id,
            "status": "complete"
        }
    history = conversation_memory.get_history(session_id, limit=16)
    memory_payload = build_memory_payload(history)

    # Build learner_profile dict if provided
    learner_profile_dict = None
    if req.learner_profile:
        learner_profile_dict = req.learner_profile.model_dump()

    result = notebook_orchestrator.process(
        notebook_id=notebook_id,
        user_query=req.query,
        mode=req.mode,
        top_k=req.top_k,
        conversation_context=memory_payload["conversation_context"],
        conversation_messages=history,
        conversation_summary=memory_payload["conversation_summary"],
        recent_messages=memory_payload["recent_messages"],
        doc_ids=req.doc_ids,
        learner_profile=learner_profile_dict,
    )

    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["answer"])

    conversation_memory.add_message(
        session_id,
        "assistant",
        result["answer"],
        metadata={
            "mode": req.mode,
            "sources": result.get("sources", []),
            "citations": result.get("citations", []),
            "workflow_log": result.get("workflow_log", []),
            "notebook_id": notebook_id,
            "result": result.get("result", {}),  # Includes schedule data for ICS export
            "tools_data": result.get("tools_data"),
        },
    )

    return {
        **result,
        "session_id": session_id,
        "tools_data": result.get("tools_data"),
        "has_tools": bool(result.get("tools_data")),
    }


@app.get("/notebooks/{notebook_id}/roadmap/export-ics")
def export_roadmap_ics(notebook_id: str, session_id: str = None):
    """
    Export the last roadmap schedule as an iCalendar (.ics) file.
    Pass session_id query param to get session-specific roadmap.
    """
    api_logger.info(f"ICS export request: notebook={notebook_id}, session={session_id}")

    # Try to get schedule from session history
    if session_id and conversation_memory.session_exists(session_id):
        messages = conversation_memory.get_history(session_id)
        for msg in reversed(messages):
            meta = msg.get("metadata", {})
            if meta.get("mode") == "roadmap":
                # Check if result has schedule data in workflow_log or metadata
                result_data = meta.get("result", {})
                if isinstance(result_data, dict) and result_data.get("schedule"):
                    schedule_data = result_data["schedule"]
                    if isinstance(schedule_data, list):
                        schedule_data = {"schedule": schedule_data}
                    learner_profile = result_data.get("learner_profile", {})
                    goal = learner_profile.get("goal", "Learning Roadmap") if learner_profile else "Learning Roadmap"
                    ics_content = generate_ics(schedule_data, calendar_name=f"NoteMind — {goal}")
                    api_logger.info(f"ICS generated from session {session_id}: {len(ics_content)} bytes")
                    return Response(
                        content=ics_content,
                        media_type="text/calendar",
                        headers={
                            "Content-Disposition": 'attachment; filename="notemind-roadmap.ics"',
                            "Content-Type": "text/calendar; charset=utf-8",
                        }
                    )

    # Fallback: generate a sample ICS
    api_logger.warning(f"No roadmap data found for notebook={notebook_id}, session={session_id}")
    raise HTTPException(
        status_code=404,
        detail="No roadmap schedule found. Generate a roadmap first in the Roadmap tab."
    )


@app.get("/stats")
def get_database_stats():
    """Get database statistics"""
    api_logger.info("Fetching database statistics")

    # Conversation stats
    conversation_stats = conversation_memory.get_stats()

    # FAISS stats
    index, metadata, documents = load_faiss_index()
    faiss_stats = {
        "total_vectors": index.ntotal if index else 0,
        "total_documents": len(documents),
        "total_chunks": len(metadata)
    }

    stats = {
        "conversations": conversation_stats,
        "documents": faiss_stats
    }

    api_logger.info(f"Database stats retrieved: {stats}")
    return stats
