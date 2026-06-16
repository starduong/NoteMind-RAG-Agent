"""
YouTube Tutorial Tool — search for educational videos on a topic.

Strategy:
  1. If YOUTUBE_API_KEY is set → use YouTube Data API v3 (official).
  2. Otherwise → use YouTube search scraper via web (lightweight fallback).
"""
import os
import re
import json
import urllib.parse
import urllib.request
from utils.logger import agent_logger

_YT_API = "https://www.googleapis.com/youtube/v3/search"


def _search_via_api(query: str, limit: int) -> list:
    """Official YouTube Data API v3."""
    api_key = os.getenv("YOUTUBE_API_KEY", "")
    params = urllib.parse.urlencode({
        "part": "snippet",
        "q": query,
        "type": "video",
        "maxResults": limit,
        "order": "relevance",
        "key": api_key,
    })
    url = f"{_YT_API}?{params}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "NoteMind/1.0", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=8) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    results = []
    for item in data.get("items", [])[:limit]:
        snippet = item.get("snippet", {})
        video_id = item.get("id", {}).get("videoId", "")
        if not video_id:
            continue
        results.append({
            "title": snippet.get("title", ""),
            "video_id": video_id,
            "thumbnail_url": snippet.get("thumbnails", {}).get("medium", {}).get("url", ""),
            "channel_title": snippet.get("channelTitle", ""),
            "watch_url": f"https://www.youtube.com/watch?v={video_id}",
        })
    return results


def _search_via_scraper(query: str, limit: int) -> list:
    """
    Lightweight fallback — parse YouTube search page for video metadata.
    Does NOT require an API key.
    """
    encoded = urllib.parse.quote_plus(query)
    url = f"https://www.youtube.com/results?search_query={encoded}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "vi,en;q=0.9",
        },
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        html = resp.read().decode("utf-8")

    # YouTube embeds initial data as a JSON blob in a script tag
    match = re.search(r"var ytInitialData = ({.+?});</script>", html, re.DOTALL)
    if not match:
        return []

    try:
        yt_data = json.loads(match.group(1))
    except json.JSONDecodeError:
        return []

    # Navigate to video renderers
    contents = (
        yt_data.get("contents", {})
        .get("twoColumnSearchResultsRenderer", {})
        .get("primaryContents", {})
        .get("sectionListRenderer", {})
        .get("contents", [])
    )

    videos = []
    for section in contents:
        items = (
            section.get("itemSectionRenderer", {}).get("contents", [])
        )
        for item in items:
            vr = item.get("videoRenderer")
            if not vr:
                continue
            video_id = vr.get("videoId", "")
            if not video_id:
                continue

            title_runs = vr.get("title", {}).get("runs", [])
            title = title_runs[0].get("text", "") if title_runs else ""

            thumbnails = vr.get("thumbnail", {}).get("thumbnails", [])
            thumbnail_url = thumbnails[-1].get("url", "") if thumbnails else ""

            channel_runs = (
                vr.get("ownerText", {}).get("runs", [])
                or vr.get("longBylineText", {}).get("runs", [])
            )
            channel_title = channel_runs[0].get("text", "") if channel_runs else ""

            videos.append({
                "title": title,
                "video_id": video_id,
                "thumbnail_url": thumbnail_url,
                "channel_title": channel_title,
                "watch_url": f"https://www.youtube.com/watch?v={video_id}",
            })

            if len(videos) >= limit:
                break
        if len(videos) >= limit:
            break

    return videos


def search_youtube_tutorials(query: str, limit: int = 3) -> list:
    """
    Search YouTube for tutorial/lecture videos.

    Args:
        query: Topic or keyword to search for.
        limit: Max videos to return (default 3).

    Returns:
        List of {
            "title": str,
            "video_id": str,
            "thumbnail_url": str,
            "channel_title": str,
            "watch_url": str
        }
    """
    query = (query or "").strip()
    if not query:
        return []

    api_key = os.getenv("YOUTUBE_API_KEY", "").strip()

    try:
        if api_key:
            agent_logger.info(f"[YouTubeTool] Using Data API for query='{query}'")
            results = _search_via_api(query, limit)
        else:
            agent_logger.info(f"[YouTubeTool] Using scraper for query='{query}'")
            results = _search_via_scraper(query, limit)

        agent_logger.info(f"[YouTubeTool] Returning {len(results)} videos")
        return results

    except Exception as exc:
        agent_logger.error(f"[YouTubeTool] Exception: {exc}")
        # If API failed, try scraper as last resort
        if api_key:
            try:
                agent_logger.info("[YouTubeTool] API failed, falling back to scraper")
                return _search_via_scraper(query, limit)
            except Exception as exc2:
                agent_logger.error(f"[YouTubeTool] Scraper also failed: {exc2}")
        return []
