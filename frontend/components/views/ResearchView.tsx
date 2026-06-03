import { useEffect, useRef } from "react";
import {
  ArrowRight, Sparkles, FileText, Download, Copy, BookOpen,
  RefreshCw, ChevronRight, ExternalLink
} from "lucide-react";

type Mode = "chat" | "research" | "quiz" | "roadmap";

interface Message {
  role: "user" | "assistant";
  content: string;
  mode?: Mode;
  sources?: string[];
}

interface SourceDoc {
  doc_id: string;
  original_filename: string;
  file_type: string;
  chunks: number;
}

interface QuickPrompt {
  text: string;
  label: string;
}

interface ResearchViewProps {
  messages: Message[];
  isProcessing: boolean;
  sources: SourceDoc[];
  quickPrompts: QuickPrompt[];
  notebookTitle: string;
  onSendMessage: (text: string) => void;
  onCitationClick: (
    e: React.MouseEvent,
    msgIdx: number,
    sourceIdx: number,
    sourceName: string
  ) => void;
}

/** Render structured academic Markdown */
function renderAcademicMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let keyIdx = 0;
  const nextKey = () => `r-${keyIdx++}`;

  const renderInline = (str: string): React.ReactNode =>
    str.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g).map((p, i) => {
      if (p.startsWith("**") && p.endsWith("**"))
        return <strong key={i} className="font-semibold text-slate-900">{p.slice(2, -2)}</strong>;
      if (p.startsWith("*") && p.endsWith("*"))
        return <em key={i} className="italic text-slate-600">{p.slice(1, -1)}</em>;
      if (p.startsWith("`") && p.endsWith("`"))
        return <code key={i} className="px-1 py-0.5 rounded bg-slate-100 text-indigo-700 font-mono text-[11px]">{p.slice(1, -1)}</code>;
      return p;
    });

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      if (!inCodeBlock) { inCodeBlock = true; codeLines = []; }
      else {
        inCodeBlock = false;
        elements.push(
          <pre key={nextKey()} className="my-3 p-3 rounded-xl bg-slate-900 text-emerald-300 text-[11px] font-mono overflow-x-auto border border-slate-700">
            <code>{codeLines.join("\n")}</code>
          </pre>
        );
      }
      continue;
    }
    if (inCodeBlock) { codeLines.push(line); continue; }

    if (/^# /.test(line)) {
      elements.push(
        <h2 key={nextKey()} className="text-lg font-bold text-slate-900 mt-4 mb-2 pb-2 border-b border-slate-200 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
          {renderInline(line.replace(/^# /, ""))}
        </h2>
      );
    } else if (/^## /.test(line)) {
      elements.push(
        <h3 key={nextKey()} className="text-sm font-bold text-indigo-700 mt-3 mb-1.5 flex items-center gap-1.5">
          <ChevronRight className="w-3.5 h-3.5" />
          {renderInline(line.replace(/^## /, ""))}
        </h3>
      );
    } else if (/^### /.test(line)) {
      elements.push(
        <h4 key={nextKey()} className="text-xs font-bold text-slate-700 mt-2 mb-1 uppercase tracking-wider">
          {renderInline(line.replace(/^### /, ""))}
        </h4>
      );
    } else if (/^[-*]\s/.test(line)) {
      elements.push(
        <div key={nextKey()} className="flex gap-2 text-slate-700 text-sm leading-relaxed py-0.5">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
          <span>{renderInline(line.replace(/^[-*]\s/, ""))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)/)?.[1];
      elements.push(
        <div key={nextKey()} className="flex gap-2.5 text-slate-700 text-sm leading-relaxed py-0.5">
          <span className="mt-0.5 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">
            {num}
          </span>
          <span>{renderInline(line.replace(/^\d+\.\s/, ""))}</span>
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={nextKey()} className="h-2" />);
    } else {
      elements.push(
        <p key={nextKey()} className="text-sm text-slate-700 leading-relaxed">{renderInline(line)}</p>
      );
    }
  }
  return <>{elements}</>;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ResearchView({
  messages,
  isProcessing,
  sources,
  quickPrompts,
  notebookTitle,
  onSendMessage,
  onCitationClick,
}: ResearchViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  // Get the last research pair (user query + assistant response)
  const researchPairs: { query: Message; answer: Message; pairIdx: number }[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].role === "user" && messages[i + 1].role === "assistant") {
      researchPairs.push({ query: messages[i], answer: messages[i + 1], pairIdx: i + 1 });
      i++;
    }
  }
  const lastPair = researchPairs[researchPairs.length - 1] ?? null;

  if (messages.length === 0 && !isProcessing) {
    return (
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <div className="p-6 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white shadow-sm text-center mb-5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-md">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">{notebookTitle}</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              {sources.length === 0
                ? "Tải tài liệu nguồn trước để bắt đầu nghiên cứu sâu."
                : "Chế độ Nghiên cứu phân tích tài liệu theo chiều sâu. Chọn chủ đề hoặc nhập yêu cầu của bạn."}
            </p>
          </div>
          {sources.length > 0 && (
            <div className="grid grid-cols-1 gap-2.5">
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => onSendMessage(prompt.text)}
                  className="group w-full p-3.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50 cursor-pointer flex items-center justify-between transition-all text-left"
                >
                  <div className="min-w-0 pr-4">
                    <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-0.5">{prompt.label}</div>
                    <div className="text-xs text-slate-600 truncate">{prompt.text}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Previous research sessions summary */}
        {researchPairs.length > 1 && (
          <div className="space-y-2">
            {researchPairs.slice(0, -1).map(({ query, answer, pairIdx }, i) => (
              <details key={i} className="group border border-slate-200 rounded-xl overflow-hidden bg-white">
                <summary className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 text-xs font-semibold text-slate-600 list-none">
                  <span className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                    {query.content.length > 80 ? query.content.slice(0, 80) + "..." : query.content}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-open:rotate-90 transition-transform" />
                </summary>
                <div className="px-4 pb-4 pt-1 border-t border-slate-100 text-sm text-slate-600 leading-relaxed max-h-40 overflow-y-auto">
                  {answer.content.slice(0, 400)}...
                </div>
              </details>
            ))}
          </div>
        )}

        {/* Current / Latest Research — Split Layout */}
        {lastPair ? (
          <div className="grid grid-cols-5 gap-4 min-h-[500px]">
            {/* Left: References & Snippets */}
            <div className="col-span-2 flex flex-col gap-3">
              <div className="flex items-center gap-1.5 mb-1">
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nguồn tham chiếu</span>
              </div>

              {/* Query card */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Truy vấn nghiên cứu</div>
                <p className="text-xs text-slate-700 font-medium leading-relaxed">{lastPair.query.content}</p>
              </div>

              {/* Source documents cited */}
              {lastPair.answer.sources && lastPair.answer.sources.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Tài liệu được trích dẫn</div>
                  {[...new Set(lastPair.answer.sources)].map((src, sIdx) => (
                    <button
                      key={sIdx}
                      onClick={(e) => onCitationClick(e, lastPair.pairIdx, sIdx, src)}
                      className="group w-full p-2.5 rounded-lg border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 transition-all flex items-start gap-2 text-left cursor-pointer"
                    >
                      <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{sIdx + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-semibold text-slate-700 truncate group-hover:text-indigo-700">{src}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5">Nhấn để xem chi tiết</div>
                      </div>
                      <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-indigo-400 shrink-0 mt-1" />
                    </button>
                  ))}
                </div>
              )}

              {/* Notebook sources */}
              {sources.length > 0 && (
                <div className="mt-2">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Kho tài liệu Notebook</div>
                  <div className="space-y-1">
                    {sources.map((doc) => (
                      <div key={doc.doc_id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white border border-slate-100 text-[10px]">
                        <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="text-slate-600 truncate">{doc.original_filename}</span>
                        <span className="ml-auto text-slate-400 shrink-0">{doc.chunks} chunks</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Deep Synthesized Insights */}
            <div className="col-span-3 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tổng hợp chuyên sâu</span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => copyToClipboard(lastPair.answer.content)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[10px] font-semibold text-slate-600 hover:text-slate-800 transition-all cursor-pointer"
                  >
                    <Copy className="w-3 h-3" /> Sao chép
                  </button>
                  <button
                    onClick={() => downloadText(lastPair.answer.content, "research-synthesis.txt")}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-[10px] font-semibold text-indigo-700 transition-all cursor-pointer"
                  >
                    <Download className="w-3 h-3" /> Xuất báo cáo
                  </button>
                </div>
              </div>

              <div className="flex-1 p-5 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-y-auto">
                {renderAcademicMarkdown(lastPair.answer.content)}
              </div>
            </div>
          </div>
        ) : null}

        {/* Processing state */}
        {isProcessing && (
          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-2 p-4 rounded-xl border border-slate-200 bg-slate-50 animate-pulse">
              <div className="h-3 bg-slate-200 rounded w-1/2 mb-3" />
              <div className="h-8 bg-slate-200 rounded w-full mb-2" />
              <div className="h-4 bg-slate-200 rounded w-3/4" />
            </div>
            <div className="col-span-3 p-5 rounded-2xl border border-indigo-100 bg-white flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Agents đang nghiên cứu...</p>
              <p className="text-xs text-slate-400 text-center max-w-xs">
                Hệ thống đang tìm kiếm, tổng hợp, phản biện và hoàn thiện báo cáo từ tài liệu nguồn.
              </p>
              <div className="flex gap-1 mt-1">
                {["Tìm kiếm", "Tổng hợp", "Phản biện", "Hoàn thiện"].map((step, i) => (
                  <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 font-medium animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}>
                    {step}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
