import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import axios from "axios";
import {
  Search,
  Plus,
  Clock,
  MessageSquare,
  Sparkles,
  Layers,
  Compass,
  Grid3X3,
  List,
  X,
  MoreHorizontal,
  PencilLine,
  Trash2,
  FolderOpen,
  FileText,
  Zap,
} from "lucide-react";
import NotebookWorkspace from "../components/NotebookWorkspace";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Mode = "chat" | "quiz" | "roadmap";
type ViewType = "grid" | "list";

interface Notebook {
  notebook_id: string;
  title: string;
  description: string;
  source_count: number;
}

interface SessionDetail {
  sessionId: string;
  notebookId: string | null;
  notebookTitle: string;
  mode: Mode;
  messageCount: number;
  sourceCount: number;
  lastUpdated: string;
  createdAt: string;
}

function isMode(value: string): value is Mode {
  return value === "chat" || value === "quiz" || value === "roadmap";
}

const MODE_BADGES = {
  quiz: {
    label: "Quiz",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: Layers,
    description: "Interactive learning"
  },
  roadmap: {
    label: "Roadmap",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Compass,
    description: "Learning path planning"
  },
  chat: {
    label: "Chat",
    className: "bg-sky-50 text-sky-700 border-sky-200",
    icon: MessageSquare,
    description: "General conversation"
  }
};

const PASTEL_THEMES = [
  "bg-pink-50 text-pink-700",
  "bg-emerald-50 text-emerald-700",
  "bg-purple-50 text-purple-700",
  "bg-sky-50 text-sky-700",
  "bg-orange-50 text-orange-700",
  "bg-indigo-50 text-indigo-700",
  "bg-rose-50 text-rose-700",
  "bg-teal-50 text-teal-700",
];

export default function Home() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewType, setViewType] = useState<ViewType>("grid");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNotebookTitle, setNewNotebookTitle] = useState("");
  const [creatingNotebook, setCreatingNotebook] = useState(false);
  const [activeMenuSessionId, setActiveMenuSessionId] = useState<string | null>(null);

  const hasWorkspaceParams = useMemo(() => {
    if (!router.isReady) return false;
    const { notebook_id, session_id } = router.query;
    return Boolean(notebook_id || session_id);
  }, [router.isReady, router.query]);

  const getPastelTheme = (seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    return PASTEL_THEMES[Math.abs(hash) % PASTEL_THEMES.length];
  };

  const formatDateTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  const timeAgo = (isoString: string) => {
    const diffMinutes = Math.max(1, Math.floor((Date.now() - new Date(isoString).getTime()) / 60000));
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return formatDateTime(isoString);
  };

  const getModeBadge = (mode: Mode) => MODE_BADGES[mode] || MODE_BADGES.chat;

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [notebooksRes, sessionsRes] = await Promise.all([
        axios.get(`${API}/notebooks`),
        axios.get(`${API}/sessions`)
      ]);

      const notebooksList: Notebook[] = notebooksRes.data.notebooks || [];
      const notebooksMap: Record<string, string> = {};
      const notebookSourceMap: Record<string, number> = {};

      notebooksList.forEach((nb) => {
        notebooksMap[nb.notebook_id] = nb.title;
        notebookSourceMap[nb.notebook_id] = nb.source_count || 0;
      });

      const sessionIds: string[] = sessionsRes.data.sessions || [];
      const details = await Promise.all(
        sessionIds.map(async (sid) => {
          try {
            const { data } = await axios.get(`${API}/sessions/${sid}/history`);
            const messages = data.messages || [];
            const metadata = data.metadata || {};

            let notebookId: string | null = null;
            let mode: Mode = "chat";

            for (let i = messages.length - 1; i >= 0; i--) {
              const msg = messages[i];
              if (msg.metadata) {
                if (msg.metadata.notebook_id) notebookId = msg.metadata.notebook_id;
                if (msg.metadata.mode && isMode(msg.metadata.mode)) mode = msg.metadata.mode;
                if (notebookId) break;
              }
            }

            return {
              sessionId: sid,
              notebookId,
              notebookTitle: notebookId ? (notebooksMap[notebookId] || "Deleted Notebook") : "General Workspace",
              mode,
              messageCount: metadata.message_count || messages.length,
              sourceCount: notebookId ? (notebookSourceMap[notebookId] || 0) : 0,
              lastUpdated: metadata.last_updated || new Date().toISOString(),
              createdAt: metadata.created_at || new Date().toISOString(),
            } as SessionDetail;
          } catch {
            return null;
          }
        })
      );

      const validDetails = details.filter((d): d is SessionDetail => d !== null);
      validDetails.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
      setSessions(validDetails);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!router.isReady || hasWorkspaceParams) return;
    fetchDashboardData();
  }, [router.isReady, hasWorkspaceParams]);

  const createNotebook = async () => {
    const title = newNotebookTitle.trim() || "New Notebook";
    try {
      setCreatingNotebook(true);
      const { data } = await axios.post(`${API}/notebooks`, { title, description: "" });
      setShowCreateModal(false);
      setNewNotebookTitle("");
      await router.push(`/?notebook_id=${encodeURIComponent(data.notebook_id)}`);
    } catch (err) {
      console.error("Failed to create notebook:", err);
    } finally {
      setCreatingNotebook(false);
    }
  };

  const openNotebookSession = (session: SessionDetail) => {
    const params = new URLSearchParams();
    params.set("session_id", session.sessionId);
    if (session.notebookId) params.set("notebook_id", session.notebookId);
    router.push(`/?${params.toString()}`);
  };

  const deleteSession = async (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("Are you sure you want to delete this session?")) return;
    try {
      await axios.delete(`${API}/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      setActiveMenuSessionId(null);
    } catch {
      alert("Unable to delete session.");
    }
  };

  const renameNotebook = async (session: SessionDetail, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!session.notebookId) {
      alert("This session is not attached to a specific notebook.");
      return;
    }
    const title = prompt("Enter new notebook name:", session.notebookTitle)?.trim();
    if (!title) return;
    try {
      await axios.patch(`${API}/notebooks/${session.notebookId}`, { title });
      setSessions((prev) =>
        prev.map((item) =>
          item.notebookId === session.notebookId ? { ...item, notebookTitle: title } : item
        )
      );
      setActiveMenuSessionId(null);
    } catch {
      alert("Unable to rename notebook.");
    }
  };

  const filteredSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sessions;
    return sessions.filter((session) =>
      session.notebookTitle.toLowerCase().includes(query) ||
      getModeBadge(session.mode).label.toLowerCase().includes(query)
    );
  }, [sessions, searchQuery]);

  if (hasWorkspaceParams) {
    return (
      <>
        <Head>
          <title>NoteMind Workspace</title>
          <meta name="description" content="AI Research Assistant workspace" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <NotebookWorkspace />
      </>
    );
  }

  const renderSessionCard = (session: SessionDetail) => {
    const modeInfo = getModeBadge(session.mode);
    const ModeIcon = modeInfo.icon;
    const pastel = getPastelTheme(`${session.notebookTitle}-${session.sessionId}`);
    const isMenuOpen = activeMenuSessionId === session.sessionId;

    return (
      <div
        key={session.sessionId}
        onClick={() => openNotebookSession(session)}
        className="group cursor-pointer bg-white border border-slate-200 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-indigo-200 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 -mr-8 -mt-8" />

        <div className="relative">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className={`p-2.5 rounded-xl ${pastel}`}>
              <ModeIcon className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                {timeAgo(session.lastUpdated)}
              </span>
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuSessionId(isMenuOpen ? null : session.sessionId);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-10">
                    <button
                      onClick={(e) => renameNotebook(session, e)}
                      className="w-full px-3 py-2.5 rounded-lg text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                    >
                      <PencilLine className="w-3.5 h-3.5 text-slate-500" />
                      Edit Notebook Title
                    </button>
                    <button
                      onClick={(e) => deleteSession(session.sessionId, e)}
                      className="w-full px-3 py-2.5 rounded-lg text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Session
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <h3 className="text-base font-bold text-slate-900 truncate leading-tight">
            {session.notebookTitle}
          </h3>

          <div className="mt-2 flex items-center gap-1.5">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${modeInfo.className}`}>
              {modeInfo.label}
            </span>
            <span className="text-[10px] text-slate-400">•</span>
            <span className="text-[10px] text-slate-500">{modeInfo.description}</span>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-600 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                {session.messageCount} messages
              </span>
              <span className="text-xs text-slate-600 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                {session.sourceCount} sources
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSessionList = (session: SessionDetail) => {
    const modeInfo = getModeBadge(session.mode);
    const ModeIcon = modeInfo.icon;
    const pastel = getPastelTheme(`${session.notebookTitle}-${session.sessionId}`);
    const isMenuOpen = activeMenuSessionId === session.sessionId;

    return (
      <div
        key={session.sessionId}
        onClick={() => openNotebookSession(session)}
        className="group cursor-pointer w-full px-4 py-3.5 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
      >
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg ${pastel}`}>
            <ModeIcon className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{session.notebookTitle}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {session.sourceCount} sources • {formatDateTime(session.createdAt)}
            </p>
          </div>

          <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full border ${modeInfo.className} flex items-center gap-1.5`}>
            <ModeIcon className="w-3 h-3" />
            {modeInfo.label}
          </span>

          <span className="text-xs text-slate-600 font-medium">
            {session.messageCount}
          </span>

          <span className="text-xs text-slate-500 whitespace-nowrap">
            {timeAgo(session.lastUpdated)}
          </span>

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuSessionId(isMenuOpen ? null : session.sessionId);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-10">
                <button
                  onClick={(e) => renameNotebook(session, e)}
                  className="w-full px-3 py-2.5 rounded-lg text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                >
                  <PencilLine className="w-3.5 h-3.5 text-slate-500" />
                  Edit Notebook Title
                </button>
                <button
                  onClick={(e) => deleteSession(session.sessionId, e)}
                  className="w-full px-3 py-2.5 rounded-lg text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Session
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-800">
      <Head>
        <title>NoteMind</title>
        <meta name="description" content="Central dashboard for session history" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap gap-3 items-center justify-between">
          {/* Logo với gradient text giống NotebookWorkspace */}
          <div
            onClick={() => router.push("/")}
            className="flex items-center gap-3 cursor-pointer group transition-all hover:scale-105"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 group-hover:shadow-indigo-300 transition-all">
              <Zap className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
              NoteMind
            </span>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="h-10 px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-indigo-200 transition-all duration-300 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Notebook
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <section className="mb-8 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex-1 min-w-[280px] max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by notebook name or mode..."
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
            />
          </div>

          <div className="flex items-center p-1 rounded-lg border border-slate-200 bg-white shadow-sm">
            {(["grid", "list"] as ViewType[]).map((type) => (
              <button
                key={type}
                onClick={() => setViewType(type)}
                className={`p-2 rounded-md transition-all ${viewType === type
                    ? "bg-indigo-100 text-indigo-700 shadow-sm"
                    : "text-slate-500 hover:bg-slate-100"
                  }`}
                title={`${type} view`}
              >
                {type === "grid" ? <Grid3X3 className="w-4 h-4" /> : <List className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </section>

        <section>
          {loading ? (
            <div className="py-20 flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-3 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-sm text-slate-500 font-medium">Loading sessions...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-700">No sessions found</p>
            </div>
          ) : viewType === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSessions.map(renderSessionCard)}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Notebook</span>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider ml-auto">Mode</span>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Messages</span>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Updated</span>
                <span className="w-8" />
              </div>
              {filteredSessions.map(renderSessionList)}
            </div>
          )}
        </section>
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create New Notebook</h3>
                <p className="text-xs text-slate-500 mt-0.5">Start a new AI-powered workspace</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <input
                value={newNotebookTitle}
                onChange={(e) => setNewNotebookTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !creatingNotebook && createNotebook()}
                placeholder="Enter notebook name..."
                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                autoFocus
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 h-10 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={createNotebook}
                  disabled={creatingNotebook}
                  className="px-5 h-10 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {creatingNotebook ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Create & Open
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS cho gradient animation giống NotebookWorkspace */}
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