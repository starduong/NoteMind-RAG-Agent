import os
import json
from openai import OpenAI
from dotenv import load_dotenv

# 1. Nạp biến môi trường từ file .env
load_dotenv()


def test_github_models():
    # 2. Lấy Token từ file .env
    github_token = os.getenv("GITHUB_TOKEN")
    github_base_url = "https://models.inference.ai.azure.com"

    if not github_token:
        print("❌ LỖI: Chưa tìm thấy biến GITHUB_TOKEN trong file .env!")
        print("Vui lòng bổ sung dòng: GITHUB_TOKEN=github_pat_... vào file .env")
        return

    print("⚡ Đang kết nối tới GitHub Models thông qua Azure Infrastructure...")

    # 3. Khởi tạo OpenAI Client trỏ về hạ tầng GitHub
    client = OpenAI(base_url=github_base_url, api_key=github_token)

    # ==========================================================================
    # TEST TÁC VỤ 1: Kiểm tra phản hồi Text thuần túy (Dùng GPT-4o-mini)
    # ==========================================================================
    print("\n🎬 [Test 1] Gửi câu hỏi test hội thoại thường (gpt-4o-mini)...")
    try:
        text_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": "Hello GitHub Model! Phản hồi ngắn gọn bằng tiếng Việt nếu bạn nghe rõ.",
                }
            ],
            temperature=0.5,
        )
        print("✅ Test 1 Thành công! AI phản hồi:")
        print(f"--- '{text_response.choices[0].message.content}'")

    except Exception as e:
        print(f"❌ Test 1 Thất bại. Lỗi: {e}")
        return

    # ==========================================================================
    # TEST TÁC VỤ 2: Ép xuất cấu trúc JSON cho lớp Quiz/Roadmap (Dùng GPT-4o-mini)
    # ==========================================================================
    print("\n🎬 [Test 2] Kiểm tra ép cấu trúc JSON (Structured Output)...")

    prompt_quiz = "Tạo 1 câu hỏi trắc nghiệm về lập trình Python cho lớp Quiz."
    system_instruction = (
        "Bạn là AI chuyên gia giáo dục của hệ thống NoteMind. "
        "Luôn luôn trả về kết quả dưới dạng một JSON object duy nhất, "
        "chứa các key chính xác sau: 'question' (chuỗi), 'options' (mảng gồm 4 chuỗi), 'correct_answer' (chuỗi)."
    )

    try:
        json_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt_quiz},
            ],
            # Kích hoạt tính năng ép định dạng JSON cứng từ gốc của OpenAI SDK
            response_format={"type": "json_object"},
            temperature=0.3,
        )

        raw_content = json_response.choices[0].message.content
        print("✅ Test 2 Thành công! Dữ liệu JSON thô nhận được từ Cloud:")
        print("-" * 50)
        print(raw_content)
        print("-" * 50)

        # Thử nghiệm Parse chuỗi JSON thành Dict trong Python để đảm bảo không lỗi cú pháp
        parsed_json = json.loads(raw_content)
        print("🎉 Thử nghiệm Parse JSON thành công! Kiểm tra cấu trúc key:")
        print(f" -> Key 'question': {parsed_json.get('question')}")
        print(f" -> Key 'options': {parsed_json.get('options')}")
        print(f" -> Key 'correct_answer': {parsed_json.get('correct_answer')}")

    except json.JSONDecodeError:
        print(
            "❌ Lỗi: AI trả về chuỗi có dạng JSON nhưng không thể parse được (vỡ định dạng)!"
        )
    except Exception as e:
        print(f"❌ Test 2 Thất bại. Lỗi: {e}")


# Chạy file test
if __name__ == "__main__":
    test_github_models()
