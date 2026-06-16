"""Route notebook actions to the correct capability workflow."""

VALID_MODES = ("chat", "quiz", "roadmap")


def normalize_mode(mode: str) -> str:
  m = (mode or "chat").lower().strip()
  if m not in VALID_MODES:
    return "chat"
  return m
