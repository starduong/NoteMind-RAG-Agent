import os
from dotenv import load_dotenv

# Nạp các biến môi trường từ file .env

load_dotenv()

# ==============================================================================

# 1. EMBEDDING CONFIGURATION

# ==============================================================================

# Mô hình embedding local được sử dụng xuyên suốt pipeline trích xuất vector.

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")

# ==============================================================================

# 2. LLM PROVIDERS CONFIGURATION (Hạ tầng Đám mây Kết hợp)

# ==============================================================================

# Cấu hình Google AI Studio (Tương thích chuẩn OpenAI Client)

GOOGLE_API_BASE = os.getenv("GOOGLE_API_BASE", "https://generativelanguage.googleapis.com/v1beta/openai/")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Cấu hình GitHub Models

GITHUB_BASE_URL = os.getenv("GITHUB_BASE_URL", "https://models.inference.ai.azure.com")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")

# Dự phòng OpenRouter (Nếu cần dùng cho các tác vụ mở rộng sau này)

OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")

# ==============================================================================

# 3. LAYER DEFAULTS (Chiến thuật phân bổ tải trọng phân lớp)

# ==============================================================================

# LỚP SUY LUẬN (Reasoning): Dùng bộ não logic và khả năng điều phối rất tốt của gpt-4o

LLM_REASONING_PROVIDER = "github"
LLM_REASONING_MODEL = "gpt-4o"

# LỚP NGỮ CẢNH LỚN (Long Context): Dùng Gemini 3.5 Flash với sức chứa 1 triệu tokens để nuốt tài liệu RAG

LLM_LONG_CONTEXT_PROVIDER = "google"
LLM_LONG_CONTEXT_MODEL = "gemini-3.5-flash"

# LỚP ĐỊNH DẠNG JSON (Structured): Ép cấu trúc JSON tạo Quiz/Roadmap bằng Gemini 3.5 Flash cực kỳ an toàn

LLM_STRUCTURED_PROVIDER = "google"
LLM_STRUCTURED_MODEL = "gemini-3.5-flash"

# LỚP TIỆN ÍCH & TIẾP NHẬN (Utility & Chat): Dùng gpt-4o-mini tốc độ cao, phản hồi nhanh dưới 1 giây

LLM_UTILITY_PROVIDER = "github"
LLM_UTILITY_MODEL = "gpt-4o-mini"

LLM_CHAT_PROVIDER = "github"
LLM_CHAT_MODEL = "gpt-4o-mini"

# ==============================================================================

# 4. AGENT MODEL MAPPING (Chỉ định đích danh Agent phụ trách)

# ==============================================================================

# --- Layer 1: Reasoning (Giám sát, Phản biện, Lập kế hoạch) ---

LLM_SUPERVISOR_PROVIDER = LLM_REASONING_PROVIDER
LLM_SUPERVISOR_MODEL = LLM_REASONING_MODEL

LLM_CRITIC_PROVIDER = LLM_REASONING_PROVIDER
LLM_CRITIC_MODEL = LLM_REASONING_MODEL

LLM_PLANNER_PROVIDER = LLM_REASONING_PROVIDER
LLM_PLANNER_MODEL = LLM_REASONING_MODEL

# --- Layer 2: Long-Context (Nghiên cứu sâu và Trả lời dựa trên tài liệu) ---

LLM_RESEARCH_PROVIDER = LLM_LONG_CONTEXT_PROVIDER
LLM_RESEARCH_MODEL = LLM_LONG_CONTEXT_MODEL # gemini-3.5-flash (Đọc văn bản dài từ Vector DB)

LLM_SUMMARY_PROVIDER = LLM_UTILITY_PROVIDER
LLM_SUMMARY_MODEL = LLM_UTILITY_MODEL # gpt-4o-mini (Tóm tắt nhanh)

LLM_CHAT_PROVIDER = LLM_CHAT_PROVIDER
LLM_CHAT_MODEL = LLM_CHAT_MODEL # gpt-4o-mini (Hội thoại tự do)

LLM_ANSWER_PROVIDER = LLM_CHAT_PROVIDER
LLM_ANSWER_MODEL = LLM_CHAT_MODEL # gpt-4o-mini (Đưa ra câu trả lời)

LLM_EDITOR_PROVIDER = LLM_UTILITY_PROVIDER
LLM_EDITOR_MODEL = LLM_UTILITY_MODEL # gpt-4o-mini (Chỉnh sửa văn phong)

# --- Layer 3: Structured-Output (Sinh Quiz và Lộ trình học tập JSON) ---

LLM_QUIZ_GEN_PROVIDER = LLM_STRUCTURED_PROVIDER
LLM_QUIZ_GEN_MODEL = LLM_STRUCTURED_MODEL # gemini-3.5-flash (Tạo cấu trúc Quiz gốc)

LLM_QUIZ_REVIEW_PROVIDER = LLM_UTILITY_PROVIDER
LLM_QUIZ_REVIEW_MODEL = LLM_UTILITY_MODEL # gpt-4o-mini (Duyệt lại lỗi chính tả, câu từ)

LLM_ROADMAP_RESOURCE_PROVIDER = LLM_STRUCTURED_PROVIDER
LLM_ROADMAP_RESOURCE_MODEL = LLM_STRUCTURED_MODEL # gemini-3.5-flash (Xây dựng các nấc thang lộ trình)

LLM_ROADMAP_REVIEW_PROVIDER = LLM_UTILITY_PROVIDER
LLM_ROADMAP_REVIEW_MODEL = LLM_UTILITY_MODEL # gpt-4o-mini (Rà soát lại tài nguyên lộ trình)

# --- Layer 4: Utility (Hậu xử lý phụ trợ) ---

LLM_CITATION_PROVIDER = LLM_UTILITY_PROVIDER
LLM_CITATION_MODEL = LLM_UTILITY_MODEL # gpt-4o-mini (Trích xuất nguồn dẫn)

# ==============================================================================

# 5. BACKWARD-COMPATIBILITY DEFAULTS (Hỗ trợ các hàm cũ gọi dạng đơn lẻ)

# ==============================================================================

LLM_MODEL_PROVIDER = LLM_CHAT_PROVIDER
LLM_MODEL = LLM_CHAT_MODEL

# ==============================================================================

# 6. STORAGE / INFRASTRUCTURE

# ==============================================================================

VECTOR_DB_PATH = os.getenv("VECTOR_DB_PATH", "./db/faiss_index")
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
