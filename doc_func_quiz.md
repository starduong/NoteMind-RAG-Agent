# Tài liệu chức năng Quiz và flow agent

## 1. Mục đích chức năng Quiz

Chức năng Quiz của dự án giúp người dùng tạo bộ câu hỏi trắc nghiệm tự động từ tài liệu đã upload vào Notebook. Mục tiêu chính:

- Sinh câu hỏi/đáp án đúng với nội dung nguồn
- Kiểm định độ chính xác và chất lượng bằng chuỗi agent
- Hiển thị kết quả quiz dưới dạng tương tác trên frontend
- Duy trì session và metadata notebook để quiz gắn với nguồn tài liệu cụ thể

## 2. Điểm vào backend

### 2.1 Endpoint sử dụng

- `POST /notebooks/{notebook_id}/ask`

Chế độ `quiz` được gửi qua trường `mode`.

### 2.2 Payload request

- `query`: yêu cầu quiz, ví dụ "Tạo 5 câu hỏi trắc nghiệm về chương 2"
- `mode`: `quiz`
- `top_k`: số lượng chunk context truy xuất
- `session_id`: giữ session để lưu history
- `doc_ids`: danh sách doc ID nếu cần giới hạn nguồn

### 2.3 Response

Response trả về gồm:

- `answer`: nội dung quiz AI tạo ra
- `sources`: danh sách nguồn được sử dụng
- `workflow_log`: log tiến trình quiz agent
- `session_id`: session hiện tại
- `metadata`: thông tin phụ của workflow

## 3. Các agent tham gia workflow Quiz

### 3.1 Các module chính

- `backend/agents/quiz/workflow.py`
- `backend/agents/quiz/agents/generator.py`
- `backend/agents/quiz/agents/reviewer.py`
- `backend/agents/quiz/agents/formatter.py`
- `backend/agents/chat/agents/retriever.py`
- `backend/agents/shared/retrieval.py`
- `backend/agents/shared/prompts.py`

## 4. Flow agent chi tiết cho chế độ Quiz

### 4.1 Bước 0: Khởi tạo state và chọn workflow

Tương tự các mode khác, endpoint `POST /notebooks/{notebook_id}/ask` sẽ:

- tạo hoặc tái sử dụng `session_id`
- lưu user message vào conversation memory
- gọi `notebook_orchestrator.process(...)`
- `NotebookOrchestrator.process` chuẩn bị `NotebookState`
- `get_workflow("quiz")` trả về `run_quiz_workflow`

State ban đầu chứa:

- `notebook_id`, `user_query`, `mode`, `top_k`, `doc_ids`, `conversation_context`
- các trường output trống như `chunks`, `sources`, `final_answer`, `workflow_log`

### 4.2 Bước 1: Quiz Retriever

File: `backend/agents/chat/agents/retriever.py`

- Quiz workflow tái sử dụng `RetrieverAgent` của chat.
- Agent này gọi `VectorRetriever.search_multi_doc(...)` để lấy chunk có liên quan.
- `top_k` trong quiz mặc định được tăng thành `max(state.get("top_k", 5), 8)` để lấy nhiều context hơn.

Nội dung thu được:

- `chunks`: đoạn văn bản được truy xuất từ vector store
- `sources`: document tương ứng với từng chunk
- `searched_docs`: danh sách document được tìm kiếm

Nếu không tìm thấy chunk, workflow trả về lỗi và dừng.

### 4.3 Bước 2: Quiz Generator

File: `backend/agents/quiz/agents/generator.py`

- Agent này xây dựng prompt từ `QUIZ_GENERATOR_PROMPT`.
- Prompt chứa:
  - context: các chunk đã truy xuất nối với nhau bằng `---`
  - query: yêu cầu người dùng, hoặc mặc định `Create a quiz on the main topics`
- Gọi `generate_text(...)` với model cấu hình:
  - provider: `LLM_QUIZ_GEN_PROVIDER`
  - model: `LLM_QUIZ_GEN_MODEL`
- `temperature = 0.4` để tạo quiz có chút linh hoạt trong câu hỏi và đáp án.

Output: `draft` quiz thô.

### 4.4 Bước 3: Quiz Reviewer

File: `backend/agents/quiz/agents/reviewer.py`

- Agent này kiểm định quiz bằng prompt `QUIZ_REVIEWER_PROMPT`.
- Nó đưa vào cả `context` và `draft` để đảm bảo tính chính xác.
- Gọi `generate_text(...)` với model cấu hình:
  - provider: `LLM_QUIZ_REVIEW_PROVIDER`
  - model: `LLM_QUIZ_REVIEW_MODEL`
- `temperature = 0.2` để giảm độ sáng tạo, tập trung vào sửa lỗi và cải thiện độ chính xác.

Output: `reviewed` quiz.

### 4.5 Bước 4: Quiz Formatter

File: `backend/agents/quiz/agents/formatter.py`

- Agent định dạng kết quả thành markdown quiz chuẩn.
- Thêm header `# Quiz` và footer:
  - `Generated from {source_count} source(s) in this notebook.`
- Kết quả cuối cùng là `formatted` chứa nội dung quiz hiển thị rõ ràng.

## 5. Cơ chế workflow log

Trong `backend/agents/quiz/workflow.py`, các bước log như sau:

- `[Quiz] Retrieving source content...`
- `[Quiz] Generator: creating questions...`
- `[Quiz] Reviewer: validating accuracy...`
- `[Quiz] Formatter: finalizing output...`
- `[Quiz] Complete`

Log này được trả về backend và frontend hiển thị để theo dõi tiến trình.

## 6. Cấu hình model cho Quiz

File: `backend/config.py`

- `LLM_QUIZ_GEN_PROVIDER`: model provider cho sinh quiz. Mặc định sử dụng `LLM_STRUCTURED_PROVIDER`.
- `LLM_QUIZ_GEN_MODEL`: model sinh quiz. Mặc định sử dụng `LLM_STRUCTURED_MODEL`.
- `LLM_QUIZ_REVIEW_PROVIDER`: model provider để review quiz. Mặc định `LLM_UTILITY_PROVIDER`.
- `LLM_QUIZ_REVIEW_MODEL`: model review quiz. Mặc định `LLM_UTILITY_MODEL`.

Điều này cho thấy quiz mode dùng:

- lớp structured-output cho tạo nội dung có định dạng
- lớp utility để kiểm định chất lượng

## 7. Frontend hiển thị và trải nghiệm Quiz

### 7.1 Component QuizView

File: `frontend/components/views/QuizView.tsx`

- `QuizView` đọc message assistant cuối cùng có `role === "assistant"`.
- Cố gắng parse quiz JSON từ nội dung `message.content`.
- Nếu parse được, render từng câu hỏi trong `QuizCard`.
- Nếu không parse được, hiển thị fallback dưới dạng văn bản thuần.

### 7.2 Tương tác trên UI

- Người dùng có thể click chọn đáp án trên mỗi câu hỏi.
- Hiển thị trạng thái đúng/sai ngay lập tức.
- Người dùng có thể reveal giải thích dưới mỗi câu hỏi.
- Khi hoàn thành, hiển thị tỷ lệ đúng và nút làm lại.

### 7.3 Quick prompts

Trong `NotebookWorkspace.tsx`, `QUICK_PROMPTS.quiz` cung cấp sẵn tiêu đề:

- Tạo 5 câu hỏi trắc nghiệm kèm đáp án để kiểm tra kiến thức.
- Tạo đề thi tự luận ngắn về các khái niệm chính trong nguồn này.
- Tạo một quiz nhanh 3 câu hỏi độ khó nâng cao về tài liệu.

Những prompt này giúp user gửi yêu cầu quiz nhanh chóng mà không phải gõ tay.

### 7.4 Sử dụng dữ liệu nguồn

- `QuizView` cũng hiển thị trạng thái khi không có source.
- Nếu notebook chưa có tài liệu, user được nhắc upload trước khi tạo quiz.

## 8. Flow toàn bộ chức năng Quiz

1. User chọn mode `quiz` trong `NotebookWorkspace`
2. User nhập yêu cầu quiz hoặc click quick prompt
3. Frontend gọi `POST /notebooks/{notebook_id}/ask` với `mode: "quiz"`
4. Backend tạo/hồi phục session, lưu user message
5. Orchestrator gọi `run_quiz_workflow`
6. Retriever lấy chunks từ vector store
7. Generator tạo draft quiz từ context
8. Reviewer kiểm tra và chỉnh sửa quiz
9. Formatter định dạng quiz cuối cùng
10. Backend trả `answer` (quiz markdown), `workflow_log`, `session_id`
11. Frontend parse quiz và hiển thị interactive quiz cards

## 9. Xử lý lỗi và fallback

- Nếu quiz generator hoặc reviewer fail, workflow trả về lỗi và `status` là `error`.
- Frontend không parse được JSON quiz sẽ hiển thị nội dung thô trong `QuizView`.
- Điều này giữ app hoạt động ngay cả khi định dạng quiz AI trả về không chuẩn.

## 10. Ghi chú kỹ thuật

- Quiz mode là pipeline đa-agent nhưng vẫn nhẹ hơn research mode.
- Triển khai phân tách rõ 3 trách nhiệm:
  - Generator: tạo nội dung câu hỏi và đáp án
  - Reviewer: kiểm định và sửa sai
  - Formatter: định dạng kết quả trước khi trả về
- Cách thiết kế này giúp dễ mở rộng: có thể thêm agent kiểm tra mức độ khó, thêm loại câu hỏi, hoặc chuyển quiz sang định dạng khác.

## 11. Kết luận

Chức năng Quiz của dự án được xây dựng dưới dạng một workflow agent chuyên môn hóa. Nó sử dụng retrieval để grounding nội dung, sau đó tạo quiz có kiểm định và định dạng. Frontend hiển thị kết quả quiz tương tác và fallback an toàn khi đầu ra không theo chuẩn JSON.
