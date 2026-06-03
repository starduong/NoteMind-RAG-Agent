# Tài liệu chức năng Chat và flow agent

## 1. Mục đích chức năng Chat

Chức năng Chat trong dự án cho phép người dùng đặt câu hỏi trực tiếp lên bộ tài liệu đã upload vào Notebook. Mục tiêu chính là:

- Trả lời questions với ngữ cảnh tài liệu đã được nhúng vector
- Giữ phiên làm việc (session) để tái sử dụng lịch sử hội thoại
- Đảm bảo căn cứ vào nguồn tài liệu và gắn citations
- Hiển thị flow agent để người dùng thấy trạng thái xử lý

## 2. Kiến trúc backend và entrypoint

### 2.1 Endpoint chính

- `POST /notebooks/{notebook_id}/ask`

Đây là endpoint frontend gọi khi user gửi câu hỏi trong workspace notebook.

### 2.2 Payload request

Yêu cầu gửi lên gồm các trường:

- `query`: nội dung câu hỏi hoặc yêu cầu
- `mode`: chế độ hoạt động (`chat`, `research`, `quiz`, `roadmap`)
- `top_k`: số lượng chunk truy xuất từ vector store
- `session_id`: session hiện tại (nếu đã có)
- `doc_ids`: danh sách document IDs để giới hạn truy vấn nguồn (optional)

### 2.3 Response chính

Response trả về gồm các trường:

- `answer`: đáp án assistant trả về
- `sources`: danh sách document source liên quan
- `workflow_log`: log tiến trình agent
- `session_id`: session được sử dụng hoặc tạo mới
- `metadata`: thông tin phụ như `mode`, `notebook_id`, `num_chunks`

## 3. Luồng xử lý tổng quan

### 3.1 Từ frontend đến backend

1. Người dùng nhập câu hỏi trên `NotebookWorkspace`
2. `sendMessage()` gọi `POST /notebooks/{notebook_id}/ask`
3. Backend nhận request, tạo hoặc xác thực `session_id`
4. Lưu user message vào `conversation_memory`
5. Gọi `notebook_orchestrator.process(...)`
6. Orchestrator chọn workflow theo `mode`
7. Thực hiện workflow chat: Retriever → Answer → Citation
8. Lưu assistant message vào conversation memory
9. Trả response cho frontend

### 3.2 Các thành phần chính trong backend

- `backend/main.py`
  - định nghĩa endpoint `ask_notebook`
  - xử lý session và history
  - gọi orchestrator
- `backend/agents/supervisor/orchestrator.py`
  - `NotebookOrchestrator.process(...)`
  - chọn workflow dựa trên mode
- `backend/agents/supervisor/workflow_factory.py`
  - `get_workflow("chat")` tải `run_chat_workflow`
- `backend/agents/chat/workflow.py`
  - định nghĩa luồng chat cụ thể
- `backend/agents/chat/agents/retriever.py`
  - lấy context từ vector store
- `backend/agents/chat/agents/answer.py`
  - gọi LLM để sinh câu trả lời
- `backend/agents/chat/agents/citation.py`
  - gắn sources và tạo danh sách citation
- `backend/agents/shared/retrieval.py`
  - logic truy vấn FAISS / multi-doc store
- `backend/db/sqlite_memory.py`
  - lưu lịch sử session và tạo context hội thoại

## 4. Flow agent chi tiết cho mode Chat

### 4.1 Khởi tạo state

Trong `NotebookOrchestrator.process(...)`:

- Kiểm tra notebook tồn tại
- Kiểm tra notebook đã có sources chưa
- Tạo state ban đầu bằng `create_initial_state(...)`
- `state` chứa:
  - `notebook_id`, `user_query`, `mode`, `top_k`, `conversation_context`, `doc_ids`
  - `chunks`, `sources`, `retrieved_context`, `workflow_log`
  - `final_answer`, `citations`, `status`

### 4.2 Chọn workflow

Function `get_workflow(mode)` trả về hàm xử lý tương ứng. Với `mode = "chat"`, workflow là `run_chat_workflow`.

### 4.3 Bước 1: Retriever agent

File: `backend/agents/chat/agents/retriever.py`

- Agent gọi `VectorRetriever.search_multi_doc(...)`
- `VectorRetriever` thực hiện:
  - generate embedding của câu hỏi từ `utils.embeddings.get_embedding`
  - tìm kiếm trên multi-document vector store
  - trả về `chunks`, `sources`, `distances`, `searched_docs`

Nếu không tìm được chunk nào, workflow trả về lỗi: `No relevant content found in notebook sources.`

### 4.4 Bước 2: Answer agent

File: `backend/agents/chat/agents/answer.py`

- Agent tạo prompt với:
  - `conversation_context` nếu có
  - `context`: các chunk truy xuất được nối với nhau
  - `Question: {query}`
- Prompt có luật rõ ràng:
  - chỉ trả lời dựa trên context
  - nếu thông tin không có trong context thì trả lời rõ ràng
- Gọi `chat_complete(...)` với model và provider cấu hình
- Đặt `temperature = 0.2` để giảm độ sáng tạo và tăng tính chính xác

Output: `answer` thô.

### 4.5 Bước 3: Citation agent

File: `backend/agents/chat/agents/citation.py`

- Agent thu thập danh sách nguồn tài liệu duy nhất từ `sources`
- Dùng prompt `CITATION_PROMPT` để tạo văn bản cuối cùng có mục `## Sources`
- Nếu LLM citation fail, fallback vẫn trả về answer gốc kèm footer sources

Output: `final_answer`, `citations`

### 4.6 Kết thúc workflow

`run_chat_workflow` cập nhật state với:

- `chunks`, `sources`, `retrieved_context`
- `num_chunks_found`, `searched_docs`
- `final_answer`, `citations`
- `workflow_log`
- `status = "complete"`

Orchestrator rồi trả về JSON response chuẩn.

## 5. Các luồng phụ trợ và metadata

### 5.1 Workflow log

- `workflow_log` ghi lại từng bước agent thực hiện:
  - `[Chat] Retriever: searching knowledge base...`
  - `[Chat] Retriever: found X chunks`
  - `[Chat] Answer: generating response...`
  - `[Chat] Citation: attaching sources...`
  - `[Chat] Complete`
- Frontend dùng log này để hiển thị tiến trình agent.

### 5.2 Conversation memory

- Backend lưu message user và assistant vào `conversation_memory`
- `conversation_memory.get_context(session_id, max_messages=10)` tạo ngữ cảnh hội thoại cho LLM
- Điều này giúp:
  - giữ mạch hội thoại liên tục
  - thêm thông tin lịch sử khi cần

### 5.3 Session và history

- `session_id` được tạo khi bắt đầu chat nếu chưa có
- Frontend lưu session để tiếp tục hội thoại
- `GET /sessions/{session_id}/history` phục hồi lại toàn bộ history

## 6. Frontend và điểm nối chức năng Chat

### 6.1 Component chính

- `frontend/components/NotebookWorkspace.tsx`
  - quản lý state notebook, session, messages, mode và workflow log
  - `sendMessage()` gọi backend
  - `renderMessageContent()` hiển thị citation token
  - `getWorkflowSteps()` chuyển `workflow_log` thành trạng thái stepper

### 6.2 Cách hiển thị citation

- UI tách text theo token `[(\d+)]`
- Mỗi số citation hiển thị dưới dạng button
- Khi click, popover hiện tên source tương ứng

### 6.3 Chuyển mode

- `chat` là chế độ hỏi đáp nhanh.
- `research`, `quiz`, `roadmap` sử dụng workflow khác nhưng vẫn dùng cùng endpoint `ask`
- Frontend đổi `mode` và gửi request tương ứng

## 7. Error handling

### 7.1 Lỗi backend

- Notebook không tồn tại → trả `400`
- Notebook chưa có source → trả `400`
- Không tìm thấy nội dung liên quan → trả `400`
- Lỗi agent / LLM → trả `500` hoặc `400` tùy tình huống

### 7.2 Hiển thị lỗi trên frontend

- Nếu request fail, `sendMessage()` thêm một message assistant chứa chi tiết lỗi
- Người dùng vẫn thấy conversation history và có thể thử lại

## 8. Sơ đồ chức năng Chat

### 8.1 Tóm tắt flow

1. User nhấn gửi câu hỏi
2. Frontend gọi `/notebooks/{notebook_id}/ask`
3. Backend tạo session + lưu user message
4. Orchestrator chuyển vào `run_chat_workflow`
5. Retriever tìm chunk
6. Answer sinh nội dung từ chunk
7. Citation gắn sources
8. Backend trả kết quả và lưu assistant message
9. Frontend hiển thị answer + citation + workflow log

### 8.2 Mô hình agent

- Retriever Agent: truy vấn vector store
- Answer Agent: sinh trả lời bằng LLM
- Citation Agent: gắn nguồn và định dạng

## 9. Ghi chú quan trọng

- Chức năng Chat không tự do trả lời ngoài tài liệu; nó bị giới hạn bởi context retrieval.
- Conversation history được đưa vào prompt nhằm giữ ngữ cảnh cuộc hội thoại.
- `workflow_log` là thành phần quan trọng giúp UI trình bày quá trình multi-agent.
- `top_k` quyết định độ sâu của retrieval; mặc định là `5`.

## 10. Kết luận

Chức năng Chat là một pipeline agent nhẹ, tập trung vào Q&A:

- frontend gửi query lên notebook API
- backend dùng session memory + retriever
- agent kết hợp retrieval/LLM/citation
- response được trả kèm sources và log workflow

Tài liệu này cho thấy rõ các điểm nối giữa UI, endpoint, orchestrator và từng agent trong flow Chat.
