import { useState, useEffect, useRef } from "react";
import {
  ArrowRight, Compass, CheckCircle, ChevronDown, ChevronUp,
  RefreshCw, Lock, Unlock, BookOpen, Target, Trophy, Circle
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

interface Milestone {
  id: number;
  title: string;
  description: string;
  subTasks: string[];
  resources: string[];
  phase?: string;
}

interface RoadmapViewProps {
  messages: Message[];
  isProcessing: boolean;
  sources: SourceDoc[];
  quickPrompts: QuickPrompt[];
  notebookTitle: string;
  onSendMessage: (text: string) => void;
}

/** Parse Markdown headings into milestones */
function parseRoadmap(content: string): Milestone[] {
  const lines = content.split("\n");
  const milestones: Milestone[] = [];
  let current: Milestone | null = null;
  let id = 1;
  let inSubTask = false;
  let inResource = false;

  for (const line of lines) {
    // H2 = new milestone
    if (/^## /.test(line)) {
      if (current) milestones.push(current);
      current = {
        id: id++,
        title: line.replace(/^## /, "").replace(/^\d+\.\s*/, "").trim(),
        description: "",
        subTasks: [],
        resources: [],
        phase: undefined,
      };
      inSubTask = false;
      inResource = false;
    }
    // H1 = phase label (optional)
    else if (/^# /.test(line) && !current) {
      // top-level heading, skip
    }
    // H3 = sub-section inside milestone
    else if (/^### /.test(line) && current) {
      const heading = line.replace(/^### /, "").toLowerCase();
      inSubTask = heading.includes("nhiệm vụ") || heading.includes("task") || heading.includes("bước") || heading.includes("hoạt động");
      inResource = heading.includes("tài liệu") || heading.includes("resource") || heading.includes("tham khảo");
    }
    // Bullet or numbered list
    else if (/^[-*\d]\d*\.?\s/.test(line) && current) {
      const text = line.replace(/^[-*]\s/, "").replace(/^\d+\.\s/, "").trim();
      if (inResource) current.resources.push(text);
      else if (inSubTask) current.subTasks.push(text);
      else current.subTasks.push(text);
    }
    // Plain text → description
    else if (line.trim() && !/^#{1,6}/.test(line) && current) {
      if (!inSubTask && !inResource) {
        current.description += (current.description ? " " : "") + line.trim();
      }
    }
  }
  if (current) milestones.push(current);
  return milestones;
}

function MilestoneNode({
  milestone,
  index,
  total,
  isCompleted,
  onToggleComplete,
}: {
  milestone: Milestone;
  index: number;
  total: number;
  isCompleted: boolean;
  onToggleComplete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLast = index === total - 1;

  return (
    <div className="flex gap-4">
      {/* Timeline column */}
      <div className="flex flex-col items-center shrink-0">
        <button
          onClick={onToggleComplete}
          className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer shadow-sm ${
            isCompleted
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-slate-300 bg-white text-slate-400 hover:border-indigo-400 hover:text-indigo-500"
          }`}
          title={isCompleted ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"}
        >
          {isCompleted
            ? <CheckCircle className="w-5 h-5" />
            : <span className="text-xs font-bold">{index + 1}</span>
          }
        </button>
        {!isLast && (
          <div className={`w-0.5 flex-1 min-h-[32px] mt-1 transition-colors ${isCompleted ? "bg-emerald-300" : "bg-slate-200"}`} />
        )}
      </div>

      {/* Content card */}
      <div className={`flex-1 mb-4 rounded-2xl border transition-all ${
        isCompleted
          ? "border-emerald-200 bg-emerald-50/60"
          : "border-slate-200 bg-white shadow-sm hover:shadow-md"
      }`}>
        {/* Card header */}
        <div
          className="flex items-center gap-3 px-4 py-3.5 cursor-pointer"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {milestone.phase && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600">
                  {milestone.phase}
                </span>
              )}
              {isCompleted && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                  ✓ Hoàn thành
                </span>
              )}
            </div>
            <h4 className={`text-sm font-bold leading-tight ${isCompleted ? "text-emerald-800 line-through decoration-emerald-400" : "text-slate-900"}`}>
              {milestone.title}
            </h4>
            {milestone.description && !expanded && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">{milestone.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {milestone.subTasks.length > 0 && (
              <span className="text-[9px] text-slate-400">{milestone.subTasks.length} nhiệm vụ</span>
            )}
            {expanded
              ? <ChevronUp className="w-4 h-4 text-slate-400" />
              : <ChevronDown className="w-4 h-4 text-slate-400" />
            }
          </div>
        </div>

        {/* Expanded drawer */}
        {expanded && (
          <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
            {milestone.description && (
              <p className="text-xs text-slate-600 leading-relaxed">{milestone.description}</p>
            )}

            {milestone.subTasks.length > 0 && (
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                  <Target className="w-3 h-3" /> Nhiệm vụ & Hoạt động
                </div>
                <div className="space-y-1.5">
                  {milestone.subTasks.map((task, tIdx) => (
                    <div key={tIdx} className="flex gap-2 items-start text-xs text-slate-700">
                      <Circle className="w-3 h-3 text-indigo-300 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{task}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {milestone.resources.length > 0 && (
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" /> Tài liệu tham khảo
                </div>
                <div className="space-y-1">
                  {milestone.resources.map((res, rIdx) => (
                    <div key={rIdx} className="flex gap-1.5 items-start text-xs text-indigo-600">
                      <span className="mt-0.5 w-1 h-1 rounded-full bg-indigo-400 shrink-0" />
                      <span>{res}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Complete toggle button */}
            <button
              onClick={onToggleComplete}
              className={`mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                isCompleted
                  ? "border-slate-200 bg-white text-slate-600 hover:text-slate-800"
                  : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              {isCompleted ? <><Unlock className="w-3 h-3" /> Bỏ hoàn thành</> : <><CheckCircle className="w-3 h-3" /> Đánh dấu hoàn thành</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RoadmapView({
  messages,
  isProcessing,
  sources,
  quickPrompts,
  notebookTitle,
  onSendMessage,
}: RoadmapViewProps) {
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant") ?? null;
  const milestones = lastAssistantMsg ? parseRoadmap(lastAssistantMsg.content) : [];
  const roadmapKey = lastAssistantMsg?.content.slice(0, 40) ?? "";

  useEffect(() => { setCompleted(new Set()); }, [roadmapKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  const toggleComplete = (id: number) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const progress = milestones.length > 0 ? Math.round((completed.size / milestones.length) * 100) : 0;

  // Empty state
  if (messages.length === 0 && !isProcessing) {
    return (
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="p-6 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white shadow-sm text-center mb-5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center mx-auto mb-3 shadow-md">
              <Compass className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">{notebookTitle}</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              {sources.length === 0
                ? "Tải tài liệu để tạo lộ trình học tập hoặc triển khai."
                : "Chế độ Lộ trình sẽ tạo kế hoạch hành động trực quan. Chọn gợi ý hoặc mô tả yêu cầu."}
            </p>
          </div>
          {sources.length > 0 && (
            <div className="grid grid-cols-1 gap-2.5">
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => onSendMessage(prompt.text)}
                  className="group w-full p-3.5 rounded-xl border border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/50 cursor-pointer flex items-center justify-between transition-all text-left"
                >
                  <div className="min-w-0 pr-4">
                    <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-0.5">{prompt.label}</div>
                    <div className="text-xs text-slate-600 truncate">{prompt.text}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isProcessing && milestones.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <RefreshCw className="w-7 h-7 text-amber-600 animate-spin" />
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Đang xây dựng lộ trình...</p>
          <p className="text-xs text-slate-400">AI đang tạo kế hoạch từng bước từ tài liệu nguồn</p>
        </div>
      </div>
    );
  }

  // Fallback: no milestones parsed
  if (milestones.length === 0 && lastAssistantMsg) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="p-5 rounded-2xl border border-amber-200 bg-amber-50 text-sm text-amber-700 mb-4">
            <strong>Lưu ý:</strong> Không tìm thấy cấu trúc lộ trình rõ ràng trong phản hồi. Hiển thị dạng văn bản.
          </div>
          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
            {lastAssistantMsg.content}
          </div>
          <div ref={bottomRef} />
        </div>
      </div>
    );
  }

  if (milestones.length === 0) return null;

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Progress Header */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Lộ trình học tập</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">{milestones.length} cột mốc · {completed.size} hoàn thành</p>
            </div>
            <div className="flex items-center gap-2">
              {progress === 100 && <Trophy className="w-5 h-5 text-amber-500" />}
              <div className="text-right">
                <div className="text-2xl font-bold text-slate-900 leading-none">{progress}%</div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider">Tiến độ</div>
              </div>
            </div>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Milestone Timeline */}
        <div className="pt-2">
          {milestones.map((milestone, index) => (
            <MilestoneNode
              key={milestone.id}
              milestone={milestone}
              index={index}
              total={milestones.length}
              isCompleted={completed.has(milestone.id)}
              onToggleComplete={() => toggleComplete(milestone.id)}
            />
          ))}
        </div>

        {/* Completion banner */}
        {progress === 100 && (
          <div className="p-5 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-center">
            <Trophy className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="font-bold text-slate-900 mb-1">Xuất sắc! Bạn đã hoàn thành lộ trình!</p>
            <p className="text-xs text-slate-500">Tất cả {milestones.length} cột mốc đã được đánh dấu hoàn thành.</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
