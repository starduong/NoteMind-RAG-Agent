import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowRight, Compass, CheckCircle, ChevronDown, ChevronUp,
  RefreshCw, Unlock, BookOpen, Target, Trophy, Calendar,
  Download, Zap, Brain, Clock, Users, Star, Play,
  ChevronRight, Lock, CircleDot, Circle, Award,
  BarChart3, Map, ListChecks, Sparkles, GraduationCap,
  FlaskConical, BookMarked, HelpCircle
} from "lucide-react";

type Mode = "chat" | "quiz" | "roadmap";

interface Message {
  role: "user" | "assistant";
  content: string;
  mode?: Mode;
  sources?: string[];
  result?: RoadmapResult;
  ics_content?: string;
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

interface LearnerProfile {
  goal: string;
  level: string;
  hours_per_day: number;
  preference: string;
  start_date: string;
}

interface Activity {
  type: "theory" | "practice" | "quiz" | "review";
  concept_id?: string;
  topic: string;
  description: string;
  duration_minutes: number;
}

interface DayEntry {
  day: number;
  date: string;
  milestone_id: string;
  milestone_title: string;
  title: string;
  activities: Activity[];
  total_hours: number;
  day_summary: string;
}

interface Milestone {
  id: string;
  title: string;
  phase: string;
  description: string;
  concepts: string[];
  estimated_days: number;
  learning_objectives: string[];
  has_quiz: boolean;
}

interface Resource {
  title: string;
  type: string;
  description: string;
  source: string;
}

interface QuizQuestion {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct_answer: string;
  explanation: string;
}

interface EnrichedMilestone {
  milestone_id: string;
  resources: Resource[];
  quiz_questions: QuizQuestion[];
  practical_exercise: { title: string; description: string; expected_outcome: string };
}

interface RoadmapResult {
  pipeline?: string;
  total_days?: number;
  total_hours?: number;
  milestones_count?: number;
  has_ics?: boolean;
  schedule?: DayEntry[];
  milestones?: Milestone[];
  enriched_milestones?: EnrichedMilestone[];
  learner_profile?: LearnerProfile;
}

interface RoadmapViewProps {
  messages: Message[];
  isProcessing: boolean;
  sources: SourceDoc[];
  quickPrompts: QuickPrompt[];
  notebookTitle: string;
  notebookId: string;
  sessionId?: string;
  onSendMessage: (text: string, learnerProfile?: LearnerProfile) => void;
}

// ─── Wizard Step Components ────────────────────────────────────────────────────

const GOALS = [
  { id: "job", label: "🚀 Đi làm / Nghề nghiệp", desc: "Áp dụng thực tế ngay" },
  { id: "cert", label: "🏆 Thi chứng chỉ", desc: "AWS, IELTS, PMP..." },
  { id: "research", label: "🔬 Nghiên cứu", desc: "Hiểu sâu, học thuật" },
  { id: "overview", label: "🗺️ Tổng quan", desc: "Nắm bức tranh toàn cảnh" },
];

const LEVELS = [
  { id: "beginner", label: "Người mới", desc: "Chưa biết gì về chủ đề này", icon: "🌱" },
  { id: "intermediate", label: "Có nền tảng", desc: "Đã biết cơ bản, muốn đi sâu", icon: "🌿" },
  { id: "advanced", label: "Nâng cao", desc: "Đã quen, muốn master", icon: "🌳" },
];

const PREFERENCES = [
  { id: "theory", label: "📖 Đọc lý thuyết", desc: "Văn bản, sách, tài liệu" },
  { id: "practice", label: "💻 Thực hành", desc: "Bài tập, dự án, lab" },
  { id: "mixed", label: "⚡ Kết hợp", desc: "Cân bằng lý thuyết + thực hành" },
  { id: "video", label: "🎥 Video", desc: "Xem và làm theo" },
];

const PHASE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  Foundation: { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-700", dot: "bg-sky-400" },
  Core: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", dot: "bg-violet-400" },
  Advanced: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "bg-amber-400" },
  Project: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-400" },
};

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  theory: <BookMarked className="w-3.5 h-3.5" />,
  practice: <FlaskConical className="w-3.5 h-3.5" />,
  quiz: <HelpCircle className="w-3.5 h-3.5" />,
  review: <RefreshCw className="w-3.5 h-3.5" />,
};

// ─── Onboarding Wizard ────────────────────────────────────────────────────────

function OnboardingWizard({
  sources,
  quickPrompts,
  onStart,
}: {
  sources: SourceDoc[];
  quickPrompts: QuickPrompt[];
  onStart: (profile: LearnerProfile, query: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<LearnerProfile>({
    goal: "",
    level: "",
    hours_per_day: 2,
    preference: "",
    start_date: new Date().toISOString().split("T")[0],
  });

  const canProceed = [
    !!profile.goal,
    !!profile.level,
    profile.hours_per_day > 0,
    !!profile.preference,
  ][step];

  const steps = [
    {
      title: "Mục tiêu học tập",
      subtitle: "Bạn học để làm gì?",
      icon: <Target className="w-5 h-5" />,
    },
    {
      title: "Trình độ hiện tại",
      subtitle: "Bạn đang ở đâu?",
      icon: <GraduationCap className="w-5 h-5" />,
    },
    {
      title: "Quỹ thời gian",
      subtitle: "Bao nhiêu giờ mỗi ngày?",
      icon: <Clock className="w-5 h-5" />,
    },
    {
      title: "Phong cách học",
      subtitle: "Bạn thích học theo cách nào?",
      icon: <Brain className="w-5 h-5" />,
    },
  ];

  const handleFinish = () => {
    const goalLabel = GOALS.find(g => g.id === profile.goal)?.label || profile.goal;
    const levelLabel = LEVELS.find(l => l.id === profile.level)?.label || profile.level;
    const prefLabel = PREFERENCES.find(p => p.id === profile.preference)?.label || profile.preference;
    const query = `Tạo lộ trình học tập cá nhân hóa cho tôi.\n\nMục tiêu: ${goalLabel}\nTrình độ: ${levelLabel}\nThời gian: ${profile.hours_per_day} giờ/ngày\nPhong cách: ${prefLabel}\nNgày bắt đầu: ${profile.start_date}`;
    onStart(profile, query);
  };

  if (sources.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-5 shadow-xl shadow-amber-200">
            <Compass className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Roadmap AI</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Tải lên tài liệu học tập để AI tạo lộ trình cá nhân hóa cho bạn.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-200 text-amber-700 text-sm font-semibold mb-4">
            <Sparkles className="w-4 h-4" />
            AI Learning Roadmap
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Tạo lộ trình học của bạn
          </h2>
          <p className="text-sm text-slate-500">
            Trả lời {steps.length} câu hỏi để AI cá nhân hóa lộ trình
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all duration-300 ${i < step
                ? "bg-emerald-500 text-white shadow-sm"
                : i === step
                  ? "bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-amber-200"
                  : "bg-slate-100 text-slate-400"
                }`}>
                {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-8 h-0.5 rounded transition-all duration-300 ${i < step ? "bg-emerald-300" : "bg-slate-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-4">
          {/* Step header */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 px-6 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-sm">
              {steps[step].icon}
            </div>
            <div>
              <div className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">
                Bước {step + 1}/{steps.length}
              </div>
              <div className="text-sm font-bold text-slate-900">{steps[step].title}</div>
              <div className="text-xs text-slate-500">{steps[step].subtitle}</div>
            </div>
          </div>

          <div className="p-6">
            {/* Step 0: Goal */}
            {step === 0 && (
              <div className="grid grid-cols-2 gap-3">
                {GOALS.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setProfile(p => ({ ...p, goal: g.id }))}
                    className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${profile.goal === g.id
                      ? "border-amber-400 bg-amber-50 shadow-md shadow-amber-100"
                      : "border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/50"
                      }`}
                  >
                    <div className="text-base mb-1">{g.label}</div>
                    <div className="text-xs text-slate-500">{g.desc}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Step 1: Level */}
            {step === 1 && (
              <div className="space-y-3">
                {LEVELS.map(l => (
                  <button
                    key={l.id}
                    onClick={() => setProfile(p => ({ ...p, level: l.id }))}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 flex items-center gap-4 ${profile.level === l.id
                      ? "border-violet-400 bg-violet-50 shadow-md shadow-violet-100"
                      : "border-slate-200 bg-white hover:border-violet-200"
                      }`}
                  >
                    <span className="text-2xl">{l.icon}</span>
                    <div>
                      <div className="font-bold text-slate-900">{l.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{l.desc}</div>
                    </div>
                    {profile.level === l.id && (
                      <CheckCircle className="w-5 h-5 text-violet-500 ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Step 2: Time */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-5xl font-black text-slate-900 mb-1 tabular-nums">
                    {profile.hours_per_day}
                  </div>
                  <div className="text-sm text-slate-500 font-medium">giờ / ngày</div>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={8}
                  step={0.5}
                  value={profile.hours_per_day}
                  onChange={e => setProfile(p => ({ ...p, hours_per_day: parseFloat(e.target.value) }))}
                  className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>30 phút</span>
                  <span>4 giờ</span>
                  <span>8 giờ</span>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">
                    📅 Ngày bắt đầu
                  </label>
                  <input
                    type="date"
                    value={profile.start_date}
                    onChange={e => setProfile(p => ({ ...p, start_date: e.target.value }))}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-100 focus:border-amber-300"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Preference */}
            {step === 3 && (
              <div className="grid grid-cols-2 gap-3">
                {PREFERENCES.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setProfile(prev => ({ ...prev, preference: p.id }))}
                    className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${profile.preference === p.id
                      ? "border-emerald-400 bg-emerald-50 shadow-md shadow-emerald-100"
                      : "border-slate-200 bg-white hover:border-emerald-200"
                      }`}
                  >
                    <div className="text-base mb-1">{p.label}</div>
                    <div className="text-xs text-slate-500">{p.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="px-5 h-11 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            ← Quay lại
          </button>
          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed}
              className="px-6 h-11 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold hover:shadow-lg hover:shadow-amber-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              Tiếp theo <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={!canProceed}
              className="px-6 h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold hover:shadow-lg hover:shadow-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Tạo Lộ Trình AI
            </button>
          )}
        </div>

        {/* Quick prompts */}
        {quickPrompts.length > 0 && (
          <div className="mt-6">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Hoặc dùng gợi ý nhanh</div>
            <div className="space-y-2">
              {quickPrompts.slice(0, 2).map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => onStart(profile, prompt.text)}
                  className="group w-full p-3 rounded-xl border border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/30 cursor-pointer flex items-center gap-3 text-left transition-all"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 shrink-0" />
                  <span className="text-xs text-slate-600">{prompt.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Day Card ─────────────────────────────────────────────────────────────────

function DayCard({
  day,
  isCompleted,
  isActive,
  onToggle,
}: {
  day: DayEntry;
  isCompleted: boolean;
  isActive: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const phaseColors = PHASE_COLORS[day.milestone_title] || PHASE_COLORS.Core;

  return (
    <div className={`relative pl-6 pb-3 group`}>
      {/* Timeline dot */}
      <div
        onClick={onToggle}
        className={`absolute left-0 top-1 w-4 h-4 rounded-full border-2 cursor-pointer transition-all duration-300 z-10 ${isCompleted
          ? "bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-200"
          : isActive
            ? "bg-blue-500 border-blue-500 shadow-md shadow-blue-200 animate-pulse"
            : "bg-white border-slate-300 group-hover:border-amber-400"
          }`}
      />

      {/* Card */}
      <div
        className={`rounded-xl border transition-all duration-200 ${isCompleted
          ? "border-emerald-200 bg-emerald-50/50"
          : isActive
            ? "border-blue-200 bg-blue-50/50 shadow-sm"
            : "border-slate-200 bg-white hover:shadow-sm hover:border-slate-300"
          }`}
      >
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer"
          onClick={() => setExpanded(v => !v)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${isCompleted ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                }`}>
                Ngày {day.day}
              </span>
              {day.date && (
                <span className="text-[9px] text-slate-400">{day.date}</span>
              )}
            </div>
            <p className={`text-sm font-semibold leading-tight truncate ${isCompleted ? "text-emerald-700 line-through decoration-emerald-400" : "text-slate-800"
              }`}>
              {day.day_summary || day.title}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[9px] text-slate-400">{day.total_hours}h</span>
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
        </div>

        {expanded && (
          <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-2">
            {day.activities.map((act, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`mt-0.5 p-1 rounded-md ${act.type === "theory" ? "bg-sky-100 text-sky-600"
                  : act.type === "practice" ? "bg-violet-100 text-violet-600"
                    : act.type === "quiz" ? "bg-amber-100 text-amber-600"
                      : "bg-slate-100 text-slate-500"
                  }`}>
                  {ACTIVITY_ICONS[act.type] || <Circle className="w-3.5 h-3.5" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700 truncate">
                      {act.topic || act.description}
                    </span>
                    <span className="text-[9px] text-slate-400 shrink-0">{act.duration_minutes}p</span>
                  </div>
                  {act.description && act.description !== act.topic && (
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{act.description}</p>
                  )}
                </div>
              </div>
            ))}
            <button
              onClick={onToggle}
              className={`mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${isCompleted
                ? "border-slate-200 text-slate-600 hover:bg-slate-50"
                : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }`}
            >
              {isCompleted ? <Unlock className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
              {isCompleted ? "Bỏ hoàn thành" : "Đánh dấu hoàn thành"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Milestone Section ────────────────────────────────────────────────────────

function MilestoneSection({
  milestone,
  days,
  enriched,
  completedDays,
  onToggleDay,
}: {
  milestone: Milestone;
  days: DayEntry[];
  enriched?: EnrichedMilestone;
  completedDays: Set<number>;
  onToggleDay: (dayNum: number) => void;
}) {
  const [showResources, setShowResources] = useState(false);
  const doneCount = days.filter(d => completedDays.has(d.day)).length;
  const progress = days.length > 0 ? Math.round((doneCount / days.length) * 100) : 0;
  const phase = milestone.phase || "Core";
  const colors = PHASE_COLORS[phase] || PHASE_COLORS.Core;
  const firstIncompleteDayNum = days.find(d => !completedDays.has(d.day))?.day;

  return (
    <div className="mb-6">
      {/* Milestone header */}
      <div className={`rounded-2xl border ${colors.border} ${colors.bg} p-4 mb-3`}>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl ${colors.border} border-2 flex items-center justify-center shrink-0 bg-white`}>
            <div className={`w-3 h-3 rounded-full ${colors.dot}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${colors.border} ${colors.text} bg-white`}>
                {phase}
              </span>
              {progress === 100 && (
                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700">
                  ✓ Hoàn thành
                </span>
              )}
            </div>
            <h3 className={`text-base font-bold ${colors.text} leading-tight`}>
              {milestone.title}
            </h3>
            {milestone.description && (
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{milestone.description}</p>
            )}
            {/* Progress */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] text-slate-500">{doneCount}/{days.length} ngày</span>
                <span className={`text-[9px] font-bold ${colors.text}`}>{progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/70 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${colors.dot}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Resources toggle */}
        {enriched && (enriched.resources.length > 0 || enriched.quiz_questions.length > 0) && (
          <button
            onClick={() => setShowResources(v => !v)}
            className={`mt-3 w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/70 border ${colors.border} text-xs font-semibold ${colors.text} hover:bg-white transition-all`}
          >
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Tài liệu & Quiz ({enriched.resources.length} nguồn, {enriched.quiz_questions.length} câu hỏi)
            </span>
            {showResources ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Resources drawer */}
      {showResources && enriched && (
        <div className={`mb-3 ml-4 rounded-xl border ${colors.border} bg-white p-4 space-y-4`}>
          {enriched.resources.length > 0 && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                <BookMarked className="w-3 h-3" /> Tài liệu tham khảo
              </div>
              <div className="space-y-2">
                {enriched.resources.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-700">
                    <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${colors.bg} ${colors.text}`}>
                      {r.type}
                    </span>
                    <div>
                      <span className="font-semibold">{r.title}</span>
                      {r.description && <span className="text-slate-500"> — {r.description}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {enriched.quiz_questions.length > 0 && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                <HelpCircle className="w-3 h-3" /> Câu hỏi kiểm tra
              </div>
              <div className="space-y-2">
                {enriched.quiz_questions.map((q, i) => (
                  <div key={i} className="text-xs text-slate-700 bg-slate-50 rounded-lg p-2.5">
                    <span className="font-semibold">{i + 1}. {q.question}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {enriched.practical_exercise && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                <FlaskConical className="w-3 h-3" /> Bài tập thực hành
              </div>
              <div className={`p-3 rounded-lg border ${colors.border} ${colors.bg}`}>
                <div className={`text-xs font-bold ${colors.text}`}>{enriched.practical_exercise.title}</div>
                <div className="text-xs text-slate-600 mt-1">{enriched.practical_exercise.description}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Days timeline */}
      <div className="ml-4 pl-4 border-l-2 border-dashed border-slate-200 space-y-1.5">
        {days.map((day, idx) => (
          <DayCard
            key={day.day}
            day={day}
            isCompleted={completedDays.has(day.day)}
            isActive={day.day === firstIncompleteDayNum}
            onToggle={() => onToggleDay(day.day)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Knowledge Graph Mini (SVG) ───────────────────────────────────────────────

function KnowledgeGraphMini({ concepts, relationships }: { concepts: any[]; relationships: any[] }) {
  if (!concepts || concepts.length === 0) return null;

  const shown = concepts.slice(0, 8);
  const cx = 200, cy = 140, rx = 160, ry = 110;
  const positions = shown.map((_, i) => {
    const angle = (i / shown.length) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
  });

  const colorMap: Record<string, string> = {
    beginner: "#34d399",
    intermediate: "#60a5fa",
    advanced: "#f472b6",
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Map className="w-4 h-4 text-slate-500" />
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Knowledge Graph</span>
        <span className="ml-auto text-[10px] text-slate-400">{concepts.length} khái niệm</span>
      </div>
      <svg width="100%" viewBox="0 0 400 280" className="overflow-visible">
        {/* Relations */}
        {relationships.slice(0, 12).map((rel, i) => {
          const fromIdx = shown.findIndex(c => c.id === rel.from);
          const toIdx = shown.findIndex(c => c.id === rel.to);
          if (fromIdx < 0 || toIdx < 0) return null;
          const p1 = positions[fromIdx];
          const p2 = positions[toIdx];
          return (
            <line
              key={i}
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="#e2e8f0" strokeWidth={1.5} strokeDasharray="4,3"
            />
          );
        })}
        {/* Nodes */}
        {shown.map((c, i) => {
          const pos = positions[i];
          const color = colorMap[c.difficulty] || "#94a3b8";
          return (
            <g key={i}>
              <circle cx={pos.x} cy={pos.y} r={18} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={1.5} />
              <text x={pos.x} y={pos.y - 2} textAnchor="middle" fontSize={7} fontWeight="600" fill="#374151">
                {c.name.slice(0, 10)}
              </text>
              {c.name.length > 10 && (
                <text x={pos.x} y={pos.y + 7} textAnchor="middle" fontSize={7} fill="#374151">
                  {c.name.slice(10, 18)}...
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 mt-2">
        {[["#34d399", "Cơ bản"], ["#60a5fa", "Trung cấp"], ["#f472b6", "Nâng cao"]].map(([color, label]) => (
          <div key={label} className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Export Component ────────────────────────────────────────────────────

export default function RoadmapView({
  messages,
  isProcessing,
  sources,
  quickPrompts,
  notebookTitle,
  notebookId,
  sessionId,
  onSendMessage,
}: RoadmapViewProps) {
  const [completedDays, setCompletedDays] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<"timeline" | "graph" | "overview">("timeline");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Extract last assistant message
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant") ?? null;
  const result: RoadmapResult | undefined = lastAssistantMsg?.result;
  const icsContent = lastAssistantMsg?.ics_content;

  const schedule = result?.schedule || [];
  const milestones = result?.milestones || [];
  const enrichedMilestones = result?.enriched_milestones || [];
  const knowledgeGraph = result?.["knowledge_graph"] as any;

  const totalDays = result?.total_days || schedule.length;
  const totalHours = result?.total_hours || 0;
  const isMultiAgent = result?.pipeline === "multi-agent";

  const roadmapKey = lastAssistantMsg?.content?.slice(0, 40) ?? "";
  useEffect(() => { setCompletedDays(new Set()); }, [roadmapKey]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  const toggleDay = (dayNum: number) => {
    setCompletedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayNum)) next.delete(dayNum);
      else next.add(dayNum);
      return next;
    });
  };

  const overallProgress = totalDays > 0 ? Math.round((completedDays.size / totalDays) * 100) : 0;

  // Group days by milestone
  const daysByMilestone: Record<string, DayEntry[]> = {};
  for (const day of schedule) {
    const mid = day.milestone_id || "m1";
    if (!daysByMilestone[mid]) daysByMilestone[mid] = [];
    daysByMilestone[mid].push(day);
  }

  // Enrichment map
  const enrichMap: Record<string, EnrichedMilestone> = {};
  for (const em of enrichedMilestones) enrichMap[em.milestone_id] = em;

  // Download ICS
  const downloadICS = () => {
    if (icsContent) {
      const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "notemind-roadmap.ics";
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Fallback: call API
      const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/notebooks/${notebookId}/roadmap/export-ics${sessionId ? `?session_id=${sessionId}` : ""}`;
      window.open(url, "_blank");
    }
  };

  // ── Empty / loading states ──────────────────────────────────────────────────

  if (messages.length === 0 && !isProcessing) {
    return (
      <OnboardingWizard
        sources={sources}
        quickPrompts={quickPrompts}
        onStart={(profile, query) => onSendMessage(query, profile)}
      />
    );
  }

  if (isProcessing && schedule.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-amber-100 animate-ping opacity-40" />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl shadow-amber-200">
              <Brain className="w-9 h-9 text-white" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Đang tạo lộ trình...</h3>
          <p className="text-sm text-slate-500 mb-5">
            Hệ thống 5 AI agent đang phân tích tài liệu, đánh giá trình độ và xây dựng lịch học cá nhân hóa
          </p>
          <div className="space-y-2 text-left">
            {[
              "🔍 Content Analyzer — Trích xuất knowledge graph",
              "📊 Assessment Agent — Định hình hồ sơ người học",
              "🏗️ Syllabus Architect — Thiết kế cấu trúc lộ trình",
              "📅 Scheduler Agent — Lập lịch học hàng ngày",
              "📚 Resource & Quiz Generator — Bổ sung tài liệu & quiz",
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2.5 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Fallback text display
  if (schedule.length === 0 && lastAssistantMsg) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto">
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-700 mb-4">
            <strong>Legacy Mode:</strong> Lộ trình đã được tạo nhưng không có structured data. Hiển thị dạng văn bản.
            Để dùng full multi-agent với iCalendar, vui lòng dùng wizard.
          </div>
          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
            {lastAssistantMsg.content}
          </div>
          <div ref={bottomRef} />
        </div>
      </div>
    );
  }

  if (schedule.length === 0) return null;

  // ── Full Roadmap Display ────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">

        {/* ── Progress Header ─────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 px-5 py-4 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Compass className="w-4 h-4 opacity-80" />
                  <span className="text-xs font-semibold opacity-80 uppercase tracking-wider">Lộ Trình Học Tập</span>
                  {isMultiAgent && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/20 border border-white/30">
                      ✨ Multi-Agent AI
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold leading-tight">{notebookTitle}</h2>
                {result?.learner_profile && (
                  <p className="text-xs opacity-70 mt-1">
                    🎯 {GOALS.find(g => g.id === result.learner_profile?.goal)?.label || result.learner_profile.goal}
                    · {LEVELS.find(l => l.id === result.learner_profile?.level)?.label || result.learner_profile?.level}
                    · {result.learner_profile?.hours_per_day}h/ngày
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-4xl font-black leading-none">{overallProgress}%</div>
                <div className="text-[10px] opacity-70 uppercase tracking-wider mt-0.5">Tiến độ</div>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-3 h-2 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-white transition-all duration-700"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="px-5 py-3 grid grid-cols-3 divide-x divide-slate-100">
            {[
              { icon: <Calendar className="w-4 h-4" />, label: "Tổng ngày", value: `${totalDays} ngày` },
              { icon: <Clock className="w-4 h-4" />, label: "Tổng giờ", value: `${Math.round(totalHours)}h` },
              { icon: <ListChecks className="w-4 h-4" />, label: "Milestones", value: `${milestones.length || Object.keys(daysByMilestone).length}` },
            ].map(({ icon, label, value }) => (
              <div key={label} className="px-4 first:pl-0 last:pr-0 flex items-center gap-2">
                <span className="text-slate-400">{icon}</span>
                <div>
                  <div className="text-[9px] text-slate-400 uppercase tracking-wider">{label}</div>
                  <div className="text-sm font-bold text-slate-900">{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Action Buttons ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          {(icsContent || true) && (
            <button
              onClick={downloadICS}
              className="flex items-center gap-2 px-4 h-9 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold hover:shadow-lg hover:shadow-emerald-200 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Export iCalendar (.ics)
            </button>
          )}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white border border-slate-200 shadow-sm">
            {(["timeline", "graph", "overview"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 h-7 rounded-lg text-xs font-semibold transition-all ${activeTab === tab
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                {tab === "timeline" ? "📅 Timeline" : tab === "graph" ? "🗺️ Graph" : "📋 Tổng quan"}
              </button>
            ))}
          </div>
          <span className={`ml-auto text-xs px-2.5 py-1 rounded-full font-semibold ${completedDays.size === 0 ? "bg-slate-100 text-slate-500"
            : overallProgress === 100 ? "bg-emerald-100 text-emerald-700"
              : "bg-blue-100 text-blue-700"
            }`}>
            ✅ {completedDays.size}/{totalDays} ngày
          </span>
        </div>

        {/* ── Tab Content ──────────────────────────────────────────────────── */}
        {activeTab === "timeline" && (
          <div className="space-y-2">
            {milestones.length > 0 ? (
              milestones.map(ms => (
                <MilestoneSection
                  key={ms.id}
                  milestone={ms}
                  days={daysByMilestone[ms.id] || []}
                  enriched={enrichMap[ms.id]}
                  completedDays={completedDays}
                  onToggleDay={toggleDay}
                />
              ))
            ) : (
              // Fallback: group by milestone_title
              Object.entries(daysByMilestone).map(([mid, days]) => {
                const fakeMilestone: Milestone = {
                  id: mid,
                  title: days[0]?.milestone_title || mid,
                  phase: "Core",
                  description: "",
                  concepts: [],
                  estimated_days: days.length,
                  learning_objectives: [],
                  has_quiz: false,
                };
                return (
                  <MilestoneSection
                    key={mid}
                    milestone={fakeMilestone}
                    days={days}
                    enriched={enrichMap[mid]}
                    completedDays={completedDays}
                    onToggleDay={toggleDay}
                  />
                );
              })
            )}
          </div>
        )}

        {activeTab === "graph" && (
          <div className="space-y-4">
            {knowledgeGraph ? (
              <KnowledgeGraphMini
                concepts={knowledgeGraph.concepts || []}
                relationships={knowledgeGraph.relationships || []}
              />
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
                <Map className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Knowledge Graph sẽ hiển thị ở đây sau khi tạo lộ trình với Multi-Agent pipeline.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "overview" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-slate-800">Tổng quan lộ trình</span>
            </div>
            {/* Milestone overview table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 text-slate-400 font-semibold">Milestone</th>
                    <th className="text-center py-2 text-slate-400 font-semibold">Phase</th>
                    <th className="text-center py-2 text-slate-400 font-semibold">Ngày</th>
                    <th className="text-center py-2 text-slate-400 font-semibold">Tiến độ</th>
                  </tr>
                </thead>
                <tbody>
                  {(milestones.length > 0 ? milestones : Object.entries(daysByMilestone).map(([id, days]) => ({
                    id, title: days[0]?.milestone_title || id, phase: "Core", description: "",
                    concepts: [], estimated_days: days.length, learning_objectives: [], has_quiz: false,
                  }))).map(ms => {
                    const msDays = daysByMilestone[ms.id] || [];
                    const doneCount = msDays.filter(d => completedDays.has(d.day)).length;
                    const prog = msDays.length > 0 ? Math.round(doneCount / msDays.length * 100) : 0;
                    const colors = PHASE_COLORS[ms.phase] || PHASE_COLORS.Core;
                    return (
                      <tr key={ms.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2.5 font-semibold text-slate-800">{ms.title}</td>
                        <td className="py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${colors.bg} ${colors.text} border ${colors.border}`}>
                            {ms.phase}
                          </span>
                        </td>
                        <td className="py-2.5 text-center text-slate-600">{msDays.length}</td>
                        <td className="py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div className={`h-full rounded-full ${colors.dot} transition-all`} style={{ width: `${prog}%` }} />
                            </div>
                            <span className="text-slate-500">{prog}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Completion Banner ────────────────────────────────────────────── */}
        {overallProgress === 100 && (
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50 to-white p-6 text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-200">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">🎉 Xuất sắc!</h3>
            <p className="text-sm text-slate-600 mb-4">
              Bạn đã hoàn thành toàn bộ {totalDays} ngày học tập trong lộ trình!
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={downloadICS}
                className="flex items-center gap-2 px-4 h-9 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                Tải lịch học
              </button>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
