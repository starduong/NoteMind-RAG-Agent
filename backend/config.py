import os

from dotenv import load_dotenv

load_dotenv()

# ==============================================================================
# 1. EMBEDDING CONFIGURATION
# ==============================================================================
# Local sentence-transformers model used across the entire retrieval pipeline.
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")

# ==============================================================================
# 2. LLM PROVIDERS
# ==============================================================================
# Google AI Studio using the OpenAI-compatible endpoint.
GOOGLE_API_BASE = os.getenv(
    "GOOGLE_API_BASE",
    "https://generativelanguage.googleapis.com/v1beta/openai/",
)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# GitHub Models via Azure-hosted OpenAI-compatible endpoint.
GITHUB_BASE_URL = os.getenv(
    "GITHUB_BASE_URL",
    "https://models.inference.ai.azure.com",
)
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")

# Keep OpenRouter as an optional fallback for compatibility.
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_SITE_URL = os.getenv("OPENROUTER_SITE_URL", "")
OPENROUTER_APP_NAME = os.getenv("OPENROUTER_APP_NAME", "NoteMind")

# ==============================================================================
# 3. LAYER DEFAULTS
# ==============================================================================
LLM_REASONING_PROVIDER = os.getenv("LLM_REASONING_PROVIDER", "github")
LLM_REASONING_MODEL = os.getenv(
    "LLM_REASONING_MODEL",
    "gpt-4o",
)

LLM_LONG_CONTEXT_PROVIDER = os.getenv("LLM_LONG_CONTEXT_PROVIDER", "google")
LLM_LONG_CONTEXT_MODEL = os.getenv(
    "LLM_LONG_CONTEXT_MODEL",
    "gemini-3.5-flash",
)

LLM_STRUCTURED_PROVIDER = os.getenv("LLM_STRUCTURED_PROVIDER", "google")
LLM_STRUCTURED_MODEL = os.getenv(
    "LLM_STRUCTURED_MODEL",
    "gemini-3.5-flash",
)

LLM_UTILITY_PROVIDER = os.getenv("LLM_UTILITY_PROVIDER", "github")
LLM_UTILITY_MODEL = os.getenv(
    "LLM_UTILITY_MODEL",
    "gpt-4o-mini",
)

LLM_CHAT_PROVIDER = os.getenv("LLM_CHAT_PROVIDER", "github")
LLM_CHAT_MODEL = os.getenv("LLM_CHAT_MODEL", "gpt-4o-mini")

# ==============================================================================
# 4. AGENT MODEL MAPPING
# ==============================================================================
# Reasoning layer: orchestration, evaluation, planning.
LLM_SUPERVISOR_PROVIDER = os.getenv("LLM_SUPERVISOR_PROVIDER", LLM_REASONING_PROVIDER)
LLM_SUPERVISOR_MODEL = os.getenv("LLM_SUPERVISOR_MODEL", LLM_REASONING_MODEL)

LLM_CRITIC_PROVIDER = os.getenv("LLM_CRITIC_PROVIDER", LLM_REASONING_PROVIDER)
LLM_CRITIC_MODEL = os.getenv("LLM_CRITIC_MODEL", LLM_REASONING_MODEL)

LLM_PLANNER_PROVIDER = os.getenv("LLM_PLANNER_PROVIDER", LLM_REASONING_PROVIDER)
LLM_PLANNER_MODEL = os.getenv("LLM_PLANNER_MODEL", LLM_REASONING_MODEL)

# Long-context layer: large-context synthesis and grounded responses.
LLM_RESEARCH_PROVIDER = os.getenv("LLM_RESEARCH_PROVIDER", LLM_LONG_CONTEXT_PROVIDER)
LLM_RESEARCH_MODEL = os.getenv("LLM_RESEARCH_MODEL", LLM_LONG_CONTEXT_MODEL)

LLM_SUMMARY_PROVIDER = os.getenv("LLM_SUMMARY_PROVIDER", LLM_UTILITY_PROVIDER)
LLM_SUMMARY_MODEL = os.getenv("LLM_SUMMARY_MODEL", LLM_UTILITY_MODEL)

LLM_ANSWER_PROVIDER = os.getenv("LLM_ANSWER_PROVIDER", LLM_CHAT_PROVIDER)
LLM_ANSWER_MODEL = os.getenv("LLM_ANSWER_MODEL", LLM_CHAT_MODEL)

LLM_EDITOR_PROVIDER = os.getenv("LLM_EDITOR_PROVIDER", LLM_UTILITY_PROVIDER)
LLM_EDITOR_MODEL = os.getenv("LLM_EDITOR_MODEL", LLM_UTILITY_MODEL)

# Structured-output layer: JSON/Markdown-heavy generation and review.
LLM_QUIZ_GEN_PROVIDER = os.getenv("LLM_QUIZ_GEN_PROVIDER", LLM_STRUCTURED_PROVIDER)
LLM_QUIZ_GEN_MODEL = os.getenv("LLM_QUIZ_GEN_MODEL", LLM_STRUCTURED_MODEL)

LLM_QUIZ_REVIEW_PROVIDER = os.getenv(
    "LLM_QUIZ_REVIEW_PROVIDER", LLM_UTILITY_PROVIDER
)
LLM_QUIZ_REVIEW_MODEL = os.getenv("LLM_QUIZ_REVIEW_MODEL", LLM_UTILITY_MODEL)

LLM_ROADMAP_RESOURCE_PROVIDER = os.getenv(
    "LLM_ROADMAP_RESOURCE_PROVIDER",
    LLM_STRUCTURED_PROVIDER,
)
LLM_ROADMAP_RESOURCE_MODEL = os.getenv(
    "LLM_ROADMAP_RESOURCE_MODEL",
    LLM_STRUCTURED_MODEL,
)

LLM_ROADMAP_REVIEW_PROVIDER = os.getenv(
    "LLM_ROADMAP_REVIEW_PROVIDER",
    LLM_UTILITY_PROVIDER,
)
LLM_ROADMAP_REVIEW_MODEL = os.getenv(
    "LLM_ROADMAP_REVIEW_MODEL",
    LLM_UTILITY_MODEL,
)

# Utility layer: low-latency post-processing.
LLM_CITATION_PROVIDER = os.getenv("LLM_CITATION_PROVIDER", LLM_UTILITY_PROVIDER)
LLM_CITATION_MODEL = os.getenv("LLM_CITATION_MODEL", LLM_UTILITY_MODEL)

# ==============================================================================
# 5. BACKWARD-COMPATIBILITY DEFAULTS
# ==============================================================================
# Keep generic defaults for any legacy callers that still expect a single model.
LLM_MODEL_PROVIDER = os.getenv("LLM_MODEL_PROVIDER", LLM_CHAT_PROVIDER)
LLM_MODEL = os.getenv("LLM_MODEL", LLM_CHAT_MODEL)

# ==============================================================================
# 6. STORAGE / INFRASTRUCTURE
# ==============================================================================
VECTOR_DB_PATH = os.getenv("VECTOR_DB_PATH", "./db/faiss_index")
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
