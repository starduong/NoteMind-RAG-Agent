from typing import Optional

from sentence_transformers import SentenceTransformer

from config import EMBEDDING_MODEL
from utils.logger import api_logger

_embedding_model: Optional[SentenceTransformer] = None

_EMBEDDING_MODEL_ALIASES = {
    "bge-m3": "BAAI/bge-m3",
}


def _resolve_embedding_model_name(model_name: str) -> str:
    normalized = (model_name or "").strip()
    return _EMBEDDING_MODEL_ALIASES.get(normalized, normalized)


def _get_embedding_model() -> SentenceTransformer:
    global _embedding_model
    if _embedding_model is None:
        resolved_model = _resolve_embedding_model_name(EMBEDDING_MODEL)
        if resolved_model != EMBEDDING_MODEL:
            api_logger.info(
                f"Resolved embedding model alias: {EMBEDDING_MODEL} -> {resolved_model}"
            )
        api_logger.info(f"Loading local embedding model: {resolved_model}")
        _embedding_model = SentenceTransformer(resolved_model)
        dim_fn = getattr(
            _embedding_model, "get_embedding_dimension", None
        ) or _embedding_model.get_sentence_embedding_dimension
        dim = dim_fn()
        api_logger.info(f"Embedding model ready | dimension={dim}")
    return _embedding_model


def get_embedding(text: str) -> list[float]:
    """
    Get embedding vector using sentence-transformers (local, no API key).
    """
    resolved_model = _resolve_embedding_model_name(EMBEDDING_MODEL)
    api_logger.debug(
        f"Generating embedding - Model: {resolved_model}, Text length: {len(text)} chars"
    )

    model = _get_embedding_model()
    vector = model.encode(
        text,
        show_progress_bar=False,
        normalize_embeddings=True,
    )

    api_logger.debug(f"Embedding generated | dimension={len(vector)}")
    return vector.tolist()


def call_llm(
    prompt: str,
    model: Optional[str] = None,
    provider: Optional[str] = None,
) -> str:
    """Backward-compatible LLM helper for simple prompts."""
    from utils.llm_client import generate_text

    return generate_text(prompt, model=model, provider=provider)
