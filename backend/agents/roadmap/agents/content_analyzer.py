"""Content Analyzer Agent — extract knowledge graph from document."""
import json
from agents.shared.prompts import CONTENT_ANALYZER_PROMPT
from config import LLM_PLANNER_MODEL, LLM_PLANNER_PROVIDER
from utils.llm_client import generate_text
from utils.logger import agent_logger


class ContentAnalyzerAgent:
    def __init__(self):
        self.name = "Content Analyzer"
        agent_logger.info(f"{self.name} initialized")

    def analyze(self, context: str) -> dict:
        agent_logger.info(f"{self.name}: extracting knowledge graph")
        try:
            raw = generate_text(
                CONTENT_ANALYZER_PROMPT.format(context=context),
                model=LLM_PLANNER_MODEL,
                provider=LLM_PLANNER_PROVIDER,
                temperature=0.2,
            )
            # Parse JSON
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            knowledge_graph = json.loads(raw.strip())
            agent_logger.info(
                f"{self.name}: extracted {len(knowledge_graph.get('concepts', []))} concepts, "
                f"{len(knowledge_graph.get('relationships', []))} relationships"
            )
            return {"status": "success", "knowledge_graph": knowledge_graph}
        except json.JSONDecodeError as e:
            agent_logger.warning(f"{self.name}: JSON parse failed, using fallback. Error: {e}")
            # Return a minimal fallback knowledge graph
            return {
                "status": "fallback",
                "knowledge_graph": {
                    "concepts": [
                        {"id": "c1", "name": "Main Topic", "description": "Core topic from document",
                         "difficulty": "intermediate", "estimated_hours": 2.0, "keywords": []}
                    ],
                    "relationships": []
                }
            }
        except Exception as e:
            agent_logger.error(f"{self.name}: {e}", exc_info=True)
            return {"status": "error", "message": str(e), "knowledge_graph": None}
