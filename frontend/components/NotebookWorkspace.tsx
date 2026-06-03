import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useRouter } from "next/router";
import {
  Plus, Trash2, Send,
  Sparkles, Layers, Compass, MessageSquare, Upload, X,
  ChevronRight, Info, CheckCircle, RefreshCw, FileText,
  Eye, EyeOff, Database, ArrowRight, Bot
} from "lucide-react";
import AgentGraph from "./AgentGraph";
import ChatView from "./views/ChatView";
import ResearchView from "./views/ResearchView";
import QuizView from "./views/QuizView";
import RoadmapView from "./views/RoadmapView";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Mode = "chat" | "research" | "quiz" | "roadmap";

interface Message {
  role: "user" | "assistant";
  content: string;
  mode?: Mode;
  sources?: string[];
  citations?: CitationRef[];
}

interface CitationRef {
  citation_id: string;
  chunk_id?: string;
  source_name: string;
  text_span?: string;
  start_index?: number;
  end_index?: number;
  chunk_text?: string;
}

interface SourceDoc {
  doc_id: string;
  original_filename: string;
  file_type: string;
  chunks: number;
}

interface Notebook {
  notebook_id: string;
  title: string;
  description: string;
  source_count: number;
  sources_detail?: SourceDoc[];
}

const MODES: { id: Mode; label: string; icon: React.ComponentType<any>; hint: string }[] = [
  { id: "chat", label: "Hỏi Đáp (Q&A)", icon: MessageSquare, hint: "Hỏi đáp nhanh với tài liệu nguồn" },
  { id: "research", label: "Nghiên Cứu", icon: Sparkles, hint: "Báo cáo nghiên cứu sâu sắc đa-agent" },
  { id: "quiz", label: "Trắc Nghiệm", icon: Layers, hint: "Sinh câu hỏi ôn tập & đáp án giải thích" },
  { id: "roadmap", label: "Lộ Trình", icon: Compass, hint: "Tạo sơ đồ phát triển & kế hoạch hành động" },
];

const QUICK_PROMPTS: Record<Mode, { text: string; label: string }[]> = {
  chat: [
    { text: "Tóm tắt ngắn gọn các luận điểm chính trong tài liệu.", label: "Tóm tắt chính" },
    { text: "Có những nội dung nào đề cập đến ngân sách hay kế hoạch tài chính?", label: "Phân tích tài chính" },
    { text: "Rút ra 5 điều cốt lõi tôi cần nhớ từ nguồn này.", label: "5 bài học cốt lõi" }
  ],
  research: [
    { text: "Viết báo cáo phân tích sâu sắc về nội dung các tài liệu đã tải lên.", label: "Báo cáo chuyên sâu" },
    { text: "So sánh các phương pháp/quan điểm được trình bày giữa các tài liệu.", label: "So sánh đối chiếu" },
    { text: "Phân tích điểm mạnh, điểm yếu và các lỗ hổng thông tin trong tài liệu.", label: "Phân tích lỗ hổng" }
  ],
  quiz: [
    { text: "Tạo 5 câu hỏi trắc nghiệm kèm đáp án để kiểm tra kiến thức.", label: "Tạo Quiz trắc nghiệm" },
    { text: "Tạo đề thi tự luận ngắn về các khái niệm chính trong nguồn này.", label: "Tự luận ngắn" },
    { text: "Tạo một quiz nhanh 3 câu hỏi độ khó nâng cao về tài liệu.", label: "Quiz nâng cao" }
  ],
  roadmap: [
    { text: "Tạo lộ trình triển khai chi tiết từng bước dựa trên tài liệu.", label: "Lộ trình triển khai" },
    { text: "Xây dựng lộ trình học tập 4 tuần để nắm vững nội dung nguồn này.", label: "Lộ trình học 4 tuần" },
    { text: "Lập kế hoạch hành động 30-60-90 ngày từ các khuyến nghị trong tài liệu.", label: "Kế hoạch 30-60-90 ngày" }
  ]
};

const MODE_PLACEHOLDER: Record<Mode, string> = {
  chat: "Nhập câu hỏi thảo luận về nội dung các tài liệu nguồn...",
  research: "Mô tả cụ thể chủ đề nghiên cứu sâu cần tổng hợp báo cáo...",
  quiz: "Nhập yêu cầu: Ví dụ: Tạo 5 câu trắc nghiệm về chương 2...",
  roadmap: "Nhập yêu cầu: Ví dụ: Lập lộ trình học Python trong 6 tuần từ nguồn này...",
};

export default function NotebookWorkspace() {
  const router = useRouter();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNotebook, setActiveNotebook] = useState<Notebook | null>(null);
  const [mode, setMode] = useState<Mode>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [workflowLog, setWorkflowLog] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [rightSidebarTab, setRightSidebarTab] = useState<"sources" | "graph">("graph");
  const [multiAgentMode] = useState(true);
  const [activeCitation, setActiveCitation] = useState<{
    msgIdx: number;
    citation: CitationRef;
    rect: { top: number; left: number } | null;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchNotebooks = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/notebooks`);
      setNotebooks(res.data.notebooks || []);
    } catch (err) {
      console.error("Failed to load notebooks:", err);
    }
  }, []);

  const loadNotebook = useCallback(async (notebookId: string) => {
    try {
      const res = await axios.get(`${API}/notebooks/${notebookId}`);
      setActiveNotebook(res.data);
    } catch (err) {
      console.error("Failed to load notebook:", err);
    }
  }, []);

  useEffect(() => {
    fetchNotebooks();
  }, [fetchNotebooks]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, workflowLog, isProcessing]);

  useEffect(() => {
    if (!router.isReady) return;

    const restoreSession = async () => {
      const { session_id, notebook_id } = router.query;
      if (notebook_id && typeof notebook_id === "string") {
        await loadNotebook(notebook_id);

        if (session_id && typeof session_id === "string") {
          try {
            setSessionId(session_id);
            const historyRes = await axios.get(`${API}/sessions/${session_id}/history`);
            const fetchedMessages = historyRes.data.messages || [];
            const mapped = fetchedMessages.map((m: any) => ({
              role: m.role,
              content: m.content,
              mode: m.metadata?.mode || "chat",
              sources: m.metadata?.sources || [],
              citations: m.metadata?.citations || [],
            }));
            setMessages(mapped);

            const lastAssistant = [...fetchedMessages].reverse().find(m => m.role === "assistant");
            if (lastAssistant?.metadata?.mode) setMode(lastAssistant.metadata.mode);
          } catch (e) {
            console.error("Failed to load conversation history:", e);
          }
        }
      }
    };
    restoreSession();
  }, [router.isReady, router.query, loadNotebook]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeNotebook) return;

    setUploading(true);
    setUploadStatus("Đang tải lên...");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${API}/notebooks/${activeNotebook.notebook_id}/sources/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setUploadStatus(`✓ Đã thêm: ${res.data.upload?.filename || file.name}`);
      await loadNotebook(activeNotebook.notebook_id);
      await fetchNotebooks();
      setTimeout(() => setUploadStatus(""), 3000);
    } catch (err) {
      console.error(err);
      setUploadStatus("✗ Upload thất bại");
      setTimeout(() => setUploadStatus(""), 3000);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const deleteSource = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeNotebook || !confirm("Bạn có chắc muốn xóa nguồn tài liệu này khỏi Notebook?")) return;
    try {
      await axios.delete(`${API}/notebooks/${activeNotebook.notebook_id}/sources/${docId}`);
      await loadNotebook(activeNotebook.notebook_id);
      await fetchNotebooks();
    } catch (err) {
      console.error("Failed to delete source:", err);
    }
  };

  const sendMessage = async (overrideInput?: string) => {
    const queryText = (overrideInput || input).trim();
    if (!queryText || isProcessing || !activeNotebook) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", content: queryText, mode }]);
    setIsProcessing(true);
    setWorkflowLog([]);
    setActiveCitation(null);

    try {
      const res = await axios.post(`${API}/notebooks/${activeNotebook.notebook_id}/ask`, {
        query: queryText,
        mode,
        top_k: 5,
        session_id: sessionId || undefined,
      });

      if (res.data.workflow_log) setWorkflowLog(res.data.workflow_log);
      if (res.data.session_id && !sessionId) setSessionId(res.data.session_id);

      setMessages(prev => [...prev, {
        role: "assistant",
        content: res.data.answer,
        mode,
        sources: res.data.sources,
        citations: res.data.citations || [],
      }]);
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) && err.response?.data?.detail
        ? String(err.response.data.detail)
        : "Lỗi kết nối máy chủ backend. Vui lòng kiểm tra lại.";
      setMessages(prev => [...prev, { role: "assistant", content: detail }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setSessionId("");
    setWorkflowLog([]);
    setActiveCitation(null);
    router.replace("/", undefined, { shallow: true });
  };

  const getWorkflowSteps = () => {
    const steps = [
      { id: "research", label: "Researching", status: "idle" },
      { id: "summarize", label: "Summarizing", status: "idle" },
      { id: "critic", label: "Critiquing", status: "idle" },
      { id: "editor", label: "Editing", status: "idle" },
    ];

    if (!isProcessing && workflowLog.length === 0) return steps;

    let researchStatus = "idle", summarizeStatus = "idle", criticStatus = "idle", editorStatus = "idle";

    workflowLog.forEach(log => {
      if (log.includes("[Research] Researcher: searching")) researchStatus = "running";
      else if (log.includes("Researcher: found")) researchStatus = "success";
      if (log.includes("Summarizer: drafting report")) { researchStatus = "success"; summarizeStatus = "running"; }
      else if (log.includes("Summarizer: draft complete")) summarizeStatus = "success";
      if (log.includes("Critic: evaluating quality")) { summarizeStatus = "success"; criticStatus = "running"; }
      else if (log.includes("Critic: skipped")) criticStatus = "skipped";
      else if (log.includes("Critic: gaps=")) criticStatus = "success";
      if (log.includes("Editor: polishing report")) { criticStatus = criticStatus === "idle" || criticStatus === "running" ? "success" : criticStatus; editorStatus = "running"; }
      else if (log.includes("Editor: complete")) editorStatus = "success";
      else if (log.includes("Editor: skipped")) editorStatus = "skipped";
    });

    if (!isProcessing) {
      if (researchStatus === "running") researchStatus = "success";
      if (summarizeStatus === "running") summarizeStatus = "success";
      if (criticStatus === "running") criticStatus = "success";
      if (editorStatus === "running") editorStatus = "success";
    }

    steps[0].status = researchStatus;
    steps[1].status = summarizeStatus;
    steps[2].status = criticStatus;
    steps[3].status = editorStatus;
    return steps;
  };

  const handleChatCitationClick = (e: React.MouseEvent, msgIdx: number, citation: CitationRef) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveCitation({
      msgIdx,
      citation,
      rect: { top: rect.bottom + window.scrollY, left: rect.left + window.scrollX }
    });
  };

  const handleLegacyCitationClick = (e: React.MouseEvent, msgIdx: number, sourceIdx: number, sourceName: string) => {
    handleChatCitationClick(e, msgIdx, {
      citation_id: String(sourceIdx + 1),
      source_name: sourceName,
    });
  };

  const sources = activeNotebook?.sources_detail || [];

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-800 flex flex-col font-sans h-screen overflow-hidden">
      {/* Header */}
      <header className="h-[52px] border-b border-slate-200 bg-[#F8F9FA] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">N</div>
          <span className="font-bold text-slate-900 text-sm tracking-wide">NoteMind</span>
        </div>

        {activeNotebook && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
              Memory Active ({sources.length} nguồn)
            </span>
            <button onClick={() => setShowRightSidebar(!showRightSidebar)} className={`p-2 rounded-lg border transition-all cursor-pointer ${showRightSidebar ? "bg-white border-slate-200 text-indigo-600" : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700"}`}>
              {showRightSidebar ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>
        )}
      </header>

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-[260px] border-r border-slate-200 bg-slate-100 flex flex-col shrink-0 h-full">
          {activeNotebook ? (
            <div className="p-3 flex-1 flex flex-col min-h-0 bg-slate-50">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-slate-400" />
                  Nguồn Tài Liệu
                </span>
              </div>

              <label className="block mb-3 cursor-pointer">
                <div className={`border border-dashed rounded-lg p-3 text-center text-[10px] transition-all ${uploading ? "border-slate-200 bg-slate-100 text-slate-500" : "border-slate-300 text-slate-500 hover:border-indigo-300 hover:bg-white"}`}>
                  <Upload className="w-4 h-4 mx-auto mb-1 text-slate-500" />
                  {uploading ? "Đang xử lý..." : "+ Thêm PDF, DOCX, TXT"}
                  <input type="file" accept=".pdf,.docx,.html,.htm,.txt" onChange={handleUpload} disabled={uploading} className="hidden" />
                </div>
              </label>

              {uploadStatus && (
                <p className={`text-[10px] mb-3 px-2 py-1.5 rounded text-center border ${uploadStatus.startsWith("✓") ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-red-600 bg-red-50 border-red-200"}`}>
                  {uploadStatus}
                </p>
              )}

              <ul className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {sources.map((doc) => (
                  <li key={doc.doc_id} className="group flex items-start justify-between gap-1 p-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-[11px] hover:bg-slate-50 transition-all">
                    <div className="min-w-0 flex-1 flex items-start gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate" title={doc.original_filename}>{doc.original_filename}</div>
                        <div className="text-[9px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <span>{doc.file_type?.toUpperCase()}</span>
                          <span>·</span>
                          <span>{doc.chunks} chunks</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={(e) => deleteSource(doc.doc_id, e)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-500 rounded transition-all shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </li>
                ))}
                {sources.length === 0 && (
                  <li className="text-[10px] text-slate-500 text-center py-6 leading-relaxed">
                    Chưa tải tài liệu nào.<br />Hãy upload để làm kho kiến thức.
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-3">
              <p className="text-[10px] text-slate-500 text-center">Chọn hoặc tạo một Notebook để xem và quản lý tài liệu nguồn.</p>
            </div>
          )}
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#FAF9F6] h-full">
          {!activeNotebook ? (
            <div className="flex-1 flex items-center justify-center p-8" />
          ) : (
            <>
              {/* Mode Tabs */}
              <div className="px-4 py-2 border-b border-slate-200 bg-[#F8F9FA] flex justify-between items-center shrink-0">
                <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200">
                  {MODES.map((m) => {
                    const Icon = m.icon;
                    return (
                      <button key={m.id} onClick={() => { setMode(m.id); setActiveCitation(null); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all font-semibold cursor-pointer ${mode === m.id ? "bg-white text-indigo-600 shadow-sm border border-slate-200" : "text-slate-600 hover:text-slate-800"}`} title={m.hint}>
                        <Icon className={`w-3.5 h-3.5 ${mode === m.id ? "text-indigo-600" : "text-slate-500"}`} />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="text-[10px] text-slate-500 italic max-w-[200px] truncate hidden md:block">
                  {MODES.find((m) => m.id === mode)?.hint}
                </div>
              </div>

              {/* Multi-Agent Stepper */}
              {isProcessing && multiAgentMode && (
                <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
                  <div className="max-w-2xl mx-auto flex items-center justify-between gap-1.5 p-2 bg-white border border-slate-200 rounded-xl">
                    {getWorkflowSteps().map((step, idx, arr) => (
                      <div key={step.id} className="flex items-center flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] shrink-0 transition-all ${step.status === "running" ? "border-indigo-200 text-indigo-600 bg-indigo-50" : step.status === "success" ? "border-indigo-200 text-indigo-600 bg-white" : step.status === "skipped" ? "border-slate-200 text-slate-500 bg-slate-100" : "border-slate-200 text-slate-500 bg-slate-50"}`}>
                            {step.status === "running" ? <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" /> : step.status === "success" ? <CheckCircle className="w-3.5 h-3.5 text-indigo-600" /> : step.status === "skipped" ? <Info className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                          </div>
                          <span className={`text-[10px] font-bold truncate ${step.status === "running" ? "text-indigo-600" : step.status === "success" ? "text-slate-800" : "text-slate-500"}`}>
                            {step.label}
                          </span>
                        </div>
                        {idx < arr.length - 1 && <div className="flex-1 h-[1px] bg-slate-200 mx-3" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mode-Specific Content Area */}
              {mode === "chat" && (
                <ChatView
                  messages={messages}
                  isProcessing={isProcessing}
                  sources={sources}
                  quickPrompts={QUICK_PROMPTS.chat}
                  notebookTitle={activeNotebook.title}
                  onSendMessage={sendMessage}
                  onCitationClick={handleChatCitationClick}
                />
              )}
              {mode === "research" && (
                <ResearchView
                  messages={messages}
                  isProcessing={isProcessing}
                  sources={sources}
                  quickPrompts={QUICK_PROMPTS.research}
                  notebookTitle={activeNotebook.title}
                  onSendMessage={sendMessage}
                  onCitationClick={handleLegacyCitationClick}
                />
              )}
              {mode === "quiz" && (
                <QuizView
                  messages={messages}
                  isProcessing={isProcessing}
                  sources={sources}
                  quickPrompts={QUICK_PROMPTS.quiz}
                  notebookTitle={activeNotebook.title}
                  onSendMessage={sendMessage}
                />
              )}
              {mode === "roadmap" && (
                <RoadmapView
                  messages={messages}
                  isProcessing={isProcessing}
                  sources={sources}
                  quickPrompts={QUICK_PROMPTS.roadmap}
                  notebookTitle={activeNotebook.title}
                  onSendMessage={sendMessage}
                />
              )}

              {/* Input Box */}
              <div className="p-4 border-t border-slate-200 bg-[#F8F9FA] shrink-0">
                <div className="max-w-3xl mx-auto relative flex flex-col gap-2">
                  <div className="rounded-2xl p-2.5 flex flex-col gap-2 relative bg-white border border-slate-200 shadow-sm">
                    <textarea
                      rows={2}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (!isProcessing && input.trim() && sources.length > 0) sendMessage();
                        }
                      }}
                      disabled={isProcessing || sources.length === 0}
                      placeholder={sources.length === 0 ? "Vui lòng thêm tài liệu nguồn ở cột bên trái để có thể bắt đầu thảo luận..." : MODE_PLACEHOLDER[mode]}
                      className="w-full bg-transparent px-3 py-2 text-xs text-slate-800 focus:outline-none resize-none disabled:opacity-50"
                    />
                    <div className="flex items-center justify-between border-t border-slate-200 pt-2 px-2">
                      <div className="flex items-center gap-2 select-none">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={multiAgentMode} readOnly className="sr-only peer" />
                          <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-500 peer-checked:after:bg-white" />
                        </label>
                        <span className="text-[9px] font-bold text-slate-500 tracking-wider uppercase flex items-center gap-1">
                          <Bot className="w-3.5 h-3.5 text-indigo-600" />
                          Multi-Agent Mode
                        </span>
                      </div>
                      <button onClick={() => sendMessage()} disabled={isProcessing || !input.trim() || sources.length === 0} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>

        {/* Right Sidebar */}
        {activeNotebook && showRightSidebar && (
          <aside className="w-[320px] border-l border-slate-200 bg-slate-100 flex flex-col shrink-0 h-full">
            <div className="px-3 py-2.5 border-b border-slate-200 bg-slate-100 flex items-center justify-between shrink-0">
              <div className="bg-slate-100 p-0.5 rounded-lg flex border border-slate-200">
                <button onClick={() => setRightSidebarTab("graph")} className={`px-3 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer ${rightSidebarTab === "graph" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Agent Graph</button>
              </div>
              <button onClick={() => setShowRightSidebar(false)} className="text-slate-500 hover:text-slate-800 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AgentGraph workflowLog={workflowLog} isProcessing={isProcessing} />
            </div>
          </aside>
        )}
      </div>

      {/* Citation Popover */}
      {activeCitation && (
        <>
          <div className="fixed inset-0 z-40 cursor-default" onClick={() => setActiveCitation(null)} />
          <div className="absolute z-50 bg-white p-4 rounded-xl w-72 text-xs border border-slate-200 shadow-sm text-slate-700" style={{ top: `${activeCitation.rect ? activeCitation.rect.top + 8 : 0}px`, left: `${activeCitation.rect ? Math.min(activeCitation.rect.left, window.innerWidth - 300) : 0}px` }}>
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
              <span className="font-semibold text-indigo-600 flex items-center gap-1.5 uppercase tracking-wider text-[10px]"><FileText className="w-3.5 h-3.5 text-indigo-600" />Trích dẫn [{activeCitation.citation.citation_id}]</span>
              <button onClick={() => setActiveCitation(null)} className="text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"><X className="w-3.5 h-3.5" /></button>
            </div>
            <p className="font-semibold text-slate-900 truncate mb-1" title={activeCitation.citation.source_name}>{activeCitation.citation.source_name}</p>
            {activeCitation.citation.text_span && (
              <p className="leading-relaxed text-slate-700 text-[11px] mb-2 rounded-lg bg-indigo-50 border border-indigo-100 px-2.5 py-2">
                "{activeCitation.citation.text_span}"
              </p>
            )}
            <p className="leading-relaxed text-slate-600 text-[11px] mb-2.5">
              {activeCitation.citation.chunk_text
                ? activeCitation.citation.chunk_text
                : "Hệ thống vector database đã lọc ra đoạn văn bản (chunk) liên quan để làm cơ sở dẫn chứng."}
            </p>
            <button onClick={() => { setActiveCitation(null); setRightSidebarTab("sources"); setShowRightSidebar(true); }} className="w-full py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200 hover:border-slate-300 rounded transition-all flex items-center justify-center gap-1 cursor-pointer">
              <span>Xem thông tin nguồn ở sidebar</span>
              <ArrowRight className="w-3 h-3 text-indigo-600" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
