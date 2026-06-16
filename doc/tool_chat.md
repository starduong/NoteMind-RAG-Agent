Dưới đây là thiết kế sơ lược mẫu (Blueprint) cho 4 công cụ (Tools) bạn chọn, được trình bày hoàn toàn dưới dạng văn bản Markdown cấu trúc để bạn dễ dàng lưu trữ và thiết kế hệ thống:

---

### 1. Tool Tra cứu Wikipedia (`fetch_wikipedia_summary`)

* **Mục đích:** Trích xuất định nghĩa nhanh cho các thuật ngữ học thuật, khái niệm khó xuất hiện trong tài liệu.
* **Tham số đầu vào (Input):**
* `concept` (Văn bản): Thuật ngữ hoặc khái niệm cần tra cứu (Ví dụ: *"Transformer model"*, *"Deep Learning"*).
* `language` (Văn bản): Ngôn ngữ tra cứu (Mặc định: *"vi"* cho Tiếng Việt hoặc *"en"* cho Tiếng Anh).


* **Luồng xử lý ở Backend:**
1. Tiếp nhận thuật ngữ từ Agent.
2. Gọi đến API của Wikipedia theo ngôn ngữ được chọn.
3. Trích xuất lấy 2 đến 3 câu tóm tắt đầu tiên (để làm phần giải thích ngắn gọn).
4. Lấy thêm liên kết (URL) đến bài viết gốc.


* **Đầu ra mong muốn (Output):** Trả về tiêu đề bài viết, đoạn tóm tắt ngắn và đường link chi tiết.

---

### 2. Tool Tìm bài báo khoa học (`fetch_academic_papers`)

* **Mục đích:** Tìm kiếm các bài báo, công trình nghiên cứu chính thống phục vụ cho việc đào sâu nghiên cứu thuật toán.
* **Tham số đầu vào (Input):**
* `query` (Văn bản): Từ khóa thuật toán hoặc chủ đề nghiên cứu (Ví dụ: *"Viterbi decoding NLP"*).
* `limit` (Số nguyên): Số lượng bài báo tối đa cần trả về (Mặc định là 3).


* **Luồng xử lý ở Backend:**
1. Tiếp nhận từ khóa nghiên cứu.
2. Gọi API đến các kho dữ liệu khoa học công khai (như Semantic Scholar hoặc arXiv).
3. Lọc danh sách bài báo dựa trên độ liên quan của từ khóa.
4. Trích xuất các trường thông tin: Tên bài báo, Danh sách tác giả, Năm xuất bản, Số lượt trích dẫn (Citation count), và Đường link trực tiếp đến file PDF (nếu có bản mở tự do - Open Access).


* **Đầu ra mong muốn (Output):** Danh sách các bài báo kèm đầy đủ thông tin trích dẫn chuẩn hóa để hiển thị cho người dùng.

---

### 3. Tool Tìm kiếm Repository GitHub (`search_github_repositories`)

* **Mục đích:** Tìm kiếm các kho mã nguồn mở có lượt Star cao để người dùng có code thực tế để chạy thử và cài đặt.
* **Tham số đầu vào (Input):**
* `topic` (Văn bản): Tên công nghệ, thuật ngữ, thuật toán hoặc thư viện (Ví dụ: *"CRF suite"*, *"YOLOv8"*).


* **Luồng xử lý ở Backend:**
1. Tiếp nhận tên công nghệ từ Agent.
2. Gọi API tìm kiếm của GitHub (`https://api.github.com/search/repositories`).
3. Thêm tham số sắp xếp theo số lượng Star (`sort=stars`) giảm dần để lấy các dự án uy tín nhất.
4. Giới hạn lấy 3 kết quả đầu tiên.
5. Trích xuất các thông tin: Tên đầy đủ của Kho mã nguồn (Repo name), Số lượng Star, Ngôn ngữ lập trình chính, Mô tả ngắn và Đường dẫn (URL) đến dự án.


* **Đầu ra mong muốn (Output):** Cấu trúc danh sách dự án sạch để Frontend đóng gói thành các thẻ GitHub Card.

---

### 4. Tool Tìm kiếm Video YouTube (`search_youtube_tutorials`)

* **Mục đích:** Tìm kiếm các video bài giảng, hướng dẫn trực quan sinh động khi người dùng kêu khó hiểu tài liệu chữ.
* **Tham số đầu vào (Input):**
* `query` (Văn bản): Từ khóa bài học cần tìm video hướng dẫn (Ví dụ: *"Cơ chế Attention giải thích dễ hiểu"*).


* **Luồng xử lý ở Backend:**
1. Tiếp nhận từ khóa tìm kiếm.
2. Gọi API tra cứu của YouTube (YouTube Data API v3 hoặc các thư viện cào dữ liệu an toàn).
3. Cấu hình bộ lọc: Chỉ lấy định dạng Video (`type=video`), số lượng tối đa là 3, sắp xếp theo độ liên quan lớn nhất.
4. Trích xuất các thông tin quan trọng: Tiêu đề video, Đường dẫn ảnh thu nhỏ (Thumbnail URL), Tên kênh phát sóng (Channel Title), và ID video để tạo đường dẫn xem trực tiếp.


* **Đầu ra mong muốn (Output):** Danh sách 3 video chất lượng nhất phục vụ việc hiển thị giao diện dạng lưới/thẻ video trực quan trong khung chat.


Để nhúng 4 công cụ này vào khung chat một cách hợp lý và mượt mà, bạn cần giải quyết hai bài toán lớn: **Logic nhận diện khi nào cần gọi tool (Backend)** và **Cách hiển thị công cụ đó mà không làm đứt gãy mạch hội thoại (Frontend)**.

Dưới đây là giải pháp thiết kế toàn diện từ luồng xử lý đến giao diện người dùng:

---

### 1. Phân tầng kích hoạt Tool theo Ý định (Intent-based Trigger)

Không phải lúc nào người dùng chat hệ thống cũng gọi cả 4 tools vì điều này sẽ gây nhiễu thông tin và tốn chi phí API. Multi-Agent cần đóng vai trò là một "người điều phối" tinh tế dựa vào từ khóa (Trigger Words) hoặc ngữ cảnh:

* **Trường hợp 1: Thuật ngữ mới hoặc quá hàn lâm**
* *Dấu hiệu từ user:* "Đoạn này nhắc đến CRF/Viterbi nghĩa là gì?", "Thuật ngữ X là gì?", "Từ này dùng thế nào?"
* *Tool kích hoạt:* Ưu tiên chạy `fetch_wikipedia_summary` trước để lấy định nghĩa. Nếu là thuật ngữ kỹ thuật chuyên sâu, chạy song song với `search_github_repositories`.


* **Trường hợp 2: Biểu hiện sự bế tắc, khó hiểu lý thuyết**
* *Dấu hiệu từ user:* "Khó hiểu quá", "Đọc mãi không hình dung được", "Có cách nào dễ hiểu hơn không?"
* *Tool kích hoạt:* Chạy `search_youtube_tutorials` để tìm video bài giảng trực quan.


* **Trường hợp 3: Muốn đào sâu nghiên cứu hoặc làm báo cáo**
* *Dấu hiệu từ user:* "Thuật toán này bắt nguồn từ đâu?", "Có cải tiến nào mới không?", "Tìm thêm tài liệu nghiên cứu phần này."
* *Tool kích hoạt:* Chỉ kích hoạt `fetch_academic_papers`.



---

### 2. Thiết kế giao diện hiển thị trong khung Chat (UI/UX Component)

Điểm mấu chốt để việc nhúng tool trở nên "hợp lý" là **định dạng hiển thị**. Bạn không nên đổ một đống link thô ra màn hình chat. Hãy biến các kết quả trả về từ API thành các **Component giao diện** độc lập:

#### A. Đối với Wikipedia: Dạng "Tooltip" hoặc "Hộp thoại định nghĩa (Popover)"

* **Cách nhúng:** Khi Agent trả lời, thay vì viết một đoạn dài, các từ khóa thuật ngữ sẽ được bôi đậm hoặc gạch chân đứt quãng (Ví dụ: Conditional Random Fields).
* **Trải nghiệm:** Khi người dùng di chuột (Hover) hoặc chạm vào từ đó, một bong bóng nhỏ (Tooltip) sẽ hiện lên chứa 2 câu tóm tắt nhanh từ Wikipedia và một nút nhỏ "Đọc thêm". Cách này giúp luồng chat cực kỳ sạch sẽ.

#### B. Đối với YouTube và GitHub: Dạng "Thẻ chức năng (Card Grid)"

* **Cách nhúng:** Kết quả trả về nằm ngay phía dưới đoạn văn bản trả lời của Agent. Thiết kế theo dạng lưới từ trái qua phải (Carousel/Slider) để người dùng vuốt ngang.
* *Thẻ YouTube:* Gồm hình ảnh thu nhỏ (Thumbnail), thời lượng, tên kênh và nút "Xem video".
* *Thẻ GitHub:* Gồm tên dự án (ví dụ: `keras-team/keras-contrib`), số lượng Star (để tăng uy tín), ngôn ngữ sử dụng (Python/C++) và mô tả ngắn.

#### C. Đối với Bài báo khoa học: Dạng "Thư mục trích dẫn (Citation List)"

* **Cách nhúng:** Hiển thị thu gọn ở cuối câu trả lời dưới dạng một danh sách có icon hình cuốn sách hoặc biểu tượng PDF.
* **Trải nghiệm:** Người dùng click vào sẽ mở rộng ra xem đầy đủ tên tác giả, năm và nút **"Tải trực tiếp PDF"** màu nổi bật để họ download ngay lập tức mà không phải chuyển trang.

---

### 3. Kịch bản một cuộc hội thoại mẫu hoàn chỉnh

Để bạn dễ hình dung sản phẩm cuối cùng hoạt động ra sao:

1. **Người dùng gõ:** *"Tôi đang đọc đến chương 2 phần mô hình mạng LSTM, nhưng tài liệu viết toàn công thức toán khó hiểu quá. Có code chạy thử không bạn?"*
2. **Hệ thống xử lý (Backend):** * Agent nhận diện ý định: User đang gặp khó hiểu (`LSTM`) + Muốn thực hành (`code chạy thử`).
* Agent ra lệnh gọi đồng thời 2 công cụ: `search_youtube_tutorials(query="LSTM giải thích dễ hiểu")` và `search_github_repositories(topic="LSTM scratch python")`.


3. **Phản hồi hiển thị (Frontend):**
* **Bot trả lời:** *"Mô hình LSTM đúng là khá trừu tượng vì cấu trúc các cổng toán học của nó. Để giúp bạn dễ hình dung, tôi đã tìm một video bài giảng trực quan và một số kho mã nguồn mở chạy thử dưới đây:"*
* **Ngay dưới câu chữ:** Hiện ra 1 video YouTube có thumbnail bắt mắt dạng thẻ. Kế bên cạnh là 2 thẻ GitHub chứa các repo có từ 1k+ Stars để user lựa chọn.



### Mẹo triển khai kỹ thuật (Tech-tip):

Khi xây dựng API cho khung chat, cấu trúc dữ liệu trả về từ Backend nên tách biệt giữa phần chữ (`text`) và phần dữ liệu của công cụ (`metadata` hoặc `attachments`).

Ví dụ:

```json
{
  "message_id": "123",
  "text": "Dưới đây là tài liệu bổ trợ cho bạn...",
  "has_tools": true,
  "tools_data": {
    "youtube": [ {...}, {...} ],
    "github": [ {...} ]
  }
}

```

Khi Frontend nhận được cấu trúc này, nó sẽ tự động render các component giao diện tương ứng vào cuối hộp thoại chat, tạo cảm giác hệ thống cực kỳ thông minh và chủ động hỗ trợ người học.