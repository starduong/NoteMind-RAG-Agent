# Run Instructions for NoteMind

This document explains how to run the AI Research Assistant project locally.
It includes backend and frontend setup, environment configuration, and startup commands.

---

## 1. Prerequisites

- Python 3.8+ installed
- Node.js 18+ installed
- OpenAI API key
- Git installed (optional but recommended)

---

## 2. Backend Setup

### 2.1. Create and activate Python virtual environment

From the project root:

```bash
cd d:\05-06_HK2\AI-Research-Assistant-main
python -m venv venv
```

On Windows:

```powershell
venv\Scripts\activate
```

On macOS / Linux:

```bash
source venv/bin/activate
```

### 2.2. Install backend dependencies

```bash
cd backend
python -m pip install --upgrade pip
python -m pip install fastapi uvicorn python-dotenv openai numpy faiss-cpu pdfplumber python-docx beautifulsoup4
```

> Note: If `faiss-cpu` installation fails on your system, try a compatible wheel or use Conda to install FAISS.

### 2.3. Configure environment variables

Create a `.env` file in the project root (`d:\05-06_HK2\AI-Research-Assistant-main\.env`) with at least:

```env
OPENAI_API_KEY=your_openai_api_key
VECTOR_DB_PATH=./backend/db/faiss_index
REDIS_HOST=localhost
REDIS_PORT=6379
```

The backend reads `OPENAI_API_KEY`, plus optional values for `VECTOR_DB_PATH`, `REDIS_HOST`, and `REDIS_PORT`.

### 2.4. Start the backend

From the backend folder:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

By default the backend will listen on:

- `http://localhost:8000`

You can verify with:

```bash
curl http://localhost:8000/health
```

---

## 3. Frontend Setup

### 3.1. Install frontend dependencies

From the project root:

```bash
cd frontend
npm install
```

### 3.2. Start the frontend

```bash
npm run dev
```

The frontend will run on:

- `http://localhost:3000`

---

## 4. Usage

1. Start the backend first.
2. Start the frontend.
3. Open `http://localhost:3000` in your browser.
4. Use the app UI to upload supported documents and ask questions.

---

## 5. Supported document formats

- PDF (`.pdf`)
- Word document (`.docx`)
- HTML (`.html`, `.htm`)
- Plain text (`.txt`)

---

## 6. Key backend routes

- `GET /health` — health check
- `GET /documents` — list uploaded documents
- `POST /upload` — upload and index a document
- `POST /upload-v2` — multi-document upload with separate indexes

---

## 7. Troubleshooting

- If the backend fails to start, ensure `OPENAI_API_KEY` is set in `.env`.
- If the frontend cannot connect, confirm backend is running on port `8000`.
- If upload fails, verify the file extension is supported.

---

## 8. Optional improvements

- Add a `backend/requirements.txt` file for reproducible Python installs.
- Add a `frontend/.env.local` if the frontend needs custom API URL configuration.
- Use a dedicated Redis instance if you want to enable more scalable session state.
