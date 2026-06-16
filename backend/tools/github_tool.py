"""
GitHub Repository Tool — search top-starred repositories for a topic.
Uses the public GitHub Search API. Authenticated if GITHUB_TOKEN is set.
"""
import os
import urllib.parse
import urllib.request
import json
from utils.logger import agent_logger

_GH_API = "https://api.github.com/search/repositories"


def search_github_repositories(topic: str, limit: int = 3) -> list:
    """
    Search GitHub for repositories sorted by stars.

    Args:
        topic: Technology, algorithm, or library name.
        limit: Max repos to return (default 3).

    Returns:
        List of {
            "full_name": str,
            "stars": int,
            "language": str | None,
            "description": str,
            "url": str
        }
    """
    topic = (topic or "").strip()
    if not topic:
        return []

    params = urllib.parse.urlencode({
        "q": topic,
        "sort": "stars",
        "order": "desc",
        "per_page": min(limit, 5),
    })
    url = f"{_GH_API}?{params}"

    headers = {
        "User-Agent": "NoteMind/1.0 (educational-tool)",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    # Use token if available to avoid rate limiting
    token = os.getenv("GITHUB_TOKEN", "")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        repos = []
        for item in data.get("items", [])[:limit]:
            repos.append({
                "full_name": item.get("full_name", ""),
                "stars": item.get("stargazers_count", 0),
                "language": item.get("language"),
                "description": (item.get("description") or "")[:200],
                "url": item.get("html_url", ""),
            })

        agent_logger.info(f"[GitHubTool] Found {len(repos)} repos for topic='{topic}'")
        return repos

    except Exception as exc:
        agent_logger.error(f"[GitHubTool] Exception: {exc}")
        return []
