"""
Unit tests for capability workflows (chat, research, quiz, roadmap).
Mocks LLM and vector retrieval — no FAISS/Ollama required.
"""
import os
import sys
import types
import unittest
from unittest.mock import patch

# Ensure backend root is on path
_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND)

# Stub faiss when missing or incomplete (multi_doc_store uses faiss.Index in type hints)
def _install_faiss_stub():
    faiss_mod = types.ModuleType("faiss")

    class _FakeIndex:
        ntotal = 0
        d = 384

        def add(self, _vectors):
            pass

        def search(self, _q, k):
            import numpy as np

            return np.array([[0.0]]), np.array([[0]])

    faiss_mod.Index = _FakeIndex
    faiss_mod.IndexFlatL2 = lambda dim: _FakeIndex()
    faiss_mod.read_index = lambda path: _FakeIndex()
    faiss_mod.write_index = lambda index, path: None
    sys.modules["faiss"] = faiss_mod


try:
    import faiss as _faiss_check

    if not hasattr(_faiss_check, "Index"):
        _install_faiss_stub()
except ImportError:
    _install_faiss_stub()

# Stub sentence_transformers (pulled in by utils.embeddings)
if "sentence_transformers" not in sys.modules:
    st_mod = types.ModuleType("sentence_transformers")

    class _FakeST:
        def encode(self, texts, **kwargs):
            import numpy as np

            if isinstance(texts, str):
                return np.zeros(384)
            return [np.zeros(384) for _ in texts]

    st_mod.SentenceTransformer = lambda *a, **k: _FakeST()
    sys.modules["sentence_transformers"] = st_mod

# Stub openai (utils.llm_client)
def _install_openai_stub():
    openai_mod = types.ModuleType("openai")

    class _FakeOpenAI:
        def __init__(self, *a, **k):
            self.chat = types.SimpleNamespace(
                completions=types.SimpleNamespace(
                    create=lambda **kw: types.SimpleNamespace(
                        choices=[
                            types.SimpleNamespace(
                                message=types.SimpleNamespace(content="mocked response")
                            )
                        ],
                        usage=None,
                    )
                )
            )

    openai_mod.OpenAI = _FakeOpenAI
    sys.modules["openai"] = openai_mod


try:
    from openai import OpenAI as _OpenAI  # noqa: F401
except ImportError:
    _install_openai_stub()

# Always use fake langgraph in unit tests
def _install_langgraph_stub():
    for key in list(sys.modules):
        if key == "langgraph" or key.startswith("langgraph."):
            del sys.modules[key]

    langgraph_mod = types.ModuleType("langgraph")
    graph_mod = types.ModuleType("langgraph.graph")

    class _FakeGraph:
        def invoke(self, state):
            return state

        def get_graph(self):
            return types.SimpleNamespace(draw_mermaid=lambda: "graph TD")

    class StateGraph:
        def __init__(self, _state):
            pass

        def add_node(self, *args, **kwargs):
            return self

        def set_entry_point(self, *args, **kwargs):
            return self

        def add_edge(self, *args, **kwargs):
            return self

        def add_conditional_edges(self, *args, **kwargs):
            return self

        def compile(self):
            return _FakeGraph()

    graph_mod.StateGraph = StateGraph
    graph_mod.END = "END"
    langgraph_mod.graph = graph_mod
    sys.modules["langgraph"] = langgraph_mod
    sys.modules["langgraph.graph"] = graph_mod


_install_langgraph_stub()

from agents.shared.state import create_initial_state
from agents.chat.workflow import run_chat_workflow
from agents.quiz.workflow import run_quiz_workflow
from agents.roadmap.workflow import run_roadmap_workflow
from agents.research.workflow import run_research_workflow
from agents.supervisor.routing import normalize_mode
from agents.supervisor.workflow_factory import get_workflow


MOCK_CHUNKS = ["Alpha is a testing framework.", "Beta supports async tests."]
MOCK_SOURCES = ["doc_a.pdf", "doc_b.pdf"]
MOCK_RETRIEVAL = {
    "status": "success",
    "chunks": MOCK_CHUNKS,
    "sources": MOCK_SOURCES,
    "retrieval_items": [
        {
            "citation_id": "A",
            "chunk_id": "doc_a_pdf_chunk_0",
            "chunk_text": MOCK_CHUNKS[0],
            "source_name": MOCK_SOURCES[0],
        },
        {
            "citation_id": "B",
            "chunk_id": "doc_b_pdf_chunk_1",
            "chunk_text": MOCK_CHUNKS[1],
            "source_name": MOCK_SOURCES[1],
        },
    ],
    "searched_docs": ["doc_a_pdf", "doc_b_pdf"],
    "num_results": 2,
}


def _base_state(mode: str, query: str = "What is Alpha?"):
    return create_initial_state(
        notebook_id="test-nb",
        user_query=query,
        mode=mode,
        doc_ids=["doc_a_pdf"],
        top_k=5,
    )


class TestRouting(unittest.TestCase):
    def test_normalize_mode(self):
        self.assertEqual(normalize_mode("chat"), "chat")
        self.assertEqual(normalize_mode("RESEARCH"), "research")
        self.assertEqual(normalize_mode("invalid"), "chat")

    def test_workflow_factory(self):
        self.assertEqual(get_workflow("chat").__name__, "run_chat_workflow")
        self.assertEqual(get_workflow("quiz").__name__, "run_quiz_workflow")
        self.assertEqual(get_workflow("roadmap").__name__, "run_roadmap_workflow")
        self.assertEqual(get_workflow("research").__name__, "run_research_workflow")


class TestChatWorkflow(unittest.TestCase):
    @patch("agents.chat.workflow._rewriter.rewrite")
    @patch("agents.chat.workflow._answer.answer")
    @patch("agents.chat.workflow._retriever.retrieve")
    def test_chat_happy_path(self, mock_retrieve, mock_answer, mock_rewrite):
        mock_retrieve.return_value = MOCK_RETRIEVAL
        mock_rewrite.return_value = {
            "status": "success",
            "standalone_query": "What is Alpha?",
            "intent": "factual_query",
            "keywords": ["Alpha"],
            "needs_retrieval": True,
        }
        mock_answer.return_value = {
            "status": "success",
            "answer": "Alpha is a testing framework [A].",
            "citations": [
                {
                    "citation_id": "A",
                    "chunk_id": "doc_a_pdf_chunk_0",
                    "source_name": "doc_a.pdf",
                    "text_span": "Alpha is a testing framework",
                    "start_index": 29,
                    "end_index": 32,
                    "chunk_text": "Alpha is a testing framework.",
                }
            ],
        }

        result = run_chat_workflow(_base_state("chat"))

        self.assertEqual(result["status"], "complete")
        self.assertIn("Alpha", result["final_answer"])
        self.assertEqual(len(result["chunks"]), 2)
        self.assertEqual(result["rewritten_query"], "What is Alpha?")
        mock_retrieve.assert_called_once()
        mock_rewrite.assert_called_once()
        mock_answer.assert_called_once()

    @patch("agents.chat.workflow._retriever.retrieve")
    def test_chat_no_chunks(self, mock_retrieve):
        mock_retrieve.return_value = {
            "status": "success",
            "chunks": [],
            "sources": [],
            "searched_docs": [],
            "num_results": 0,
        }
        result = run_chat_workflow(_base_state("chat"))
        self.assertEqual(result["status"], "error")

    def test_chat_greeting_short_circuit(self):
        result = run_chat_workflow(_base_state("chat", "hello"))
        self.assertEqual(result["status"], "complete")
        self.assertFalse(result["needs_retrieval"])
        self.assertEqual(result["citations"], [])


class TestQuizWorkflow(unittest.TestCase):
    @patch("agents.quiz.workflow._formatter.format")
    @patch("agents.quiz.workflow._reviewer.review")
    @patch("agents.quiz.workflow._generator.generate")
    @patch("agents.quiz.workflow._retriever.retrieve")
    def test_quiz_happy_path(self, mock_retrieve, mock_gen, mock_rev, mock_fmt):
        mock_retrieve.return_value = MOCK_RETRIEVAL
        mock_gen.return_value = {"status": "success", "draft": "1. Question?"}
        mock_rev.return_value = {"status": "success", "reviewed": "1. Question? (reviewed)"}
        mock_fmt.return_value = {"status": "success", "formatted": "# Quiz\n\n1. Question?"}

        result = run_quiz_workflow(_base_state("quiz", "Create a quiz"))

        self.assertEqual(result["status"], "complete")
        self.assertTrue(result["final_answer"].startswith("# Quiz"))
        mock_gen.assert_called_once()
        mock_rev.assert_called_once()
        mock_fmt.assert_called_once()


class TestRoadmapWorkflow(unittest.TestCase):
    @patch("agents.roadmap.workflow._formatter.format")
    @patch("agents.roadmap.workflow._reviewer.review")
    @patch("agents.roadmap.workflow._resource.enrich")
    @patch("agents.roadmap.workflow._planner.plan")
    @patch("agents.roadmap.workflow._retriever.retrieve")
    def test_roadmap_happy_path(self, mock_retrieve, mock_plan, mock_res, mock_rev, mock_fmt):
        mock_retrieve.return_value = MOCK_RETRIEVAL
        mock_plan.return_value = {"status": "success", "roadmap": "## Phase 1"}
        mock_res.return_value = {"status": "success", "roadmap": "## Phase 1\nResources"}
        mock_rev.return_value = {"status": "success", "reviewed": "## Phase 1\nResources (reviewed)"}
        mock_fmt.return_value = {"status": "success", "formatted": "# Learning Roadmap\n\n## Phase 1"}

        result = run_roadmap_workflow(_base_state("roadmap", "8-week Python plan"))

        self.assertEqual(result["status"], "complete")
        self.assertIn("Roadmap", result["final_answer"])
        mock_plan.assert_called_once()
        mock_res.assert_called_once()
        mock_rev.assert_called_once()


class TestResearchWorkflow(unittest.TestCase):
    @patch("agents.research.workflow.research_graph")
    def test_research_happy_path(self, mock_graph):
        mock_graph.invoke.return_value = {
            "status": "complete",
            "final_answer": "Research report body",
            "chunks": MOCK_CHUNKS,
            "sources": MOCK_SOURCES,
            "num_chunks_found": 2,
            "searched_docs": ["doc_a_pdf"],
            "initial_summary": "Draft",
            "critique": "OK",
            "has_gaps": False,
            "suggestions": [],
            "editing_applied": False,
            "workflow_log": ["[Research] done"],
            "research_complete": True,
            "summary_complete": True,
            "critique_complete": True,
            "editor_complete": True,
        }

        result = run_research_workflow(_base_state("research", "Summarize Alpha"))

        self.assertEqual(result["status"], "complete")
        self.assertEqual(result["final_answer"], "Research report body")
        mock_graph.invoke.assert_called_once()

    @patch("agents.research.workflow.research_graph")
    def test_research_error(self, mock_graph):
        mock_graph.invoke.return_value = {
            "status": "error",
            "error_message": "No documents",
            "workflow_log": [],
        }
        result = run_research_workflow(_base_state("research"))
        self.assertEqual(result["status"], "error")


if __name__ == "__main__":
    unittest.main()
