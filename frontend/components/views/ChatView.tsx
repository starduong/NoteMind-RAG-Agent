import { useEffect, useRef } from "react";
import { ArrowRight, MessageSquare, RefreshCw, Bot } from "lucide-react";

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

interface QuickPrompt {
  text: string;
  label: string;
}

interface ChatViewProps {
  messages: Message[];
  isProcessing: boolean;
  sources: SourceDoc[];
  quickPrompts: QuickPrompt[];
  notebookTitle: string;
  onSendMessage: (text: string) => void;
  onCitationClick: (e: React.MouseEvent, msgIdx: number, citation: CitationRef) => void;
}

/** Minimal Markdown renderer — bold, italic, inline code, code blocks, headings, bullets */
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLang = "";
  let keyIdx = 0;

  const nextKey = () => `md-${keyIdx++}`;

  const renderInline = (str: string): React.ReactNode => {
    // code, bold, italic
    const parts = str.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((p, i) => {
      if (p.startsWith("**") && p.endsWith("**"))
        return <strong key={i} className="font-semibold text-slate-900">{p.slice(2, -2)}</strong>;
      if (p.startsWith("*") && p.endsWith("*"))
        return <em key={i} className="italic">{p.slice(1, -1)}</em>;
      if (p.startsWith("`") && p.endsWith("`"))
        return <code key={i} className="px-1 py-0.5 rounded bg-slate-100 text-indigo-700 font-mono text-[11px]">{p.slice(1, -1)}</code>;
      return p;
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
        codeLines = [];
      } else {
        inCodeBlock = false;
        elements.push(
          <pre key={nextKey()} className="my-2 p-3 rounded-xl bg-slate-900 text-emerald-300 text-[11px] font-mono overflow-x-auto border border-slate-700">
            <code>{codeLines.join("\n")}</code>
          </pre>
        );
        codeLines = [];
      }
      continue;
    }

    if (inCodeBlock) { codeLines.push(line); continue; }

    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^(#+)/)?.[1].length || 1;
      const content = line.replace(/^#+\s/, "");
      const cls = level === 1
        ? "text-base font-bold text-slate-900 mt-3 mb-1"
        : level === 2
          ? "text-sm font-bold text-slate-800 mt-2 mb-1"
          : "text-xs font-bold text-slate-700 mt-1.5 mb-0.5";
      elements.push(<div key={nextKey()} className={cls}>{renderInline(content)}</div>);
      continue;
    }

    if (/^[-*]\s/.test(line)) {
      elements.push(
        <div key={nextKey()} className="flex gap-2 text-slate-700 text-sm leading-relaxed">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
          <span>{renderInline(line.replace(/^[-*]\s/, ""))}</span>
        </div>
      );
      continue;
    }

    if (line.trim() === "") {
      elements.push(<div key={nextKey()} className="h-1.5" />);
      continue;
    }

    elements.push(
      <p key={nextKey()} className="text-sm text-slate-700 leading-relaxed">{renderInline(line)}</p>
    );
  }

  return <>{elements}</>;
}

export default function ChatView({
  messages,
  isProcessing,
  sources,
  quickPrompts,
  notebookTitle,
  onSendMessage,
  onCitationClick,
}: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  const renderCitations = (msg: Message, msgIdx: number) => {
    const citationMap = new Map<string, CitationRef>();
    (msg.citations || []).forEach((citation) => {
      if (!citationMap.has(citation.citation_id)) {
        citationMap.set(citation.citation_id, citation);
      }
    });

    const orderedCitations = [...citationMap.values()];
    if (orderedCitations.length === 0) return null;
    return (
      <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap gap-1.5">
        <span className="w-full text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
          Tài liệu tham chiếu
        </span>
        {orderedCitations.map((citation) => (
          <button
            key={citation.citation_id}
            onClick={(e) => onCitationClick(e, msgIdx, citation)}
            className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 transition-all flex items-center gap-1 cursor-pointer text-[10px] font-mono"
          >
            <span className="text-indigo-600 font-bold">[{citation.citation_id}]</span>
            <span className="truncate max-w-[130px]">{citation.source_name}</span>
          </button>
        ))}
      </div>
    );
  };

  const renderContent = (msg: Message, msgIdx: number) => {
    const text = msg.content;
    const citationById = new Map<string, CitationRef>();
    (msg.citations || []).forEach((citation) => {
      citationById.set(citation.citation_id, citation);
    });

    const inlinedText = text.split(/(\[[A-Z]+\])/g).map((part, partIdx) => {
      const match = part.match(/^\[([A-Z]+)\]$/);
      if (match) {
        const citationId = match[1];
        const citation = citationById.get(citationId);
        if (citation) {
          return (
            <button
              key={partIdx}
              onClick={(e) => onCitationClick(e, msgIdx, citation)}
              className="inline-flex items-center justify-center px-1.5 py-0.5 mx-0.5 text-[9px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 hover:border-indigo-400 rounded transition-all cursor-pointer align-super font-mono"
            >
              {citationId}
            </button>
          );
        }
      }
      return part;
    });

    // If content has citation markers, render inline with citations; otherwise pure markdown
    const hasCitations = citationById.size > 0 && /\[[A-Z]+\]/.test(text);

    return (
      <div>
        {hasCitations
          ? <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{inlinedText}</div>
          : renderMarkdown(text)
        }
        {renderCitations(msg, msgIdx)}
      </div>
    );
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-xl">
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm text-center mb-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">{notebookTitle}</h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
              {sources.length === 0
                ? "Vui lòng tải ít nhất một nguồn tài liệu ở cột trái trước khi bắt đầu hỏi đáp."
                : "Tài liệu đã sẵn sàng. Chọn gợi ý bên dưới hoặc tự nhập câu hỏi."}
            </p>
          </div>

          {sources.length > 0 && (
            <div className="grid grid-cols-1 gap-2.5">
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => onSendMessage(prompt.text)}
                  className="group w-full p-3 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 cursor-pointer flex items-center justify-between transition-all text-left"
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
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            {/* Avatar */}
            <div className={`w-7 h-7 rounded-xl shrink-0 flex items-center justify-center text-[10px] font-bold mt-1 ${msg.role === "user"
                ? "bg-slate-800 text-white"
                : "bg-indigo-600 text-white"
              }`}>
              {msg.role === "user" ? "U" : <Bot className="w-4 h-4" />}
            </div>

            {/* Bubble */}
            <div className={`max-w-[82%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === "user"
                  ? "bg-slate-800 text-white rounded-tr-sm"
                  : "bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm"
                }`}>
                {msg.role === "user"
                  ? <div className="whitespace-pre-wrap">{msg.content}</div>
                  : renderContent(msg, idx)
                }
              </div>
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex gap-3 flex-row">
            <div className="w-7 h-7 rounded-xl shrink-0 bg-indigo-600 text-white flex items-center justify-center mt-1 animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">NoteMind AI</div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white border border-slate-200 shadow-sm flex items-center gap-2.5">
                <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                <span className="text-xs text-slate-400 italic">Đang tổng hợp câu trả lời...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
