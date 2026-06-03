# NoteMind

## Giới thiệu

Dự án NoteMind là một hệ thống backend + frontend sử dụng FastAPI cho API và Next.js cho giao diện. Dự án tích hợp Google AI Studio, GitHub Models (OpenAI-compatible) và các dịch vụ LLM khác.

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
