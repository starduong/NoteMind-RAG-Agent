"""
Wikipedia Tool — fetch a short summary for an academic concept.
Uses the Wikipedia REST API (no API key required).
"""
import re
import urllib.parse
import urllib.request
import json
from utils.logger import agent_logger


def fetch_wikipedia_summary(concept: str, language: str = "vi") -> dict:
    """
    Retrieve a 2-3 sentence summary from Wikipedia.

    Args:
        concept: The term or concept to look up.
        language: Wikipedia language code ("vi" or "en").

    Returns:
        {
            "title": str,
            "summary": str,
            "url": str,
            "status": "success" | "not_found" | "error"
        }
    """
    concept = (concept or "").strip()
    if not concept:
        return {"status": "error", "title": "", "summary": "", "url": ""}

    # Step 1: Search for the closest Wikipedia page title
    search_url = f"https://{language}.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(concept)}&utf8=&format=json"
    
    try:
        req_search = urllib.request.Request(
            search_url,
            headers={"User-Agent": "NoteMind/1.0", "Accept": "application/json"}
        )
        with urllib.request.urlopen(req_search, timeout=5) as resp:
            search_data = json.loads(resp.read().decode("utf-8"))
            
        search_results = search_data.get("query", {}).get("search", [])
        if not search_results:
            if language == "vi":
                agent_logger.info(f"[WikipediaTool] Not found in vi, trying en for: {concept}")
                return fetch_wikipedia_summary(concept, language="en")
            agent_logger.warning(f"[WikipediaTool] Not found: {concept}")
            return {"status": "not_found", "title": concept, "summary": "", "url": ""}
            
        # Get the title of the top search result
        best_title = search_results[0]["title"]
        
        # Step 2: Fetch the summary for that exact title
        encoded_title = urllib.parse.quote(best_title, safe="")
        summary_url = f"https://{language}.wikipedia.org/api/rest_v1/page/summary/{encoded_title}"
        
        req_summary = urllib.request.Request(
            summary_url,
            headers={"User-Agent": "NoteMind/1.0", "Accept": "application/json"}
        )
        with urllib.request.urlopen(req_summary, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        extract = data.get("extract", "")
        # Trim to first 3 sentences
        sentences = re.split(r"(?<=[.!?])\s+", extract)
        short_summary = " ".join(sentences[:3]).strip()

        # Step 3: Verify relevance using LLM
        verify_prompt = (
            f"Concept to search: '{concept}'\n"
            f"Found Wikipedia title: '{best_title}'\n"
            f"Summary: {short_summary}\n\n"
            "Does this summary define or describe the requested concept? "
            "Reply ONLY with 'YES' or 'NO'."
        )
        
        try:
            from utils.llm_client import chat_complete
            from config import LLM_UTILITY_MODEL, LLM_UTILITY_PROVIDER
            reply, _ = chat_complete(
                messages=[{"role": "user", "content": verify_prompt}],
                model=LLM_UTILITY_MODEL,
                provider=LLM_UTILITY_PROVIDER,
                temperature=0.0
            )
            is_relevant = "YES" in reply.strip().upper()
        except Exception as e:
            agent_logger.error(f"[WikipediaTool] Verification failed: {e}")
            is_relevant = True # Fallback to true if LLM fails

        if not is_relevant:
            agent_logger.info(f"[WikipediaTool] Rejected irrelevant summary for '{concept}': {best_title}")
            return {"status": "not_found", "title": concept, "summary": "", "url": ""}

        agent_logger.info(f"[WikipediaTool] Found and verified: {data.get('title')}")
        return {
            "status": "success",
            "title": data.get("title", best_title),
            "summary": short_summary,
            "url": data.get("content_urls", {}).get("desktop", {}).get("page", ""),
        }

    except urllib.error.HTTPError as e:
        agent_logger.error(f"[WikipediaTool] HTTP {e.code} for concept='{concept}'")
        return {"status": "error", "title": concept, "summary": "", "url": ""}

    except Exception as exc:
        agent_logger.error(f"[WikipediaTool] Exception: {exc}")
        return {"status": "error", "title": concept, "summary": "", "url": ""}
