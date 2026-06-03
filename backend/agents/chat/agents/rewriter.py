import json
from typing import Any, Dict, List

from config import LLM_UTILITY_MODEL, LLM_UTILITY_PROVIDER
from utils.llm_client import chat_complete
from utils.logger import agent_logger


class QueryRewriteAgent:
    def __init__(self):
        self.name = "Chat Rewriter"
        agent_logger.info(f"{self.name} initialized")

    def rewrite(
        self,
        query: str,
        conversation_context: str = "",
        recent_messages: List[Dict[str, Any]] | None = None,
    ) -> dict:
        normalized_query = (query or "").strip()
        if not normalized_query:
            return {
                "status": "success",
                "standalone_query": "",
                "intent": "conversational",
                "keywords": [],
                "needs_retrieval": False,
            }

        prompt = (
            "Rewrite the current user question into a standalone query for document retrieval.\n"
            "Return valid JSON only with keys: standalone_query, intent, keywords, needs_retrieval.\n"
            "Rules:\n"
            "- Keep the original language.\n"
            "- Resolve pronouns and follow-up references using the conversation.\n"
            "- Do not add facts not present in the conversation.\n"
            "- intent must be one of: greeting, conversational, factual_query, summarization, comparison, brainstorming.\n"
            "- keywords must be a short list of retrieval terms.\n"
            "- needs_retrieval must be true unless the message is casual or non-document-oriented.\n\n"
            f"Conversation context:\n{conversation_context or '(empty)'}\n\n"
            f"Current query:\n{normalized_query}"
        )

        try:
            content, _usage = chat_complete(
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You rewrite follow-up questions for grounded retrieval. "
                            "Respond with strict JSON only."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                model=LLM_UTILITY_MODEL,
                provider=LLM_UTILITY_PROVIDER,
                temperature=0,
            )
            parsed = self._parse_json(content)
            standalone_query = str(parsed.get("standalone_query") or normalized_query).strip()
            intent = str(parsed.get("intent") or "factual_query").strip() or "factual_query"
            keywords = parsed.get("keywords") or []
            if not isinstance(keywords, list):
                keywords = []
            keywords = [str(item).strip() for item in keywords if str(item).strip()]
            needs_retrieval = bool(parsed.get("needs_retrieval", True))
            return {
                "status": "success",
                "standalone_query": standalone_query or normalized_query,
                "intent": intent,
                "keywords": keywords,
                "needs_retrieval": needs_retrieval,
            }
        except Exception as exc:
            agent_logger.warning(f"{self.name}: rewrite fallback due to {exc}")
            fallback = self._fallback_rewrite(normalized_query, recent_messages or [])
            return {"status": "success", **fallback}

    def _parse_json(self, content: str) -> Dict[str, Any]:
        text = (content or "").strip()
        if not text:
            raise ValueError("Empty rewrite response")

        if text.startswith("```"):
            lines = [line for line in text.splitlines() if not line.strip().startswith("```")]
            text = "\n".join(lines).strip()

        return json.loads(text)

    def _fallback_rewrite(
        self,
        query: str,
        recent_messages: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        last_user_topic = ""
        for msg in reversed(recent_messages):
            if msg.get("role") == "user":
                candidate = str(msg.get("content", "")).strip()
                if candidate and candidate != query:
                    last_user_topic = candidate
                    break

        lowered = query.lower()
        if last_user_topic and any(token in lowered for token in ["no ", "nó", "it", "they", "them", "that", "đó", "cái này"]):
            standalone_query = f"{query} (ngữ cảnh tham chiếu: {last_user_topic})"
        else:
            standalone_query = query

        return {
            "standalone_query": standalone_query,
            "intent": "factual_query",
            "keywords": [],
            "needs_retrieval": True,
        }
