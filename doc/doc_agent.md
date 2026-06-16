# Tài liệu chi tiết `doc_agent.md`

## 1. Mục đích

Tài liệu này mô tả luồng hoạt động hiện tại của các task trong dự án AI Research Assistant, tập trung vào cách backend điều phối nhiều agent khác nhau cho từng tính năng.

## 2. Kiến trúc điều phối agent

### 2.1 Orchestrator

- `backend/agents/supervisor/orchestrator.py`
  - `NotebookOrchestrator`: xử lý notebook workflow theo `mode` và `notebook_id`.
  - `LegacyOrchestrator`: xử lý endpoint cũ `ask-agents` và `ask-v2` bằng graph nghiên cứu.
- Orchestrator tạo trạng thái ban đầu và chọn workflow bằng `agents.supervisor.workflow_factory.get_workflow(mode)`.

### 2.2 Factory workflow

- `backend/agents/supervisor/workflow_factory.py`
  - `chat` → `run_chat_workflow`
  - `research` → `run_research_workflow`
  - `quiz` → `run_quiz_workflow`
  - `roadmap` → `run_roadmap_workflow`
- `normalize_mode` trong `backend/agents/supervisor/routing.py` chuẩn hóa tên mode đầu vào.

### 2.3 State chung

- `backend/agents/shared/state.py`
  - `NotebookState`: trạng thái chung cho các workflow notebook, chứa `user_query`, `mode`, `doc_ids`, `chunks`, `sources`, `workflow_log`, `final_answer`, v.v.
  - `ResearchState`: trạng thái chuyên cho research graph của `ask-agents` / `ask-v2`.
  - `create_initial_state(...)`: tạo state trình điều khiển cho notebook capability.

## 3. Các task backend chính

### 3.1 `POST /upload` và `POST /upload-v2`

- Nhiệm vụ: nhận file tài liệu và tạo embedding để index nội dung.
- `backend/main.py` xử lý:
  - xác thực định dạng file (`SUPPORTED_EXTENSIONS`)
  - lưu tạm file vào hệ thống
  - trích xuất văn bản từ `backend/utils/document_parser.py`
  - chia text thành `chunks`
  - tạo embedding cho mỗi chunk bằng `backend/utils/embeddings.py`
  - lưu vector và metadata vào FAISS index qua `backend/db/faiss_store.py`
- Khác biệt:
  - `/upload` lưu chung một index toàn cục
  - `/upload-v2` hướng tới lưu trữ multi-doc với mỗi tài liệu hoặc nhóm tài liệu riêng biệt

### 3.2 `POST /ask-agents`

- Nhiệm vụ: trả lời truy vấn bằng luồng multi-agent từ đầu đến cuối.
- Quy trình:
  1. Tạo hoặc lấy session từ `backend/db/sqlite_memory.py`
  2. Lưu câu hỏi người dùng vào lịch sử conversation
  3. Lấy `conversation_context` từ lịch sử trước đó
  4. Gọi `orchestrator.process_query(...)`
  5. Trả về kết quả gồm `answer`, `sources`, `workflow_log`
- Multi-agent pipeline chính trong `backend/agents/research/graph.py`:
  1. `research` node: `ResearcherAgent` tìm nội dung liên quan trong FAISS hoặc multi-doc
  2. `summarize` node: `SummarizerAgent` tổng hợp báo cáo từ chunks
  3. `critic` node: `CriticAgent` đánh giá chất lượng và phát hiện gap
  4. `edit` / `skip_edit` node: `EditorAgent` lọc lại nếu cần, hoặc bỏ qua nếu không cần chỉnh sửa

### 3.3 `POST /ask-v2`

- Nhiệm vụ: xử lý truy vấn trên danh sách tài liệu (`doc_ids`) đã chọn, hỗ trợ multi-document.
- Quy trình tương tự `ask-agents` nhưng luôn dùng `use_multi_doc=True` khi gọi `ResearcherAgent`:
  - `research_graph` có thể tìm kiếm trong nhiều tài liệu đồng thời
  - `searched_docs` ghi lại danh sách tài liệu đã sử dụng
- Đây là task chuyên cho trường hợp notebook nhiều nguồn hoặc truy vấn tập tài liệu.

### 3.4 Notebook capability

- `NotebookOrchestrator.process(...)` dùng cho workflow notebook theo `mode` (chat/research/quiz/roadmap).
- Nếu notebook không có nguồn thì trả lỗi yêu cầu upload nguồn trước.
- Nó xây dựng state và chọn workflow phù hợp.

## 4. Các workflow capability và chuỗi agent

### 4.1 Chat workflow

- File: `backend/agents/chat/workflow.py`
- Agents tham gia:
  - `RetrieverAgent`: tìm các chunk tương tự từ `VectorRetriever`
  - `AnswerAgent`: tạo câu trả lời dựa trên chunks và conversation context
  - `CitationAgent`: gắn nguồn tham chiếu vào kết quả
- Luồng:
  1. truy xuất nội dung phù hợp từ notebook sources
  2. nếu không tìm được chunk thì lỗi
  3. gọi LLM tạo câu trả lời có grounded trên context
  4. tạo citation rồi đóng workflow
- Đây là luồng chat Q&A nhẹ, phù hợp khi cần trả lời trực tiếp dựa trên tài liệu.

### 4.2 Research workflow

- File: `backend/agents/research/workflow.py` và `backend/agents/research/graph.py`
- Thiết kế bằng `LangGraph` với 5 node:
  - `research` → `summarize` → `critique` → conditional(`edit` / `skip_edit`)
- Agents tham gia:
  - `ResearcherAgent`: thu thập chunk từ FAISS hoặc multi-doc
  - `SummarizerAgent`: tổng hợp báo cáo nghiên cứu từ chunk
  - `CriticAgent`: đánh giá báo cáo, phát hiện gap và đề xuất sửa
  - `EditorAgent`: chỉnh sửa hoàn thiện nếu cần
- Mô tả chi tiết:
  1. `ResearcherAgent.research(...)` tìm nhiều chunk liên quan, chứa `sources` và `num_chunks_found`
  2. `SummarizerAgent.summarize(...)` gọi LLM để tạo `initial_summary`
  3. `CriticAgent.critique(...)` kiểm tra chất lượng, xác định `has_gaps`
  4. Nếu `has_gaps=True`, đi vào node `edit`; nếu không, đi thẳng `skip_edit`
  5. `EditorAgent.edit(...)` trả về `final_answer`
- Ưu điểm: workflow có điều kiện, giúp phát hiện và chỉnh sửa lại kết quả trước khi trả về.

### 4.3 Quiz workflow

- File: `backend/agents/quiz/workflow.py`
- Agents tham gia:
  - `RetrieverAgent`: lấy nội dung đầu vào
  - `QuizGeneratorAgent`: tạo đề bài quiz từ context
  - `QuizReviewerAgent`: kiểm tra tính chính xác và độ phù hợp
  - `QuizFormatterAgent`: chuẩn hoá định dạng đầu ra
- Luồng:
  1. lấy nội dung từ notebook sources
  2. tạo draft quiz bằng LLM
  3. review quiz để giảm lỗi và tăng chất lượng
  4. format output thành quiz hoàn chỉnh
- Task này là multi-agent theo chuỗi rõ ràng: `Generator → Reviewer → Formatter`.

### 4.4 Roadmap workflow

- File: `backend/agents/roadmap/workflow.py`
- Agents tham gia:
  - `RetrieverAgent`: thu thập nội dung liên quan
  - `RoadmapPlannerAgent`: xây dựng hành trình/phases
  - `RoadmapResourceAgent`: bổ sung tài nguyên, ví dụ hoạt động và công cụ
  - `RoadmapReviewerAgent`: đánh giá logic và mức độ grounded
  - `RoadmapFormatterAgent`: định dạng roadmap hoàn chỉnh
- Luồng:
  1. lấy nội dung liên quan
  2. tạo kế hoạch roadmap ban đầu
  3. enrich bằng tài nguyên phù hợp
  4. review lại roadmap để đảm bảo logic
  5. format lại thành kết quả cuối
- Task này là pipeline đa agent với từng bước chuyên trách rõ ràng.

## 5. Mối liên kết giữa các module task

### 5.1 Retrieval chung

- `backend/agents/shared/retrieval.py` chứa `VectorRetriever` dùng cho cả Chat, Quiz, Roadmap và Research.
- `RetrieverAgent` và `ResearcherAgent` đều dùng `VectorRetriever` để truy xuất chunk từ FAISS.
- Điều này đảm bảo tất cả workflow đều cùng nguồn dữ liệu và grounding.

### 5.2 Lưu trữ session và context

- `backend/db/sqlite_memory.py` lưu lịch sử message của session.
- `backend/main.py` lấy `conversation_context` từ session để agent trả lời có ngữ cảnh.
- Workflow note: `chat` và `research` có thể dùng context lịch sử để cải thiện nhất quán và continuity.

### 5.3 Notebook vs Legacy task

- Notebook task qua `NotebookOrchestrator` tập trung vào notebook-specific mode và nguồn đã gắn với `notebook_id`.
- Legacy task qua `LegacyOrchestrator` vẫn hỗ trợ `ask-agents` và `ask-v2` với graph research không cần notebook.
- Cả hai đều dùng cùng bộ agent nhưng khác cách khởi tạo state và target source.

## 6. Quy trình multi-agent tổng quát

### 6.1 Định nghĩa "multi-agent" trong dự án

- Mỗi task không chỉ là một lời gọi LLM đơn thuần.
- Dự án tổ chức các agent nhỏ, mỗi agent chịu trách nhiệm một bước:
  - tìm kiếm dữ liệu
  - tạo nội dung ban đầu
  - review / critic
  - chỉnh sửa hoặc format
  - gắn citation hoặc enrich
- Một task hoàn chỉnh là chuỗi agent đi qua nhiều bước, có thể điều kiện/đi nhánh.

### 6.2 Các vai trò agent cụ thể

- `ResearcherAgent`: tạo đầu vào chuẩn cho downstream workflow.
- `SummarizerAgent`, `AnswerAgent`, `QuizGeneratorAgent`, `RoadmapPlannerAgent`: tạo nội dung chính.
- `CriticAgent`, `QuizReviewerAgent`, `RoadmapReviewerAgent`: đánh giá chất lượng và phát hiện lỗi.
- `EditorAgent`, `QuizFormatterAgent`, `RoadmapFormatterAgent`, `CitationAgent`: hoàn thiện output.

### 6.3 Kết quả và logging

- Mỗi workflow xây dựng `workflow_log` để ghi lại từng bước đã chạy.
- Kết quả cuối cùng bao gồm:
  - `final_answer`
  - `sources` hoặc `citations`
  - `workflow_log`
  - `metadata` bổ sung khi có

## 7. Tổng kết

- `ask-agents` / `ask-v2` là hai task core dạng research multi-agent.
- `chat`, `quiz`, `roadmap`, `research` là capability notebook, mỗi capability là một pipeline agent đầy đủ.
- Dự án thiết kế rõ ràng chuỗi agent: thu thập dữ liệu → tạo draft → review → hoàn thiện.
- Multi-agent được dùng để tách trách nhiệm và tăng độ tin cậy, tránh việc dùng một prompt đơn lẻ cho toàn bộ nghiệp vụ.

## 8. Gợi ý mở rộng

- Nếu muốn mở rộng thêm task mới, chỉ cần:
  1. thêm workflow mới trong `agents/supervisor/workflow_factory.py`
  2. định nghĩa `run_*_workflow` trong `agents/<task>/workflow.py`
  3. tạo agent nhỏ cho từng bước chức năng
  4. dùng `NotebookState` để truyền dữ liệu và `workflow_log` để theo dõi
