import { useState, useEffect, useRef } from "react";
import {
  ArrowRight, Layers, CheckCircle, XCircle, Eye, EyeOff,
  RefreshCw, Trophy, ChevronRight, RotateCcw
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

interface QuizQuestion {
  id: number;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct_answer: string;
  explanation: string;
}

interface QuizData {
  questions: QuizQuestion[];
}

interface QuizViewProps {
  messages: Message[];
  isProcessing: boolean;
  sources: SourceDoc[];
  quickPrompts: QuickPrompt[];
  notebookTitle: string;
  onSendMessage: (text: string) => void;
}

function parseQuizJson(content: string): QuizData | null {
  // Try to extract JSON from code block or raw
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) ||
    content.match(/(\{[\s\S]*"questions"[\s\S]*\})/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[1].trim());
    if (parsed.questions && Array.isArray(parsed.questions)) return parsed as QuizData;
    return null;
  } catch {
    return null;
  }
}

type AnswerState = { selected: string | null; revealed: boolean };

function QuizCard({
  question,
  qIdx,
  total,
  answer,
  onSelect,
  onReveal,
}: {
  question: QuizQuestion;
  qIdx: number;
  total: number;
  answer: AnswerState;
  onSelect: (opt: string) => void;
  onReveal: () => void;
}) {
  const optionKeys: ("A" | "B" | "C" | "D")[] = ["A", "B", "C", "D"];

  const getOptionStyle = (key: string) => {
    if (!answer.selected && !answer.revealed) {
      return "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer";
    }
    if (key === question.correct_answer) {
      return "border-emerald-400 bg-emerald-50 text-emerald-800";
    }
    if (key === answer.selected && key !== question.correct_answer) {
      return "border-red-400 bg-red-50 text-red-800";
    }
    return "border-slate-200 bg-slate-50 text-slate-400 cursor-default";
  };

  const isAnswered = !!answer.selected || answer.revealed;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-50 to-white border-b border-slate-200 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
          Câu {qIdx + 1} / {total}
        </span>
        {isAnswered && (
          answer.selected === question.correct_answer
            ? <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600"><CheckCircle className="w-3.5 h-3.5" /> Đúng!</span>
            : <span className="flex items-center gap-1 text-[10px] font-bold text-red-600"><XCircle className="w-3.5 h-3.5" /> Sai</span>
        )}
      </div>

      {/* Question */}
      <div className="px-5 py-4">
        <p className="text-sm font-semibold text-slate-900 leading-relaxed mb-4">{question.question}</p>

        {/* Options */}
        <div className="grid grid-cols-1 gap-2.5 mb-4">
          {optionKeys.map((key) => (
            <button
              key={key}
              disabled={isAnswered}
              onClick={() => onSelect(key)}
              className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm transition-all text-left ${getOptionStyle(key)}`}
            >
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 border ${key === question.correct_answer && isAnswered
                ? "bg-emerald-500 text-white border-emerald-500"
                : key === answer.selected && key !== question.correct_answer && isAnswered
                  ? "bg-red-500 text-white border-red-500"
                  : "bg-slate-100 text-slate-600 border-slate-200"
                }`}>
                {key}
              </span>
              <span className="flex-1 leading-relaxed">{question.options[key]}</span>
              {key === question.correct_answer && isAnswered && (
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              )}
              {key === answer.selected && key !== question.correct_answer && isAnswered && (
                <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              )}
            </button>
          ))}
        </div>

        {/* Reveal / Explanation */}
        {!isAnswered ? (
          <button
            onClick={onReveal}
            className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" /> Hiện đáp án & giải thích
          </button>
        ) : (
          <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
              <EyeOff className="w-3 h-3" /> Giải thích
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">{question.explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function QuizView({
  messages,
  isProcessing,
  sources,
  quickPrompts,
  notebookTitle,
  onSendMessage,
}: QuizViewProps) {
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  // Find the last assistant message with quiz data
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant") ?? null;
  const quizData = lastAssistantMsg ? parseQuizJson(lastAssistantMsg.content) : null;
  const quizKey = lastAssistantMsg?.content.slice(0, 40) ?? "";

  // Reset answers when quiz content changes
  useEffect(() => {
    setAnswers({});
  }, [quizKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  const handleSelect = (qId: number, option: string) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: { selected: option, revealed: false },
    }));
  };

  const handleReveal = (qId: number) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: { selected: null, revealed: true },
    }));
  };

  const getAnswerState = (qId: number): AnswerState =>
    answers[qId] ?? { selected: null, revealed: false };

  // Progress stats
  const totalQ = quizData?.questions.length ?? 0;
  const answeredQ = Object.keys(answers).length;
  const correctQ = quizData?.questions.filter(
    (q) => answers[q.id]?.selected === q.correct_answer
  ).length ?? 0;

  // Empty state
  if (messages.length === 0 && !isProcessing) {
    return (
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="p-6 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white shadow-sm text-center mb-5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-md">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">{notebookTitle}</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              {sources.length === 0
                ? "Tải tài liệu nguồn để sinh câu hỏi trắc nghiệm."
                : "Chế độ Trắc nghiệm sẽ sinh câu hỏi từ tài liệu. Chọn gợi ý hoặc tự nhập yêu cầu."}
            </p>
          </div>
          {sources.length > 0 && (
            <div className="grid grid-cols-1 gap-2.5">
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => onSendMessage(prompt.text)}
                  className="group w-full p-3.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50 cursor-pointer flex items-center justify-between transition-all text-left"
                >
                  <div className="min-w-0 pr-4">
                    <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">{prompt.label}</div>
                    <div className="text-xs text-slate-600 truncate">{prompt.text}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // No valid quiz JSON — fallback to plain text
  if (!quizData && lastAssistantMsg) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="p-5 rounded-2xl border border-amber-200 bg-amber-50 text-sm text-amber-700 mb-4">
            <strong>Lưu ý:</strong> Phản hồi từ AI không phải định dạng JSON quiz chuẩn. Hiển thị dưới dạng văn bản.
          </div>
          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
            {lastAssistantMsg.content}
          </div>
          <div ref={bottomRef} />
        </div>
      </div>
    );
  }

  if (!quizData) return null;

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Progress Header */}
        <div className="sticky top-0 z-10 bg-[#FAF9F6]/95 backdrop-blur-sm pb-3 pt-1">
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-700">Tiến độ</span>
                <span className="text-xs text-slate-500 font-mono">{answeredQ}/{totalQ} câu</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
                  style={{ width: totalQ > 0 ? `${(answeredQ / totalQ) * 100}%` : "0%" }}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-center">
                <div className="text-base font-bold text-emerald-600">{correctQ}</div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider">Đúng</div>
              </div>
              <div className="text-center">
                <div className="text-base font-bold text-red-500">{answeredQ - correctQ}</div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider">Sai</div>
              </div>
              {answeredQ === totalQ && totalQ > 0 && (
                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[10px] font-bold text-amber-700">
                    {Math.round((correctQ / totalQ) * 100)}%
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => setAnswers({})}
              className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
              title="Làm lại"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quiz Cards */}
        {quizData.questions.map((question, qIdx) => (
          <QuizCard
            key={question.id}
            question={question}
            qIdx={qIdx}
            total={totalQ}
            answer={getAnswerState(question.id)}
            onSelect={(opt) => handleSelect(question.id, opt)}
            onReveal={() => handleReveal(question.id)}
          />
        ))}

        {/* Completion Banner */}
        {answeredQ === totalQ && totalQ > 0 && (
          <div className="p-5 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-center">
            <Trophy className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="font-bold text-slate-900 mb-1">Hoàn thành!</p>
            <p className="text-sm text-slate-600">
              Bạn trả lời đúng <strong className="text-emerald-600">{correctQ}/{totalQ}</strong> câu hỏi
              {" "}({Math.round((correctQ / totalQ) * 100)}% chính xác).
            </p>
            <button
              onClick={() => setAnswers({})}
              className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-all mx-auto cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Làm lại
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
