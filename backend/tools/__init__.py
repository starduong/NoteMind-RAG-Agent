"""
External tool integrations for NoteMind chat enrichment.
"""
from tools.wikipedia_tool import fetch_wikipedia_summary
from tools.academic_tool import fetch_academic_papers
from tools.github_tool import search_github_repositories
from tools.youtube_tool import search_youtube_tutorials

__all__ = [
    "fetch_wikipedia_summary",
    "fetch_academic_papers",
    "search_github_repositories",
    "search_youtube_tutorials",
]
