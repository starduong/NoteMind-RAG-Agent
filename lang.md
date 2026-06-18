# 📚 Ứng dụng LangChain & LangGraph trong dự án NoteMind

Tài liệu này trình bày chi tiết cách dự án **NoteMind** ứng dụng hệ sinh thái **LangChain** và mô hình thiết kế của **LangGraph** để xây dựng hệ thống RAG Agent thông minh.

---

## 🔗 1. Ứng dụng LangChain (Semantic Processing & Embeddings)

LangChain được sử dụng làm nền tảng xử lý dữ liệu và tạo embeddings chất lượng cao cho cơ sở dữ liệu Vector.

### A. Phân tách văn bản theo ngữ nghĩa (Semantic Chunking)
* **Vị trí code**: [document_parser.py](file:///d:/05-06_HK2/NoteMind/backend/utils/document_parser.py)
* **Thư viện áp dụng**: `langchain_experimental.text_splitter.SemanticChunker`
* **Cách hoạt động**:
  * Thay vì cắt nhỏ văn bản theo độ dài ký tự cố định (dễ làm đứt đoạn ngữ nghĩa), hệ thống sử dụng `SemanticChunker`.
  * Bộ chia nhỏ này sử dụng mô hình nhúng (`HuggingFaceEmbeddings`) để phân tích các câu liên tục. Khi khoảng cách vector giữa hai câu kế tiếp nhau vượt quá ngưỡng bất thường (`breakpoint_threshold_amount=0.85`), hệ thống sẽ cắt đoạn tại vị trí đó để tạo một chunk mới.
  * Giúp văn bản trong mỗi chunk được bảo toàn tính liên tục về chủ đề, tối ưu cho quá trình tìm kiếm thông tin liên quan (Retrieval).

### B. Wrapper Mô hình nhúng (Embeddings Integration)
* **Vị trí code**: [document_parser.py](file:///d:/05-06_HK2/NoteMind/backend/utils/document_parser.py) và [embeddings.py](file:///d:/05-06_HK2/NoteMind/backend/utils/embeddings.py)
* **Thư viện áp dụng**: `langchain_huggingface.HuggingFaceEmbeddings`
* **Cách hoạt động**: 
  * Dự án tích hợp mô hình nhúng mã nguồn mở mạnh mẽ `BAAI/bge-m3`. 
  * Bằng cách sử dụng wrapper của LangChain, mã nguồn dễ dàng cấu hình chạy trên thiết bị (CPU/GPU) và chuẩn hóa vector (`normalize_embeddings=True`) để thực hiện các phép so sánh Cosine Similarity nhanh chóng trên FAISS.

---

## 🕸️ 2. Ứng dụng LangGraph (State-Machine Agent Workflow)

Dự án cài đặt sẵn `langgraph>=1.2.2` trong [requirements.txt](file:///d:/05-06_HK2/NoteMind/backend/requirements.txt). Để tối ưu hóa hiệu năng và đơn giản hóa kiến trúc chạy cục bộ, dự án hiện đang triển khai **Mô hình kiến trúc dạng Đồ thị Trạng thái (State Graph Design Pattern)** lấy cảm hứng trực tiếp từ LangGraph.

Kiến trúc này được tổ chức như sau:

### A. Định nghĩa Trạng thái Chung (`State`)
* **Vị trí code**: `backend/agents/shared/state.py`
* **Cách hoạt động**: Tương tự như biến `State` trong LangGraph dùng để truyền tải thông tin xuyên suốt qua các Node. Định nghĩa `NotebookState` (chứa: `user_query`, `rewritten_query`, `chunks`, `sources`, `final_answer`, `workflow_log`, `tools_data`, v.v.).

### B. Điều phối & Tuyến đường (Nodes & Edges)
Mỗi luồng xử lý (Workflow) được thiết kế như một chuỗi các Node nhận vào `NotebookState` và trả về `NotebookState` cập nhật:
* **Workflow Chat** ([workflow.py](file:///d:/05-06_HK2/NoteMind/backend/agents/chat/workflow.py)):
  ```
  [User Query] ➔ [Intent Router] ➔ (Nếu cần tra cứu) ➔ [Query Rewriter] ➔ [Retriever] ➔ [Answer Generator] ➔ [Tool Enrichment] ➔ [Complete]
  ```
  * **Intent Router (Conditional Edge)**: Đóng vai trò như một cạnh điều kiện để chuyển tiếp. Phân tích xem câu hỏi là hội thoại thông thường hay cần truy vấn dữ liệu từ Notebook.
  * **Tool Enrichment (Parallel Node)**: Chạy đồng thời các công cụ ngoài thông qua `ToolRunner` để bổ sung ngữ cảnh từ Wikipedia, GitHub, Academic Papers, Youtube.
* **Workflow Quiz** ([workflow.py](file:///d:/05-06_HK2/NoteMind/backend/agents/quiz/workflow.py)):
  ```
  [Retrieve Context] ➔ [Quiz Generator] ➔ [Quiz Reviewer] ➔ [Quiz Formatter]
  ```
  * Tách biệt nhiệm vụ tạo (Generator) và kiểm tra lỗi/tính chính xác của câu hỏi (Reviewer) để đảm bảo chất lượng đầu ra.

### C. Khởi tạo và Phân phối (Supervisor/Orchestrator)
* **Vị trí code**: [orchestrator.py](file:///d:/05-06_HK2/NoteMind/backend/agents/supervisor/orchestrator.py) và [workflow_factory.py](file:///d:/05-06_HK2/NoteMind/backend/agents/supervisor/workflow_factory.py).
* **Cách hoạt động**: `NotebookOrchestrator` nhận yêu cầu từ API, khởi tạo trạng thái `NotebookState`, chọn workflow tương ứng dựa trên chế độ (`chat`, `quiz`, `roadmap`) và thực thi chuỗi tác vụ.

---

## 🚀 Hướng phát triển: Chuyển đổi sang Class `StateGraph` của LangGraph

Nhờ cấu trúc State-Machine Agent đã được phân tách rõ ràng, nhà phát triển có thể dễ dàng chuyển đổi mã nguồn hiện tại sang thư viện `langgraph` chính thức như sau:

```python
from langgraph.graph import StateGraph, END
from agents.shared.state import NotebookState

# 1. Khởi tạo StateGraph với Schema NotebookState
workflow = StateGraph(NotebookState)

# 2. Đăng ký các Nodes (Hàm xử lý hiện có)
workflow.add_node("intent_router", run_intent_router)
workflow.add_node("query_rewriter", run_query_rewriter)
workflow.add_node("retriever", run_retriever)
workflow.add_node("answer_generator", run_answer_generator)

# 3. Cấu hình luồng chạy (Edges & Conditional Edges)
workflow.set_entry_point("intent_router")

def route_decision(state: NotebookState):
    if state.get("needs_retrieval"):
        return "query_rewriter"
    return END

workflow.add_conditional_edges(
    "intent_router",
    route_decision,
    {
        "query_rewriter": "query_rewriter",
        END: END
    }
)

workflow.add_edge("query_rewriter", "retriever")
workflow.add_edge("retriever", "answer_generator")
workflow.add_edge("answer_generator", END)

# 4. Compile Graph
app = workflow.compile()
```
Cấu trúc module hóa hiện tại của NoteMind giúp việc bảo trì, tối ưu hóa và chuyển đổi lên các framework Agent phức tạp hơn trở nên vô cùng thuận tiện.
