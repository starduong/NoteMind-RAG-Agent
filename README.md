# NoteMind

NoteMind là một hệ thống **RAG Agent (Retrieval-Augmented Generation) & Note-Taking Assistant** thông minh, kết hợp sức mạnh của các mô hình ngôn ngữ lớn (LLMs) với hệ thống tìm kiếm ngữ cảnh cục bộ và các công cụ tra cứu thời gian thực. Hệ thống hỗ trợ người dùng quản lý kiến thức, tóm tắt tài liệu, và truy vấn thông tin đa nguồn một cách hiệu quả.

---

## 🚀 Tổng quan dự án

NoteMind được xây dựng dưới dạng ứng dụng Full-Stack (Frontend & Backend độc lập) với các chức năng chính:
- **Hệ thống RAG nâng cao (Retrieval-Augmented Generation)**: Hỗ trợ tải lên, phân tích cú pháp nâng cao và lập chỉ mục ngữ cảnh cho nhiều định dạng tài liệu (PDF, Word, Excel, PPTX, HTML, v.v.) vào cơ sở dữ liệu vector cục bộ (FAISS) sử dụng các mô hình nhúng tiên tiến (`BAAI/bge-m3`).
- **Orchestration Agent thông minh**: Sử dụng **LangGraph** để điều phối tác vụ chat, tự động quyết định gọi các công cụ ngoài (Wikipedia, GitHub, Tìm kiếm học thuật, v.v.) dựa trên câu hỏi của người dùng.
- **Tích hợp đa LLMs**: Hỗ trợ Google AI Studio (Gemini), GitHub Models (Azure Inference), OpenRouter, và các mô hình chạy cục bộ thông qua `llama-cpp-python`.
- **Giao diện người dùng hiện đại**: Cung cấp trải nghiệm chat mượt mà, hiển thị tiến trình suy nghĩ/chạy công cụ của Agent, hỗ trợ hiển thị Markdown, công thức toán học và trích dẫn nguồn tài liệu tham khảo rõ ràng.

---

## 🛠️ Công nghệ và Thư viện sử dụng

### 1. Backend (Python/FastAPI)
- **Core Web Framework**: `FastAPI`, `Uvicorn` (Xây dựng API hiệu năng cao, tài liệu hóa tự động bằng OpenAPI/Swagger).
- **Agentic AI & LLMs**: `LangGraph` (Điều phối luồng Agent), `google-genai` SDK, `openai` SDK (Kết nối GitHub Models và OpenRouter), `llama-cpp-python` (Chạy mô hình cục bộ).
- **Vector Database & Embeddings**: `FAISS` (Cơ sở dữ liệu vector cục bộ để tìm kiếm tương đồng), `sentence-transformers` (Sử dụng model `BAAI/bge-m3` tạo embedding chất lượng cao).
- **Xử lý tài liệu nâng cao**: 
  - `unstructured`, `pdfplumber`, `pdfminer.six` (Phân tích cú pháp PDF).
  - `python-docx`, `python-pptx`, `openpyxl` (Đọc các file Office Word, PowerPoint, Excel).
  - `trafilatura`, `beautifulsoup4` (Thu thập và trích xuất nội dung văn bản từ các trang web chất lượng cao).
  - `pytesseract` (Hỗ trợ OCR hình ảnh/tài liệu quét).
  - `langchain-core` & `langchain-community` (Hỗ trợ Semantic Chunking và xử lý văn bản).

### 2. Frontend (React/Next.js)
- **Framework & Routing**: `Next.js 15` (App Router), `React 19`.
- **Styling & UI**: `Tailwind CSS 4.x`, `Framer Motion` (Hiệu ứng animation mượt mà), `Radix UI` (Thành phần giao diện nguyên bản), `Lucide React` (Icon hệ thống).
- **Quản lý dữ liệu**: `@tanstack/react-query` (Caching, đồng bộ trạng thái server), `Axios` (Client HTTP).
- **Đọc & Trình diễn**: `react-markdown`, `remark-gfm` (Render Markdown, bảng biểu, trích dẫn chuyên nghiệp).

---

## 🏆 Kết quả đạt được
- **Trải nghiệm đàm thoại thông minh**: Hệ thống không chỉ trả lời dựa trên dữ liệu tĩnh mà còn tự động tìm kiếm thông tin học thuật, GitHub, hoặc Wikipedia khi phát hiện câu hỏi cần dữ liệu cập nhật hoặc chuyên môn sâu.
- **Tìm kiếm ngữ cảnh chuẩn xác**: Khả năng semantic search trên các file tài liệu lớn giúp trả lời câu hỏi trực tiếp dựa trên nội dung tài liệu tải lên (PDF, Word, Excel...) kèm theo chỉ dẫn chính xác nguồn thông tin tham khảo.
- **Giao diện tối ưu và trực quan**: Người dùng có thể theo dõi từng bước xử lý của Agent (đang tìm kiếm tài liệu, đang truy cập Wikipedia, đang suy nghĩ...) mang lại trải nghiệm tương tác minh bạch và hiện đại.

---

## Yêu cầu môi trường

- Python 3.11+ (khuyến nghị)
- Node.js 20+
- pip
- npm hoặc pnpm

---

## Cài đặt

1. Clone repository:

```bash
git clone <repo-url>
cd NoteMind
```

2. Cài thư viện Python cho backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

3. Cài dependencies frontend:

```bash
cd ..\frontend
npm install
```

> Lưu ý: frontend cần `npm install` để cài tất cả package trước khi chạy `npm run dev`.

---

## Cấu hình API key

Dự án sử dụng biến môi trường trong file `.env` ở thư mục gốc.

### 1. Google AI Studio (Gemini)

- Truy cập vào **Google AI Studio**: https://aistudio.google.com/
- Đăng nhập bằng tài khoản Google của bạn.
- Nhấp vào nút **"Get API key"** ở góc trên bên trái.
- Chọn **"Create API key"**, chọn dự án phù hợp và nhấn tạo key.
- Sao chép Key và dán vào file `.env`:

```env
GEMINI_API_KEY=your_google_ai_studio_api_key
GOOGLE_API_BASE=https://generativelanguage.googleapis.com/v1beta/openai/
```

> Lưu ý: `GOOGLE_API_BASE` đã có giá trị mặc định trong cấu hình, chỉ cần đổi khi bạn dùng endpoint tùy chỉnh.

### 2. GitHub Models / GitHub inference

Dự án dùng endpoint OpenAI-compatible của GitHub Models qua Azure.

- Tạo token truy cập phù hợp từ GitHub:
  - `Settings` > `Developer settings` > `Personal access tokens`
  - Hoặc dùng token GitHub Models / Copilot nếu tổ chức đã cấp.
- Nếu bạn có endpoint riêng (ví dụ `https://models.inference.ai.azure.com`), giữ giá trị mặc định hoặc thay bằng endpoint của bạn.
- Thêm vào `.env`:

```env
GITHUB_TOKEN=your_github_models_token
GITHUB_BASE_URL=https://models.inference.ai.azure.com
```

> Nếu bạn không có GitHub Models, có thể dùng fallback OpenRouter với `OPENROUTER_API_KEY`.

### 3. Ví dụ `.env`

```env
EMBEDDING_MODEL=BAAI/bge-m3

# Google AI Studio
GOOGLE_API_BASE=https://generativelanguage.googleapis.com/v1beta/openai/
GEMINI_API_KEY=your_google_api_key

# GitHub Models
GITHUB_BASE_URL=https://models.inference.ai.azure.com
GITHUB_TOKEN=your_github_token

# OpenRouter (tùy chọn)
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_API_KEY=your_openrouter_key
```

---

## Chạy dự án

### Backend

```bash
cd backend
.venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Sau khi chạy, API backend sẽ có tại:

- `http://localhost:8000/health`
- `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm run dev
```

Frontend mặc định chạy tại `http://localhost:3000`.
