import { useEffect, useRef } from "react";
import { ArrowRight, MessageSquare, RefreshCw, Bot } from "lucide-react";
import ToolsPanel, { ToolsData } from "./chat/ToolsPanel";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Mode = "chat" | "quiz" | "roadmap";

interface Message {
  role: "user" | "assistant";
  content: string;
  mode?: Mode;
  sources?: string[];
  citations?: CitationRef[];
  tools_data?: ToolsData | null;
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
          References
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
    const text = msg.content || "";
    const citationById = new Map<string, CitationRef>();
    (msg.citations || []).forEach((citation) => {
      citationById.set(citation.citation_id, citation);
    });

    // Replace [A] with [A](#citation-A) so ReactMarkdown parses it as a link
    const processedText = text.replace(/\[([A-Z]+)\]/g, '[$1](#citation-$1)');

    return (
      <div>
        <div className="prose prose-sm prose-slate max-w-none prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:text-emerald-300">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ node, href, children, ...props }) => {
                if (href?.startsWith("#citation-")) {
                  const citationId = href.replace("#citation-", "");
                  const citation = citationById.get(citationId);
                  if (citation) {
                    return (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          onCitationClick(e, msgIdx, citation);
                        }}
                        className="inline-flex items-center justify-center px-1.5 py-0.5 mx-0.5 text-[9px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 hover:border-indigo-400 rounded transition-all cursor-pointer align-super font-mono no-underline"
                        title={citation.source_name}
                      >
                        {citationId}
                      </button>
                    );
                  }
                }
                // Regular links
                return (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline" {...props}>
                    {children}
                  </a>
                );
              },
            }}
          >
            {processedText}
          </ReactMarkdown>
        </div>
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
            <p className="text-xs text-slate-400 leading-relaxed mx-auto whitespace-nowrap">
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
                  : (
                    <>
                      {renderContent(msg, idx)}
                      {msg.tools_data && <ToolsPanel toolsData={msg.tools_data} />}
                    </>
                  )
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
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white border border-slate-200 shadow-sm flex items-center gap-2.5">
                <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                <span className="text-xs text-slate-400 italic">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
