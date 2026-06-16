"""Factory: select capability workflow by mode."""

from typing import Callable

from agents.chat.workflow import run_chat_workflow
from agents.quiz.workflow import run_quiz_workflow
from agents.roadmap.workflow import run_roadmap_workflow
from agents.shared.state import NotebookState
from agents.supervisor.routing import normalize_mode

WorkflowFn = Callable[[NotebookState], NotebookState]

_WORKFLOWS: dict[str, WorkflowFn] = {
  "chat": run_chat_workflow,
  "quiz": run_quiz_workflow,
  "roadmap": run_roadmap_workflow,
}


def get_workflow(mode: str) -> WorkflowFn:
  return _WORKFLOWS[normalize_mode(mode)]
