"""Shared prompts for capability agents."""

CHAT_ANSWER_SYSTEM = (
  "You are a document-grounded assistant. Answer ONLY from the provided context. "
  "If the answer is not in the context, say so clearly."
)

QUIZ_GENERATOR_PROMPT = """Based ONLY on the following document context, create a quiz.

Context:
{context}

User request: {query}

Generate 5 multiple-choice questions. You MUST return ONLY a valid JSON object with the following structure, and nothing else:
{{
  "questions": [
    {{
      "id": 1,
      "question": "question text",
      "options": {{
        "A": "option A text",
        "B": "option B text",
        "C": "option C text",
        "D": "option D text"
      }},
      "correct_answer": "A",
      "explanation": "brief explanation grounded in the context"
    }}
  ]
}}"""

QUIZ_REVIEWER_PROMPT = """Review this quiz for accuracy against the source context.

Context excerpt:
{context}

Quiz draft:
{draft}

Fix any questions that are not supported by the context. Adjust difficulty if needed.
You MUST return the corrected quiz as a valid JSON object using the same schema as the draft, and nothing else."""

# ─────────────────────────────────────────────────────────────────────────────
# MULTI-AGENT ROADMAP PROMPTS
# ─────────────────────────────────────────────────────────────────────────────

CONTENT_ANALYZER_PROMPT = """You are a Content Analyzer Agent. Analyze the document and extract a structured knowledge graph.

Document context:
{context}

Extract:
1. Main concepts/topics (up to 20)
2. Relationships between concepts (A requires B, A extends B, A leads to C)
3. Difficulty level of each concept (beginner/intermediate/advanced)
4. Estimated learning time per concept (in hours)

Return ONLY a valid JSON object, nothing else:
{{
  "concepts": [
    {{
      "id": "c1",
      "name": "Concept Name",
      "description": "Brief description",
      "difficulty": "beginner|intermediate|advanced",
      "estimated_hours": 1.5,
      "keywords": ["kw1", "kw2"]
    }}
  ],
  "relationships": [
    {{
      "from": "c1",
      "to": "c2",
      "type": "requires|extends|leads_to"
    }}
  ]
}}"""

ASSESSMENT_PROMPT = """You are an Assessment Agent. Given the learner profile and knowledge graph, create a personalized learning assessment.

Learner Profile:
- Goal: {goal}
- Current Level: {level}
- Available hours per day: {hours_per_day}
- Learning preference: {preference}

Knowledge Graph:
{knowledge_graph}

Your tasks:
1. Identify which concepts the learner likely already knows based on their level
2. Identify knowledge gaps to fill
3. Prioritize concepts based on their goal
4. Estimate total learning duration

Return ONLY a valid JSON object, nothing else:
{{
  "known_concepts": ["c1", "c2"],
  "gap_concepts": ["c3", "c4"],
  "priority_concepts": ["c3", "c5", "c4"],
  "total_estimated_hours": 20,
  "recommended_pace": "2 hours/day → 10 days",
  "personalization_notes": "Focus on practical aspects for job-readiness"
}}"""

SYLLABUS_ARCHITECT_PROMPT = """You are a Syllabus Architect Agent. Design a structured learning curriculum.

Knowledge Graph:
{knowledge_graph}

Assessment Result:
{assessment}

Learner Goal: {goal}

Group concepts into logical Milestones. Each milestone should:
- Have a clear theme and objective
- Contain 3-6 related concepts
- Build on the previous milestone
- Include a mix of theory and practice

Return ONLY a valid JSON object, nothing else:
{{
  "milestones": [
    {{
      "id": "m1",
      "title": "Milestone Title",
      "phase": "Foundation|Core|Advanced|Project",
      "description": "What the learner will achieve",
      "concepts": ["c1", "c2", "c3"],
      "estimated_days": 3,
      "learning_objectives": ["objective 1", "objective 2"],
      "has_quiz": true
    }}
  ]
}}"""

SCHEDULER_PROMPT = """You are a Scheduler Agent. Create a detailed daily learning schedule.

Milestones:
{syllabus}

Knowledge Graph (for concept details):
{knowledge_graph}

Constraints:
- Available hours per day: {hours_per_day}
- Learning preference: {preference}
- Start date: {start_date}

For each day, assign specific concepts/activities balanced between theory and practice.

Return ONLY a valid JSON object, nothing else:
{{
  "schedule": [
    {{
      "day": 1,
      "date": "2025-01-20",
      "milestone_id": "m1",
      "milestone_title": "Milestone Title",
      "title": "Day task title",
      "activities": [
        {{
          "type": "theory|practice|quiz|review",
          "concept_id": "c1",
          "topic": "Topic name",
          "description": "What to study",
          "duration_minutes": 60
        }}
      ],
      "total_hours": 2.0,
      "day_summary": "Brief summary of what's covered today"
    }}
  ],
  "total_days": 10,
  "total_hours": 20
}}"""

RESOURCE_QUIZ_PROMPT = """You are a Resource & Quiz Generator Agent. Enrich each milestone with resources and assessment questions.

Milestones with Schedule:
{syllabus}

Document Context:
{context}

For each milestone, generate:
1. 3-5 relevant resources (from document or general knowledge)
2. 3 quiz questions to assess understanding
3. A practical exercise

Return ONLY a valid JSON object, nothing else:
{{
  "enriched_milestones": [
    {{
      "milestone_id": "m1",
      "resources": [
        {{
          "title": "Resource title",
          "type": "reading|video|exercise|tool",
          "description": "What this covers",
          "source": "From uploaded document / External"
        }}
      ],
      "quiz_questions": [
        {{
          "question": "Question text?",
          "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
          "correct_answer": "A",
          "explanation": "Why this is correct"
        }}
      ],
      "practical_exercise": {{
        "title": "Exercise title",
        "description": "What to build/do",
        "expected_outcome": "What success looks like"
      }}
    }}
  ]
}}"""

ROADMAP_FORMATTER_PROMPT = """You are a Roadmap Formatter. Convert structured roadmap data into beautiful Markdown.

Schedule Data:
{schedule}

Enriched Milestones:
{enriched_milestones}

Sources: {sources}

Format as a comprehensive learning roadmap in Markdown with:
- Clear ## headings for each Milestone
- ### subheadings for Days within each milestone
- Bullet lists for activities
- **Resources** section per milestone
- **Quiz** section per milestone
- A summary table at the end

Use Vietnamese language for all labels (Ngày, Hoạt động, Tài liệu, etc.)."""

# Legacy prompts kept for backward compatibility
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
