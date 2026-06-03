# Project Specification: Frontend Workspace Refactoring

## 1. Role & Context
You are an expert Frontend Developer specializing in **React 19**, **Next.js 15**, and **Tailwind CSS**. 

Your mission is to refactor the frontend workspace based on this specification. The primary goal is to optimize the navigation flow and completely split the single, generic workspace UI into **4 distinct, highly specialized interfaces** based on the active workspace mode (`chat`, `research`, `quiz`, `roadmap`).

---

## 2. Core Tasks

### Task 1: Default Landing View (Dashboard Index)
* **Behavior:** When a user first enters the application (the `/` root path without any `notebook_id` or `session_id` query parameters), the application **must** load and render the **Dashboard (Notebook & Session Management)** as the primary index page.
* **Flow Check:** Ensure that the router cleanly handles query parameters. Passing `notebook_id` or `session_id` should smoothly mount the `NotebookWorkspace` component **without** flashing the Dashboard UI.

### Task 2: Dedicated Workspace UIs (Mode Splitting)
Currently, all 4 modes share the same generic chat interface. You need to refactor the workspace center panel. Based on the selected mode state (`chat` | `research` | `quiz` | `roadmap`), render 4 completely different sub-components/layouts:

#### 1. Chat Mode UI (`chat`)
* **Design:** Standard conversational thread UI.
* **Layout:** Clean timeline of user messages (right-aligned) and assistant responses (left-aligned) with avatar bubbles.
* **Features:** * Standard prompt suggestions at the bottom.
    * Auto-scroll to the latest message.
    * Full Markdown rendering support for AI responses.

#### 2. Research Mode UI (`research`)
* **Design:** A highly structured, research-centric split interface (Not a simple chat).
* **Layout:**
    * **Left Column (References & Snippets):** A dedicated area or card-deck displaying retrieved source files, highlighted document sections, and citations with a quick preview on hover.
    * **Right Column (Deep Synthesized Insights):** A clean academic layout presenting the structured synthesis/summary returned by the AI Agent.
* **Features:** Easier tracking of citations, side-by-side verification of document source material, and download/export synthesis options.

#### 3. Interactive Quiz Mode UI (`quiz`)
* **Design:** Interactive flashcard or multiple-choice test interface.
* **Data Parsing:** The AI Agent will return a JSON block with the following exact structure:
    ```json
    {
      "questions": [
        {
          "id": 1,
          "question": "Nội dung câu hỏi ở đây?",
          "options": {
            "A": "Đáp án A",
            "B": "Đáp án B",
            "C": "Đáp án C",
            "D": "Đáp án D"
          },
          "correct_answer": "A",
          "explanation": "Lời giải thích chi tiết tại sao A đúng..."
        }
      ]
    }
    ```
* **Interactive Features:**
    * Render each question as a beautiful card with interactive selection buttons (A, B, C, D).
    * When the user clicks an option, mark it as selected and visually indicate if it's correct (**Green**) or incorrect (**Red**).
    * **Crucial:** Keep the `correct_answer` and `explanation` completely hidden under a blur/collapse effect until the user commits to an answer or clicks a *"Show Answer & Explanation"* button.

#### 4. Interactive Roadmap Mode UI (`roadmap`)
* **Design:** A visual, structured execution/learning roadmap.
* **Layout:** Instead of flat text, represent the learning path using a highly visual step-by-step tree, node graph, or interactive timeline.
* **Features:**
    * Each node on the roadmap represents a milestone or topic.
    * Nodes must have expandable detail drawers (clicking a milestone slides open a card showing deep descriptions, resources, and sub-tasks).
    * Include a *"Progress Toggle"* (Mark as completed) for milestones.

---

## 3. Technical Requirements

* **Styling:** Use **Tailwind CSS 4** utility classes. Ensure responsive spacing, beautiful glassmorphism effects, and smooth transitions when switching between modes.
* **State Management:** Keep the states of each mode clean and separated. Changing modes should transition smoothly **without breaking or resetting** the ongoing session data.
* **Icons:** Use **Lucide Icons**. Select unique and highly intuitive icons for different states, milestones, and correct/incorrect indicators.
* **No Code Bloat:** Split these sub-views into logical modular sub-components (e.g., `ChatView.tsx`, `ResearchView.tsx`, `QuizView.tsx`, `RoadmapView.tsx`) or clean internal functions.