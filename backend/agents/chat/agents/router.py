import re


class IntentRouter:
    def __init__(self):
        self._greeting_pattern = re.compile(
            r"^(hi|hello|hey|xin chao|chao|chao ban|good (morning|afternoon|evening))[\s!.?]*$",
            re.IGNORECASE,
        )
        self._thanks_pattern = re.compile(
            r"^(thanks?|cam on|thank you|ok|okay|oke|vay thoi|duoc roi)[\s!.?]*$",
            re.IGNORECASE,
        )

    def route(self, query: str) -> dict:
        normalized = re.sub(r"\s+", " ", (query or "")).strip()
        if not normalized:
            return {
                "intent": "conversational",
                "needs_retrieval": False,
                "direct_answer": "Mình chưa nhận được câu hỏi cụ thể về tài liệu.",
            }

        lowered = normalized.lower()
        if self._greeting_pattern.match(lowered):
            return {
                "intent": "greeting",
                "needs_retrieval": False,
                "direct_answer": "Mình sẵn sàng hỗ trợ. Hãy hỏi một câu cụ thể về các tài liệu trong notebook.",
            }

        if self._thanks_pattern.match(lowered):
            return {
                "intent": "conversational",
                "needs_retrieval": False,
                "direct_answer": "Rất vui được hỗ trợ. Khi cần, bạn cứ hỏi tiếp về nội dung tài liệu.",
            }

        return {
            "intent": "factual_query",
            "needs_retrieval": True,
            "direct_answer": "",
        }
