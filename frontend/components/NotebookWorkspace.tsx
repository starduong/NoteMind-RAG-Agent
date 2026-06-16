import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useRouter } from "next/router";
import {
  Trash2, Send, Sparkles, Layers, Compass, MessageSquare, Upload, X,
  CheckCircle, RefreshCw, FileText,
  Database, Bot, Zap, FolderOpen
} from "lucide-react";
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

const MODES = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "research", label: "Research", icon: Sparkles },
  { id: "quiz", label: "Quiz", icon: Layers },
  { id: "roadmap", label: "Roadmap", icon: Compass },
] as const;

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
  chat: "Ask questions about your documents...",
  research: "Describe your research topic for in-depth analysis...",
  quiz: "E.g., Generate 5 questions about chapter 2...",
  roadmap: "E.g., Create a 6-week Python learning path...",
};

const getModeStyles = (mode: Mode) => ({
  chat: { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-700", icon: "text-sky-600" },
  research: { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700", icon: "text-indigo-600" },
  quiz: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", icon: "text-emerald-600" },
  roadmap: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", icon: "text-amber-600" },
}[mode]);

export default function NotebookWorkspace() {
  const router = useRouter();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNotebook, setActiveNotebook] = useState<Notebook | null>(null);
  const [mode, setMode] = useState<Mode>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [activeCitation, setActiveCitation] = useState<{
    msgIdx: number;
    citation: CitationRef;
    rect: { top: number; left: number } | null;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchNotebooks = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/notebooks`);
      setNotebooks(data.notebooks || []);
    } catch (err) {
      console.error("Failed to load notebooks:", err);
    }
  }, []);

  const loadNotebook = useCallback(async (notebookId: string) => {
    try {
      const { data } = await axios.get(`${API}/notebooks/${notebookId}`);
      setActiveNotebook(data);
    } catch (err) {
      console.error("Failed to load notebook:", err);
    }
  }, []);

  useEffect(() => {
    fetchNotebooks();
  }, [fetchNotebooks]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!router.isReady) return;

    const { session_id, notebook_id } = router.query;
    if (notebook_id && typeof notebook_id === "string") {
      loadNotebook(notebook_id);
      if (session_id && typeof session_id === "string") {
        setSessionId(session_id);
        axios.get(`${API}/sessions/${session_id}/history`)
          .then(({ data }) => {
            const mapped = data.messages.map((m: any) => ({
              role: m.role,
              content: m.content,
              mode: m.metadata?.mode || "chat",
              sources: m.metadata?.sources || [],
              citations: m.metadata?.citations || [],
            }));
            setMessages(mapped);
            const lastAssistant = [...data.messages].reverse().find(m => m.role === "assistant");
            if (lastAssistant?.metadata?.mode) setMode(lastAssistant.metadata.mode);
          })
          .catch(e => console.error("Failed to load conversation history:", e));
      }
    }
  }, [router.isReady, router.query, loadNotebook]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeNotebook) return;

    setUploading(true);
    setUploadStatus("Uploading...");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const { data } = await axios.post(`${API}/notebooks/${activeNotebook.notebook_id}/sources/upload`, formData);
      setUploadStatus(`✓ Added: ${data.upload?.filename || file.name}`);
      await loadNotebook(activeNotebook.notebook_id);
      await fetchNotebooks();
      setTimeout(() => setUploadStatus(""), 3000);
    } catch (err) {
      console.error(err);
      setUploadStatus("✗ Upload failed");
      setTimeout(() => setUploadStatus(""), 3000);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const deleteSource = async (docId: string) => {
    if (!activeNotebook || !confirm("Are you sure you want to delete this source?")) return;
    try {
      await axios.delete(`${API}/notebooks/${activeNotebook.notebook_id}/sources/${docId}`);
      await loadNotebook(activeNotebook.notebook_id);
      await fetchNotebooks();
    } catch (err) {
      console.error("Failed to delete source:", err);
    }
  };

  const sendMessage = async (overrideInput?: string) => {
    const query = (overrideInput || input).trim();
    if (!query || isProcessing || !activeNotebook) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", content: query, mode }]);
    setIsProcessing(true);
    setActiveCitation(null);

    try {
      const { data } = await axios.post(`${API}/notebooks/${activeNotebook.notebook_id}/ask`, {
        query,
        mode,
        top_k: 5,
        session_id: sessionId || undefined,
      });

      if (data.session_id && !sessionId) setSessionId(data.session_id);

      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.answer,
        mode,
        sources: data.sources,
        citations: data.citations || [],
      }]);
    } catch (err) {
      const detail = axios.isAxiosError(err) && err.response?.data?.detail
        ? String(err.response.data.detail)
        : "Backend connection error. Please check your server.";
      setMessages(prev => [...prev, { role: "assistant", content: detail }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setSessionId("");
    setActiveCitation(null);
    router.replace("/", undefined, { shallow: true });
  };

  const goToHome = () => {
    router.push("/");
  };

  const handleChatCitationClick = (e: React.MouseEvent, msgIdx: number, citation: CitationRef) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveCitation({
      msgIdx,
      citation,
      rect: { top: rect.bottom + window.scrollY, left: rect.left + window.scrollX }
    });
  };

  const handleResearchCitationClick = (e: React.MouseEvent, msgIdx: number, sourceIdx: number, sourceName: string) => {
    handleChatCitationClick(e, msgIdx, {
      citation_id: String(sourceIdx + 1),
      source_name: sourceName,
    });
  };

  const sources = activeNotebook?.sources_detail || [];
  const style = getModeStyles(mode);

  const renderView = () => {
    const baseProps = {
      messages,
      isProcessing,
      sources,
      quickPrompts: QUICK_PROMPTS[mode],
      notebookTitle: activeNotebook?.title || "",
      onSendMessage: sendMessage,
    };

    switch (mode) {
      case "chat":
        return <ChatView {...baseProps} onCitationClick={handleChatCitationClick} />;
      case "research":
        return <ResearchView {...baseProps} onCitationClick={handleResearchCitationClick} />;
      case "quiz":
        return <QuizView {...baseProps} />;
      case "roadmap":
        return <RoadmapView {...baseProps} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-800 flex font-sans h-screen overflow-hidden">
      {/* Sidebar - Now includes header */}
      <aside className="w-[280px] border-r border-slate-200 bg-white/80 backdrop-blur-sm flex flex-col shrink-0 h-full">
        {/* Header inside sidebar - Clickable */}
        <div 
          onClick={goToHome}
          className="h-[60px] border-b border-slate-200/80 flex items-center gap-3 px-4 shrink-0 cursor-pointer group transition-all hover:bg-indigo-50/30"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 group-hover:shadow-indigo-300 transition-all group-hover:scale-105">
            <Zap className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient group-hover:scale-105 transition-transform whitespace-nowrap">
            NoteMind
          </span>
        </div>

        {activeNotebook ? (
          <div className="p-4 flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Notebook title header - Vị trí mới */}
            <div className="mb-4 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                  <FolderOpen className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-slate-700 truncate bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent hover:from-indigo-600 hover:to-purple-600 transition-all duration-300 block">
                    {activeNotebook.title}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Knowledge Base</span>
              </div>
              <span className="text-xs font-medium text-slate-400">{sources.length} files</span>
            </div>

            <label className="block mb-4 cursor-pointer">
              <div className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
                uploading ? "border-slate-200 bg-slate-50 text-slate-400" : "border-slate-300 hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-500"
              }`}>
                <Upload className={`w-5 h-5 mx-auto mb-2 ${uploading ? "text-slate-400" : "text-indigo-500"}`} />
                <p className="text-xs font-medium">{uploading ? "Processing..." : "Upload PDF, DOCX, TXT"}</p>
                <input type="file" accept=".pdf,.docx,.html,.htm,.txt" onChange={handleUpload} disabled={uploading} className="hidden" />
              </div>
            </label>

            {uploadStatus && (
              <div className={`mb-4 px-3 py-2 rounded-lg text-xs font-medium text-center ${
                uploadStatus.startsWith("✓") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
              }`}>
                {uploadStatus}
              </div>
            )}

            <div className="flex-1 overflow-y-auto -mx-2 px-2">
              {sources.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-500 font-medium">No documents yet</p>
                  <p className="text-[10px] text-slate-400 mt-1">Upload files to start your knowledge base</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {sources.map(doc => (
                    <li key={doc.doc_id} className="group flex items-start justify-between gap-2 p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-all">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="text-xs font-semibold text-slate-700 truncate">{doc.original_filename}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                          <span>{doc.file_type?.toUpperCase()}</span>
                          <span>•</span>
                          <span>{doc.chunks} chunks</span>
                        </div>
                      </div>
                      <button onClick={() => deleteSource(doc.doc_id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <div>
              <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600">No Notebook Selected</p>
              <p className="text-xs text-slate-400 mt-1">Create or select a notebook to get started</p>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content - Full height, no header */}
      <main className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-white to-slate-50/50 h-full">
        {!activeNotebook ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
                <Zap className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Welcome to NoteMind</h2>
              <p className="text-sm text-slate-500 mt-2">Select a notebook or create a new one to start your AI-powered research</p>
            </div>
          </div>
        ) : (
          <>
            {/* Mode Tabs */}
            <div className="px-4 py-2 border-b border-slate-200 bg-white/80 backdrop-blur-sm flex justify-between items-center shrink-0">
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                {MODES.map(m => {
                  const Icon = m.icon;
                  const isActive = mode === m.id;
                  const s = getModeStyles(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => { setMode(m.id); setActiveCitation(null); }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isActive ? `${s.bg} ${s.text} shadow-sm border ${s.border}` : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? s.icon : "text-slate-400"}`} />
                      <span>{m.label}</span>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                    </button>
                  );
                })}
              </div>
              <button onClick={startNewConversation} className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                New Chat
              </button>
            </div>

            {/* Processing */}
            {isProcessing && (
              <div className="px-4 py-2 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border-b border-indigo-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-indigo-700">Processing your request...</p>
                    <p className="text-[10px] text-indigo-500">AI is analyzing your documents</p>
                  </div>
                </div>
              </div>
            )}

            {/* View */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {renderView()}
            </div>

            {/* Input */}
            <div className="p-2 border-t border-slate-200 bg-white/80 backdrop-blur-sm shrink-0">
              <div className="max-w-4xl mx-auto">
                <div className="relative rounded-2xl bg-white border-2 border-slate-200 hover:border-indigo-300 focus-within:border-indigo-500 focus-within:shadow-lg focus-within:shadow-indigo-100 transition-all duration-200">
                  <div className="flex items-end gap-2 px-3 py-1.5">
                    <textarea
                      rows={1}
                      value={input}
                      onChange={e => {
                        setInput(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
                      }}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey && !isProcessing && input.trim() && sources.length > 0) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      disabled={isProcessing || sources.length === 0}
                      placeholder={sources.length === 0 ? "📄 Add source documents to start..." : MODE_PLACEHOLDER[mode]}
                      className="flex-1 bg-transparent text-sm text-slate-700 focus:outline-none resize-none placeholder:text-slate-400 leading-6 py-2 min-h-[40px] max-h-[80px] disabled:opacity-50"
                      style={{ height: '40px' }}
                    />
                    
                    <button
                      onClick={() => sendMessage()}
                      disabled={isProcessing || !input.trim() || sources.length === 0}
                      className="shrink-0 p-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-indigo-200 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center min-w-[44px] min-h-[44px]"
                    >
                      {isProcessing ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  
                  <div className="absolute bottom-1 right-16 text-[10px] text-slate-400 pointer-events-none">
                    {input.length > 0 && (
                      <span className="bg-white/80 px-1.5 py-0.5 rounded">
                        {input.length} chars
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="mt-1 flex items-center justify-between px-1">
                  <span className="text-[10px] text-slate-400">
                    {sources.length > 0 ? 'Press Enter to send, Shift+Enter for new line' : 'Upload documents to enable chat'}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Citation Popover */}
      {activeCitation && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setActiveCitation(null)} />
          <div
            className="fixed z-50 bg-white rounded-2xl p-5 w-80 shadow-xl border border-slate-200"
            style={{
              top: `${activeCitation.rect ? activeCitation.rect.top + 12 : 0}px`,
              left: `${activeCitation.rect ? Math.min(activeCitation.rect.left, window.innerWidth - 340) : 0}px`
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-indigo-600 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Citation [{activeCitation.citation.citation_id}]
              </span>
              <button onClick={() => setActiveCitation(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm font-semibold text-slate-800 truncate mb-2">{activeCitation.citation.source_name}</p>
            {activeCitation.citation.text_span && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 mb-3">
                <p className="text-xs text-slate-700 italic">"{activeCitation.citation.text_span}"</p>
              </div>
            )}
            <p className="text-xs text-slate-500 leading-relaxed mb-3">
              {activeCitation.citation.chunk_text || "Relevant text chunk retrieved from vector database."}
            </p>
            <button onClick={() => setActiveCitation(null)} className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl transition-all">
              Close
            </button>
          </div>
        </>
      )}

      {/* Add custom CSS for gradient animation */}
      <style jsx>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient {
          animation: gradient 3s ease infinite;
          background-size: 200% auto;
        }
      `}</style>
    </div>
  );
}