# Tài liệu giao diện frontend

## 1. Tổng quan

Frontend của dự án là một ứng dụng web Next.js + React + Tailwind CSS. Ứng dụng cung cấp:

- Dashboard quản lý notebook và session
- Workspace notebook để upload tài liệu, chọn mode truy vấn, gửi câu hỏi và xem kết quả
- Sidebar nguồn tài liệu và status agent
- Multi-agent graph / workflow log hiển thị tiến trình xử lý

## 2. Công nghệ sử dụng

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS 4
- Axios cho gọi API
- Lucide React icons
- Không có API route frontend; frontend gọi backend qua `process.env.NEXT_PUBLIC_API_URL`

## 3. Cấu trúc chính

- `frontend/pages/index.tsx`: trang dashboard chính và điểm vào workspace
- `frontend/components/NotebookWorkspace.tsx`: trang workspace notebook / conversation
- `frontend/components/AgentGraph.tsx`: hiển thị trạng thái pipeline multi-agent
- `frontend/pages/_app.tsx`: bootstrap app, chỉ render component

## 4. Luồng Dashboard (`frontend/pages/index.tsx`)

### 4.1 Khi mở app không có `notebook_id` hoặc `session_id`

- Trang dashboard tải:
  - danh sách notebook từ `GET /notebooks`
  - danh sách session từ `GET /sessions`
  - lịch sử session từ `GET /sessions/{session_id}/history`
- Hiển thị mỗi session với:
  - notebook liên quan
  - mode cuối cùng (`chat`, `research`, `quiz`, `roadmap`)
  - số lượng message, nguồn, thời điểm cập nhật

### 4.2 Chức năng chính

- Tạo notebook mới
  - `POST /notebooks`
  - sau đó chuyển hướng tới `/?notebook_id=...`
- Mở session/notebook
  - chuyển hướng tới workspace với query params `session_id` và optional `notebook_id`
- Xóa session
  - `DELETE /sessions/{sessionId}`
- Đổi tên notebook
  - `PATCH /notebooks/{notebookId}`

### 4.3 Tìm kiếm và bộ lọc

- Dashboard hỗ trợ tìm kiếm notebook/session theo tên notebook
- Hỗ trợ hiển thị theo dạng grid hoặc list (có biến viewType nhưng chưa thấy dùng sâu)

### 4.4 Điều kiện hiển thị workspace

- Nếu route có `notebook_id` hoặc `session_id`, `index.tsx` không render dashboard
- Thay vào đó render `NotebookWorkspace`

## 5. Luồng Notebook Workspace (`frontend/components/NotebookWorkspace.tsx`)

### 5.1 Khởi tạo và phục hồi

- Khi component mount:
  - gọi `GET /notebooks` để tải metadata notebook
  - nếu có query `notebook_id`, gọi `GET /notebooks/{notebookId}` để lấy thông tin chi tiết
  - nếu có `session_id`, gọi `GET /sessions/{sessionId}/history` để phục hồi lịch sử chat
- Dựa vào `session_id` và `notebook_id`, frontend có thể khôi phục conversation và mode đã dùng

### 5.2 State chính

- `notebooks`: danh sách notebook
- `activeNotebook`: notebook đang mở
- `mode`: một trong `chat`, `research`, `quiz`, `roadmap`
- `messages`: lịch sử chat hiển thị trên UI
- `input`: nội dung người dùng nhập
- `isProcessing`: trạng thái backend đang xử lý
- `workflowLog`: log luồng multi-agent từ backend
- `sessionId`: session hiện tại
- `uploading` / `uploadStatus`: cho upload source
- `showRightSidebar`, `rightSidebarTab`: điều khiển sidebar

### 5.3 Upload tài liệu nguồn

- Chức năng upload tài liệu trên sidebar trái
- Gọi `POST /notebooks/{notebookId}/sources/upload`
- Sau upload thành công:
  - reload notebook
  - refresh danh sách notebook
- Phần upload chấp nhận các định dạng PDF, DOCX, HTML, TXT

### 5.4 Quản lý nguồn tài liệu

- Sidebar trái liệt kê `activeNotebook.sources_detail`
- Có nút xóa nguồn tài liệu: `DELETE /notebooks/{notebookId}/sources/{docId}`
- Nút xóa chỉ hiển thị khi hover
- Nếu notebook chưa có tài liệu, hiển thị nhắc upload

### 5.5 Chuyển mode và gợi ý nhanh

- Thanh mode ở đầu workspace cho phép chuyển giữa 4 chức năng:
  - Hỏi đáp (`chat`)
  - Nghiên cứu (`research`)
  - Trắc nghiệm (`quiz`)
  - Lộ trình (`roadmap`)
- Mỗi mode có:
  - icon riêng
  - label
  - hint trạng thái
  - placeholder nhập liệu khác nhau
  - bộ prompt nhanh (`QUICK_PROMPTS`) để người dùng click nhanh

### 5.6 Gửi truy vấn

- Khi người dùng nhấn send hoặc Enter:
  - frontend gọi `POST /notebooks/{notebookId}/ask`
  - payload gồm:
    - `query`: câu hỏi hoặc yêu cầu
    - `mode`
    - `top_k`: 5
    - `session_id`: nếu đã có session
- Sau khi backend trả về:
  - `workflow_log` được lưu
  - `session_id` được lưu nếu backend trả về mới
  - message assistant được đổ vào `messages`

### 5.7 Hiển thị phản hồi và citations

- Chat history hiển thị user + assistant theo luồng
- Phản hồi assistant có thể bao gồm `sources`
- Agent link citations bằng các nút `[{n}]`
- Người dùng có thể click citation để mở popover giải thích nguồn và chuyển sang tab `sources`

### 5.8 Multi-agent status và workflow log

- Khi `isProcessing` bật và `multiAgentMode` bật:
  - hiển thị stepper Multi-Agent
  - bước được suy ra từ `getWorkflowSteps()` dựa trên `workflowLog`
  - các bước: `Researching`, `Summarizing`, `Critiquing`, `Editing`
- Nhờ vậy người dùng biết được backend đang chạy agent nào

### 5.9 Bắt đầu cuộc trò chuyện mới

- Nút `Bắt đầu Q&A mới` xóa history local và reset session
- Router sẽ chuyển về `/` để thoát workspace

## 6. Right Sidebar và AgentGraph

### 6.1 Chức năng sidebar

- Hiển thị bật/tắt bằng nút Eye/EyeOff
- Có hai tab:
  - `Agent Graph`: hiển thị tiến trình multi-agent
  - `Chi Tiết Chunk`: thông tin tài liệu và chunk index

### 6.2 AgentGraph

- File: `frontend/components/AgentGraph.tsx`
- Dùng `workflowLog` và `isProcessing` để tính trạng thái của 4 node:
  - Research Agent
  - Summarizer Agent
  - Critic Agent
  - Editor Agent
- Mỗi node có status: `idle`, `running`, `success`, `skipped`
- Log backend từ node research/summary/critic/editor quyết định trạng thái hiển thị
- Kết nối các node bằng đồ họa SVG, giúp người dùng thấy pipeline agent hiện tại

### 6.3 Chi Tiết Chunk

- Tab này hiển thị:
  - số chunks trong mỗi tài liệu
  - file type, chunk count
  - trạng thái “Đã nhúng (Indexed)”
  - xem trước một số chunk giả định
- Mục tiêu: minh bạch dữ liệu vector-level đang dùng cho retrieval

## 7. Các trạng thái UI quan trọng

### 7.1 Loading / processing

- `loading` ở dashboard khi fetch dữ liệu
- `isProcessing` ở workspace khi backend xử lý truy vấn
- UI hiển thị spinner và thông điệp agent đang tổng hợp

### 7.2 Upload feedback

- `uploadStatus` hiển thị thông báo thành công / lỗi sau khi upload
- trạng thái này sẽ tự ẩn sau 3 giây

### 7.3 Xử lý lỗi

- Nếu backend trả lỗi khi gửi truy vấn, message lỗi sẽ được hiển thị trong history assistant
- Nếu fetch notebook/session lỗi, console log sẽ ghi lại nhưng không crash UI

## 8. Route và navigation

- Application dùng query params để điều hướng:
  - `/?notebook_id=...` để mở notebook workspace
  - `/?session_id=...` để mở session cụ thể
- `index.tsx` quyết định hiển thị dashboard hay workspace dựa vào router query

## 9. Những phần frontend hiện có và chưa có

### Đã có

- Dashboard notebook/session
- Tạo notebook
- Mở session workspace
- Gọi API backend cho `ask`, upload, xóa nguồn
- Hiển thị history chat và sources
- Chuyển mode `chat/research/quiz/roadmap`
- Popover citation
- Multi-agent progress monitor
- Right sidebar với graph và chunk metadata

### Chưa rõ / có thể mở rộng

- `viewType` trong `index.tsx` đã khai báo nhưng chưa được render cụ thể
- Nếu muốn hỗ trợ upload trực tiếp ở dashboard hoặc search session nâng cao, cần thêm UI
- Hiện chưa có component hiển thị trực tiếp response source chunk nội dung gốc, chỉ hiển thị metadata chunk giả định

## 10. Kết luận

Frontend hiện tại là một ứng dụng workspace-centered. Giao diện phân chia rõ:

- Dashboard quản lý notebook/session
- Workspace đơn cho notebook với source upload, mode request, chat history
- Sidebar điều khiển nguồn và trạng thái agent

Luồng thao tác cụ thể:

1. Tạo hoặc chọn notebook trên dashboard
2. Upload tài liệu nguồn vào notebook
3. Chọn mode (chat, research, quiz, roadmap)
4. Nhập câu hỏi / yêu cầu và gửi
5. Backend trả kết quả, frontend hiển thị message, sources, workflow log
6. Xem sidebar graph để biết agent pipeline đã chạy những bước nào
