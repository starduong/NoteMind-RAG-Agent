import os
from google import genai
from dotenv import load_dotenv  # <-- Thêm dòng này

# Tự động tìm và nạp các biến trong file .env vào hệ thống
load_dotenv()  # <-- Thêm dòng này

api_key = os.getenv("GEMINI_API_KEY", "")

if not api_key:
    print(
        "❌ LỖI: Chưa tìm thấy biến môi trường GEMINI_API_KEY. Hãy kiểm tra lại file .env hoặc lệnh export!"
    )
    exit()

print("⚡ Đang kết nối tới Google AI Studio...")
client = genai.Client(api_key=api_key)

try:
    # 2. Gọi model gemini-2.5-flash với câu hỏi đơn giản
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="Hello! Bạn có nghe rõ không? Hãy phản hồi ngắn gọn bằng tiếng Việt.",
    )

    # 3. In kết quả trả về từ Google Server
    print("\n✅ Kết nối thành công! AI phản hồi:")
    print("-" * 40)
    print(response.text)
    print("-" * 40)

except Exception as e:
    print(f"\n❌ Đã xảy ra lỗi khi gọi API: {e}")
