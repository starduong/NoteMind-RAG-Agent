# Tổng quan dự án NoteMind

## 1. Mục tiêu chính

Dự án là một trợ lý nghiên cứu AI cho phép người dùng upload tài liệu, index nội dung thành vector embedding, và sau đó truy vấn thông tin bằng các workflow AI.

## 2. Kiến trúc tổng thể

Dự án chia làm hai phần chính:

- `backend/`: API Python + AI orchestration + document processing
- `frontend/`: giao diện web xây dựng bằng Next.js và React

## 3. Backend

### 3.1 Công nghệ chính

- Python
- FastAPI
- Uvicorn
- Pydantic
- FAISS (vector search)
- NumPy
- OpenAI-compatible client (dùng Ollama)
- Transformers, torch, sentence-transformers
- Tài liệu: `pdfplumber`, `python-docx`, `beautifulsoup4`

### 3.2 Cấu trúc chính

- `backend/main.py`
  - Khởi tạo FastAPI
  - CORS mở để phát triển
  - Các endpoint chính:
    - `GET /health`
    - `GET /documents`
    - `POST /upload`
    - `POST /upload-v2`
- `backend/utils/`
  - `document_parser.py`: trích xuất text từ PDF/DOCX/HTML/TXT, chia chunk
  - `embeddings.py`: tạo vector embedding cho từng chunk
  - `llm_client.py`: kết nối tới LLM qua Ollama/OpenAI-compatible API
  - `logger.py`: ghi log API
- `backend/db/`
  - `faiss_store.py`: lưu/đọc FAISS index và metadata
  - `sqlite_memory.py`: quản lý bộ nhớ session, history
  - `notebook_store.py`: quản lý notebook và nguồn tài liệu
  - `multi_doc_store.py`: lưu trữ nhiều tài liệu riêng biệt
- `backend/agents/`
  - `supervisor/orchestrator.py`: điều phối notebook workflow và legacy workflow
  - `research/`, `quiz/`, `roadmap/`, `chat/`: các workflow chuyên biệt cho nhiệm vụ AI

### 3.3 Luồng xử lý backend

1. Người dùng upload tài liệu.
2. Backend nhận file, xác thực định dạng, lưu file tạm.
3. Trích xuất văn bản và chia thành đoạn nhỏ.
4. Tạo embedding cho từng đoạn.
5. Lưu embedding vào FAISS index.
6. Cập nhật metadata và danh sách tài liệu.

### 3.4 Luồng AI và notebook

- `NotebookOrchestrator` xử lý truy vấn notebook bằng workflow theo mode:
  - `chat`
  - `research`
  - `quiz`
  - `roadmap`
- Workflow có thể lấy nhiều nguồn, tìm chunk tương tự, gọi LLM, và trả về câu trả lời cùng nguồn tham chiếu.
- `LegacyOrchestrator` duy trì khả năng tương thích với các endpoint cũ và research graph.

## 4. Frontend

### 4.1 Công nghệ chính

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS 4
- Axios
- @tanstack/react-query
- Framer Motion
- Lucide icons

### 4.2 Cấu trúc chính

- `frontend/pages/index.tsx`
  - Dashboard chính
  - Hiển thị danh sách sessions và notebooks
  - Tạo notebook mới
  - Xóa session
  - Đổi tên notebook
  - Fetch dữ liệu từ backend bằng API
- `frontend/components/NotebookWorkspace.tsx`
  - Thành phần workspace chính (làm việc với notebook và query)

### 4.3 Luồng tương tác

1. Người dùng mở app trên frontend.
2. Frontend gọi API backend để lấy dữ liệu notebooks và sessions.
3. Người dùng tạo notebook, mở session, hoặc thực hiện truy vấn.
4. Frontend gửi yêu cầu tới backend qua Axios.
5. Backend xử lý và trả về kết quả AI.
6. Frontend hiển thị câu trả lời, trạng thái session, và nguồn tài liệu.

## 5. Lưu ý quan trọng

- `README.md` và `doc_overview.md` ban đầu trống, vì vậy nội dung này dựa trên mã nguồn thực tế.
- Ứng dụng hiện tập trung vào workflow nghiên cứu AI, quản lý notebook/session, và tìm kiếm tài liệu dựa trên vector embedding.

## 6. Cách chạy nhanh

- Backend: chạy `uvicorn main:app --reload --port 8000` trong thư mục `backend`
- Frontend: chạy `npm run dev` trong thư mục `frontend`
- API mặc định có thể kết nối tới backend tại `http://localhost:8000`
- LLM mặc định kết nối tới Ollama tại `http://localhost:11434/v1`
