"""Shared prompts for capability agents."""

CHAT_ANSWER_SYSTEM = (
  "You are a document-grounded assistant. Answer ONLY from the provided context. "
  "If the answer is not in the context, say so clearly."
)

QUIZ_GENERATOR_PROMPT = """Based ONLY on the following document context, create a quiz.

Context:
{context}

User request: {query}

Generate 5 multiple-choice questions. For each question provide:
- question text
- options A, B, C, D
- correct answer letter
- brief explanation grounded in the context

Format as clear markdown sections numbered 1-5."""

QUIZ_REVIEWER_PROMPT = """Review this quiz for accuracy against the source context.

Context excerpt:
{context}

Quiz draft:
{draft}

Fix any questions that are not supported by the context. Adjust difficulty if needed.
Return the corrected quiz in the same markdown format."""

ROADMAP_PLANNER_PROMPT = """Based on the document context and user goal, create a learning/implementation roadmap.

Context:
{context}

User goal: {query}

Create a phased roadmap with:
- Phase name and duration estimate
- Key objectives per phase
- Milestones

Use markdown headings for phases."""

ROADMAP_RESOURCE_PROMPT = """Given this roadmap draft and document context, add resource recommendations.

Context:
{context}

Roadmap:
{roadmap}

Add under each phase:
- Recommended readings from the uploaded sources (cite document names)
- Suggested activities
Keep recommendations grounded in available context."""

ROADMAP_REVIEWER_PROMPT = """Review this roadmap for logical flow and grounding in the source material.

Context excerpt:
{context}

Roadmap:
{roadmap}

Fix gaps, unrealistic steps, or claims not supported by context. Return the improved roadmap."""

CITATION_PROMPT = """Add inline source references to the answer below.

Answer:
{answer}

Sources (document names): {sources}

Append a "## Sources" section listing which documents support the answer. Do not invent sources."""
