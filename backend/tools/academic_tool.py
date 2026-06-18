"""
Academic Papers Tool — search Arxiv for research papers.
Uses the free Arxiv API (no API key required, very generous rate limits).
"""
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from utils.logger import agent_logger

_ARXIV_API = "http://export.arxiv.org/api/query"

def fetch_academic_papers(query: str, limit: int = 3) -> list:
    """
    Search Arxiv for academic papers.

    Args:
        query: Research keyword or topic.
        limit: Max number of papers to return (default 3).

    Returns:
        List of {
            "title": str,
            "authors": List[str],
            "year": int | None,
            "citation_count": int,
            "pdf_url": str | None,
            "semantic_url": str
        }
    """
    query = (query or "").strip()
    if not query:
        return []

    params = urllib.parse.urlencode({
        "search_query": f"all:\"{query}\"",
        "start": 0,
        "max_results": min(limit, 5),
    })
    url = f"{_ARXIV_API}?{params}"

    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "NoteMind/1.0 (educational-tool)"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            xml_data = resp.read()

        root = ET.fromstring(xml_data)
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        papers = []
        for entry in root.findall("atom:entry", ns)[:limit]:
            title_el = entry.find("atom:title", ns)
            title = title_el.text.replace("\n", " ").strip() if title_el is not None else ""
            
            authors = []
            for author_el in entry.findall("atom:author", ns):
                name_el = author_el.find("atom:name", ns)
                if name_el is not None and name_el.text:
                    authors.append(name_el.text.strip())
            
            published_el = entry.find("atom:published", ns)
            year = int(published_el.text[:4]) if (published_el is not None and published_el.text) else None
            
            id_el = entry.find("atom:id", ns)
            semantic_url = id_el.text.strip() if id_el is not None else ""
            
            pdf_url = None
            for link_el in entry.findall("atom:link", ns):
                if link_el.attrib.get("title") == "pdf":
                    pdf_url = link_el.attrib.get("href")
                    break

            papers.append({
                "title": title,
                "authors": authors[:4],  # limit to 4 authors for display
                "year": year,
                "citation_count": 0,     # Arxiv does not return citation counts
                "pdf_url": pdf_url,
                "semantic_url": semantic_url,
            })

        agent_logger.info(f"[AcademicTool] Found {len(papers)} papers for query='{query}' via Arxiv")
        return papers

    except Exception as exc:
        agent_logger.error(f"[AcademicTool] Exception: {exc}")
        return []
