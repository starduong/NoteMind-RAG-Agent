"""
Quiz Search Tool — search for external quizzes on a topic using DuckDuckGo HTML.
"""
import urllib.parse
import urllib.request
from bs4 import BeautifulSoup
from utils.logger import agent_logger

def search_external_quizzes(query: str, limit: int = 5) -> list:
    """
    Search DuckDuckGo for external quizzes.

    Args:
        query: Topic or keyword to search for.
        limit: Max links to return.

    Returns:
        List of {
            "title": str,
            "url": str,
            "snippet": str
        }
    """
    query = (query or "").strip()
    if not query:
        return []

    # Thêm từ khoá để tối ưu tìm kiếm quiz nếu chưa có
    if "quiz" not in query.lower() and "trắc nghiệm" not in query.lower() and "test" not in query.lower():
        search_query = query + " quiz test"
    else:
        search_query = query

    agent_logger.info(f"[QuizSearchTool] Searching for: '{search_query}'")
    
    encoded = urllib.parse.quote_plus(search_query)
    url = f"https://html.duckduckgo.com/html/?q={encoded}"
    
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
    
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8")
            
        soup = BeautifulSoup(html, "html.parser")
        results = []
        
        # Tùy thuộc vào cấu trúc DOM của DuckDuckGo HTML (thường có class result)
        for result in soup.find_all("div", class_="result"):
            title_tag = result.find("h2", class_="result__title")
            snippet_tag = result.find("a", class_="result__snippet")
            url_tag = result.find("a", class_="result__url")
            
            if title_tag and url_tag:
                title = title_tag.get_text(strip=True)
                link = url_tag.get("href", "")
                # Đôi khi DuckDuckGo chèn redirect link, ta cần lấy url thực sự
                if link.startswith("//duckduckgo.com/l/?uddg="):
                    link = urllib.parse.unquote(link.split("uddg=")[1].split("&")[0])
                    
                snippet = snippet_tag.get_text(strip=True) if snippet_tag else ""
                
                results.append({
                    "title": title,
                    "url": link,
                    "snippet": snippet
                })
                
                if len(results) >= limit:
                    break
                    
        agent_logger.info(f"[QuizSearchTool] Found {len(results)} results")
        return results

    except Exception as exc:
        agent_logger.error(f"[QuizSearchTool] Exception: {exc}")
        return []
