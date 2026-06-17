Dưới đây là nội dung thiết kế chi tiết được chuẩn hóa thành **3 Tác vụ (Tasks) rõ ràng** để bạn gắn thêm vào chức năng Quiz của hệ thống Multi-Agent, bao gồm cả Tool tìm kiếm link trắc nghiệm tham khảo bên ngoài mà bạn vừa yêu cầu:

---

### TASK 1: Tích hợp Tool Tìm kiếm Đề trắc nghiệm tham khảo ngoài (`search_external_quizzes`)

* **Mục đích:** Khi người dùng muốn luyện tập thêm hoặc làm các bộ đề trắc nghiệm chuẩn hóa có sẵn trên mạng (ví dụ: các đề thi trắc nghiệm IELTS, AWS, Quiz chuẩn chuyên ngành) mà tài liệu đầu vào chưa bao quát hết.
* **Kịch bản kích hoạt:** * Người dùng chủ động chat: *"Tìm thêm cho tôi vài link đề trắc nghiệm về chủ đề này trên mạng để làm thử"*.
* Hoặc hệ thống tự động đề xuất ở cuối bộ Quiz: *"Bạn đã hoàn thành bộ Quiz từ tài liệu. Bạn có muốn thử sức với các bộ đề trắc nghiệm mở rộng trên mạng không?"*


* **Hành động của Agent (Backend):** Agent nhận diện từ khóa/chủ đề khó trong chương, gọi API tìm kiếm (Google Custom Search API hoặc các nền tảng chia sẻ Quiz công khai) để lọc ra 3 đường link uy tín nhất.
* **Định dạng hiển thị trên UI (Frontend):** Trả về dạng danh sách thẻ (Card List). Mỗi thẻ bao gồm: Tiêu đề bộ đề (Ví dụ: *"100 câu trắc nghiệm Docker cơ bản - GeeksforGeeks"*), Mô tả ngắn, Nguồn (Domain) và Nút bấm chuyển hướng sang tab mới để user làm bài.

---

### TASK 2: Tích hợp Nhóm Tool Điều hướng & Cập nhật Lộ trình (`Adaptive Learning Tools`)

Đây là tác vụ cốt lõi giúp kết nối kết quả bài Quiz của người dùng với cấu trúc Lộ trình học tập (Roadmap) tổng thể, biến lộ trình thành một thực thể "động" biết tự co giãn theo năng lực của người học. Tác vụ này gồm 2 công cụ phối hợp:

* **Công cụ 1: Điều hướng lộ trình động (`trigger_roadmap_adaptation`)**
* *Kịch bản:* Người dùng nhấn nộp bài bộ Quiz của chặng hiện tại (Ví dụ: Tuần 1). Hệ thống ghi nhận điểm số của user **dưới 50%**. Agent nhận diện người dùng chưa đạt yêu cầu để học tiếp chặng sau.
* *Hành động:* Agent kích hoạt công cụ này để gửi một lệnh cập nhật (Payload) xuống cơ sở dữ liệu và Frontend: Tự động **"khóa"** (Lock) nội dung của Tuần 2 lại $\rightarrow$ Tự động **chèn thêm 2 ngày ôn tập bổ sung** vào lịch $\rightarrow$ Ra lệnh cho Agent tạo câu hỏi thiết lập một bộ Quiz phụ với độ khó dễ hơn để user gỡ điểm.


* **Công cụ 2: Ghi nhận lỗ hổng kiến thức (`log_knowledge_gap`)**
* *Kịch bản:* Trong bộ Quiz 10 câu, người dùng làm sai 3 câu liên tiếp thuộc cùng một khái niệm (Ví dụ: *"Cơ chế Viterbi decoding"*).
* *Hành động:* Hệ thống kích hoạt công cụ này để lưu các khái niệm bị sai vào **"Hồ sơ lỗ hổng kiến thức" (Knowledge Gap Profile)** của User trong Database. Thông tin này sẽ giúp Agent chat sau này biết tập trung giải thích kỹ hơn vào các phần user đang yếu khi họ quay lại hỏi bài.



---

### TASK 3: Mở rộng Cấu trúc dữ liệu JSON để nhúng metadata của Tool

Để Frontend có thể đọc, hiểu và render mượt mà các tính năng bổ trợ ở Task 1 và Task 2 mà không làm gãy cấu trúc giao diện hiện tại, bạn cần cấu trúc lại file JSON đầu ra của Agent như sau:

```json
{
  "question_id": "q_101",
  "question_text": "Dựa vào đoạn code dưới đây, lỗi Bug nào sẽ xảy ra khi chạy trên phần cứng Raspberry Pi 4?",
  "question_type": "multiple_choice",
  "has_attachment": true,
  "attachment": {
    "type": "code_snippet",
    "content": "import time\nwhile True:\n   pass # Code thiếu kiểm soát nhiệt độ"
  },
  "options": [
    {"id": "A", "text": "Overheating (Quá nhiệt)"},
    {"id": "B", "text": "Memory Leak (Rò rỉ bộ nhớ)"},
    {"id": "C", "text": "Syntax Error"}
  ],
  "correct_option": "A",
  "meta_tools": {
    "source_reference": {
      "page": 28, 
      "section": "Hardware Configuration",
      "note": "Hệ thống sẽ hiện nút 'Đọc lại tài liệu trang 28' nếu user chọn sai."
    },
    "on_failure_tools": [
      {
        "tool_name": "recommend_youtube_lesson",
        "query": "Raspberry Pi 4 thermal management"
      },
      {
        "tool_name": "search_external_quizzes",
        "query": "Raspberry Pi hardware quiz test"
      }
    ]
  }
}

```

**Cách Frontend xử lý dựa trên JSON này:**

1. Khi hiển thị câu hỏi, Frontend kiểm tra trường `"has_attachment": true` để render ra một khung chứa code đẹp mắt (`code_snippet`).
2. Khi người dùng bấm chọn đáp án và nộp bài:
* Nếu chọn **ĐÚNG (A)**: Frontend cộng điểm bình thường.
* Nếu chọn **SAI (B hoặc C)**: Giao diện lập tức kích hoạt vùng `"meta_tools"`. Nó sẽ hiện một dòng chữ: *"Hãy mở lại trang 28 mục Hardware Configuration để đọc lại"*