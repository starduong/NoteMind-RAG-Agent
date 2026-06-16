"""
ToolRunner — detects which tools to call and runs them concurrently.
"""
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional

from tools.wikipedia_tool import fetch_wikipedia_summary
from tools.academic_tool import fetch_academic_papers
from tools.github_tool import search_github_repositories
from tools.youtube_tool import search_youtube_tutorials
from utils.logger import agent_logger


# ---------------------------------------------------------------------------
# Trigger patterns (Vietnamese + English)
# ---------------------------------------------------------------------------

_WIKI_PATTERNS = re.compile(
    r"là gì|nghĩa là|định nghĩa|khái niệm|giải thích|what is|explain|meaning of|thuật ngữ",
    re.IGNORECASE,
)

_GITHUB_PATTERNS = re.compile(
    r"\bcode\b|source code|chạy thử|implement|github|repo\b|thư viện|library|framework"
    r"|example|ví dụ code|mã nguồn",
    re.IGNORECASE,
)

_YOUTUBE_PATTERNS = re.compile(
    r"\bvideo\b|bài giảng|hướng dẫn|khó hiểu|trực quan|tutorial|lecture|watch|xem",
    re.IGNORECASE,
)

_ACADEMIC_PATTERNS = re.compile(
    r"bài báo|paper|nghiên cứu|research|citation|tài liệu gốc|nguồn gốc|bắt nguồn"
    r"|scholar|arxiv|publication|công trình",
    re.IGNORECASE,
)


def detect_tool_triggers(query: str) -> List[str]:
    """
    Analyse a user query and return a list of tool names to activate.

    Returns: subset of ["wikipedia", "github", "youtube", "academic"]
    """
    q = (query or "").strip()
    triggers: List[str] = []

    if _WIKI_PATTERNS.search(q):
        triggers.append("wikipedia")
    if _GITHUB_PATTERNS.search(q):
        triggers.append("github")
    if _YOUTUBE_PATTERNS.search(q):
        triggers.append("youtube")
    if _ACADEMIC_PATTERNS.search(q):
        triggers.append("academic")

    agent_logger.info(f"[ToolRunner] Detected triggers={triggers} for query='{q[:80]}'")
    return triggers


def _extract_main_concept(query: str) -> str:
    """
    Extract the most likely concept/keyword from the query for tool calls.
    Strips common filler words to get a clean search term.
    """
    stop_words = re.compile(
        r"\b(là gì|nghĩa là|giải thích|khái niệm|bài báo về|paper về|"
        r"code cho|repo về|video về|hướng dẫn|tutorial|có thể|"
        r"mình muốn|tôi muốn|cho mình|giúp tôi)\b",
        re.IGNORECASE,
    )
    cleaned = stop_words.sub("", query).strip(" ?.,!:")
    # Collapse extra spaces
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned or query


class ToolRunner:
    """Runs selected external tools concurrently and returns merged results."""

    def run(
        self,
        triggers: List[str],
        query: str,
        concept: Optional[str] = None,
    ) -> Dict:
        """
        Execute triggered tools in parallel via a thread pool.

        Args:
            triggers: List of tool names to run.
            query:    Raw user query (used for YouTube/GitHub/Academic search).
            concept:  Extracted concept for Wikipedia (falls back to query).

        Returns:
            Dict with keys matching triggered tool names:
            {
                "wikipedia": { title, summary, url, status } | None,
                "github":    [ { full_name, stars, language, description, url } ] | None,
                "youtube":   [ { title, video_id, thumbnail_url, ... } ] | None,
                "academic":  [ { title, authors, year, citation_count, ... } ] | None,
            }
        """
        if not triggers:
            return {}

        search_term = concept or _extract_main_concept(query)
        tools_data: Dict = {}

        task_map: Dict[str, callable] = {}
        if "wikipedia" in triggers:
            task_map["wikipedia"] = lambda: fetch_wikipedia_summary(search_term)
        if "github" in triggers:
            task_map["github"] = lambda: search_github_repositories(search_term)
        if "youtube" in triggers:
            task_map["youtube"] = lambda: search_youtube_tutorials(query)
        if "academic" in triggers:
            task_map["academic"] = lambda: fetch_academic_papers(search_term)

        with ThreadPoolExecutor(max_workers=len(task_map)) as executor:
            future_to_key = {
                executor.submit(fn): key for key, fn in task_map.items()
            }
            for future in as_completed(future_to_key):
                key = future_to_key[future]
                try:
                    result = future.result(timeout=12)
                    tools_data[key] = result
                    agent_logger.info(f"[ToolRunner] {key} completed")
                except Exception as exc:
                    agent_logger.error(f"[ToolRunner] {key} failed: {exc}")
                    tools_data[key] = None

        return tools_data
