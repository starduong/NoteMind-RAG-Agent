import re
from typing import Any, Dict, List


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def _clip_text(value: str, max_chars: int) -> str:
    value = _normalize_text(value)
    if len(value) <= max_chars:
        return value
    return value[: max_chars - 3].rstrip() + "..."


def build_memory_payload(
    messages: List[Dict[str, Any]],
    max_recent_messages: int = 6,
    max_summary_messages: int = 8,
    max_message_chars: int = 240,
) -> Dict[str, Any]:
    if not messages:
        return {
            "conversation_context": "",
            "conversation_summary": "",
            "recent_messages": [],
        }

    sanitized_messages: List[Dict[str, Any]] = []
    for msg in messages:
        role = str(msg.get("role", "")).strip().lower()
        content = _normalize_text(str(msg.get("content", "")))
        if role not in {"user", "assistant"} or not content:
            continue
        sanitized_messages.append({"role": role, "content": content})

    if not sanitized_messages:
        return {
            "conversation_context": "",
            "conversation_summary": "",
            "recent_messages": [],
        }

    recent_messages = sanitized_messages[-max_recent_messages:]
    summary_candidates = sanitized_messages[:-max_recent_messages]

    summary_parts: List[str] = []
    if summary_candidates:
        for msg in summary_candidates[-max_summary_messages:]:
            speaker = "User" if msg["role"] == "user" else "Assistant"
            summary_parts.append(f"- {speaker}: {_clip_text(msg['content'], max_message_chars)}")

    recent_parts = [
        f"{'User' if msg['role'] == 'user' else 'Assistant'}: {_clip_text(msg['content'], max_message_chars)}"
        for msg in recent_messages
    ]

    sections: List[str] = []
    summary_text = "\n".join(summary_parts)
    if summary_text:
        sections.append("Conversation summary:\n" + summary_text)
    if recent_parts:
        sections.append("Recent messages:\n" + "\n".join(recent_parts))

    return {
        "conversation_context": "\n\n".join(sections),
        "conversation_summary": summary_text,
        "recent_messages": recent_messages,
    }
