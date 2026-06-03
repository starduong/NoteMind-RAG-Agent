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
} from "lucide-react";
import NotebookWorkspace from "../components/NotebookWorkspace";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Mode = "chat" | "research" | "quiz" | "roadmap";
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
  return value === "chat" || value === "research" || value === "quiz" || value === "roadmap";
}

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
    return (
      (typeof notebook_id === "string" && notebook_id.length > 0) ||
      (typeof session_id === "string" && session_id.length > 0)
    );
  }, [router.isReady, router.query]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const notebooksRes = await axios.get(`${API}/notebooks`);
      const notebooksList: Notebook[] = notebooksRes.data.notebooks || [];

      const notebooksMap: Record<string, string> = {};
      const notebookSourceMap: Record<string, number> = {};
      notebooksList.forEach((nb) => {
        notebooksMap[nb.notebook_id] = nb.title;
        notebookSourceMap[nb.notebook_id] = nb.source_count || 0;
      });

      const sessionsRes = await axios.get(`${API}/sessions`);
      const sessionIds: string[] = sessionsRes.data.sessions || [];

      const detailsPromises = sessionIds.map(async (sid) => {
        try {
          const detailRes = await axios.get(`${API}/sessions/${sid}/history`);
          const historyData = detailRes.data;
          const messages = historyData.messages || [];
          const metadata = historyData.metadata || {};

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
            notebookTitle: notebookId ? (notebooksMap[notebookId] || "Notebook đã xóa") : "Workspace chung",
            mode,
            messageCount: metadata.message_count || messages.length,
            sourceCount: notebookId ? (notebookSourceMap[notebookId] || 0) : 0,
            lastUpdated: metadata.last_updated || new Date().toISOString(),
            createdAt: metadata.created_at || new Date().toISOString(),
          } as SessionDetail;
        } catch (err) {
          console.error(`Failed to fetch history for session ${sid}`, err);
          return null;
        }
      });

      const details = await Promise.all(detailsPromises);
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
    const title = newNotebookTitle.trim() || "Notebook mới";
    try {
      setCreatingNotebook(true);
      const res = await axios.post(`${API}/notebooks`, { title, description: "" });
      setShowCreateModal(false);
      setNewNotebookTitle("");
      const notebookId = res.data.notebook_id as string;
      await router.push(`/?notebook_id=${encodeURIComponent(notebookId)}`);
    } catch (err) {
      console.error("Failed to create notebook:", err);
    } finally {
      setCreatingNotebook(false);
    }
  };

  const openNotebookSession = (session: SessionDetail) => {
    const notebookParam = session.notebookId ? `&notebook_id=${encodeURIComponent(session.notebookId)}` : "";
    router.push(`/?session_id=${encodeURIComponent(session.sessionId)}${notebookParam}`);
  };

  const deleteSession = async (sessionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Bạn có chắc chắn muốn xóa phiên này?")) return;
    try {
      await axios.delete(`${API}/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      setActiveMenuSessionId(null);
    } catch (err) {
      console.error("Failed to delete session:", err);
      alert("Không thể xóa phiên.");
    }
  };

  const renameNotebook = async (session: SessionDetail, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!session.notebookId) {
      alert("Phiên này không gắn với notebook cụ thể.");
      return;
    }
    const nextTitle = prompt("Nhập tên notebook mới:", session.notebookTitle);
    const title = nextTitle?.trim();
    if (!title) return;
    try {
      await axios.patch(`${API}/notebooks/${session.notebookId}`, { title });
      setSessions((prev) =>
        prev.map((item) =>
          item.notebookId === session.notebookId ? { ...item, notebookTitle: title } : item
        )
      );
      setActiveMenuSessionId(null);
    } catch (err) {
      console.error("Failed to rename notebook:", err);
      alert("Không thể đổi tên notebook.");
    }
  };

  const timeAgo = (isoString: string) => {
    const then = new Date(isoString).getTime();
    const now = Date.now();
    const diffMinutes = Math.max(1, Math.floor((now - then) / 60000));
    if (diffMinutes < 60) return `${diffMinutes} phút trước`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return formatDateTime(isoString);
  };

  const pastelThemes = [
    "bg-pink-50 text-pink-700",
    "bg-emerald-50 text-emerald-700",
    "bg-purple-50 text-purple-700",
    "bg-sky-50 text-sky-700",
    "bg-orange-50 text-orange-700",
    "bg-indigo-50 text-indigo-700",
  ];

  const getPastelTheme = (seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % pastelThemes.length;
    return pastelThemes[idx];
  };

  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  const getModeBadge = (mode: Mode) => {
    switch (mode) {
      case "research":
        return { label: "Research", className: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: Sparkles };
      case "quiz":
        return { label: "Quiz", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: Layers };
      case "roadmap":
        return { label: "Roadmap", className: "bg-amber-50 text-amber-700 border-amber-200", icon: Compass };
      case "chat":
      default:
        return { label: "Chat", className: "bg-sky-50 text-sky-700 border-sky-200", icon: MessageSquare };
    }
  };

  const filteredSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return sessions.filter((session) => {
      const searchMatch =
        query.length === 0 ||
        session.notebookTitle.toLowerCase().includes(query);
      return searchMatch;
    });
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

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-800">
      <Head>
        <title>NoteMind Dashboard</title>
        <meta name="description" content="Central dashboard for session history" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-[#F8F9FA]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-sm">N</div>
            <div>
              <p className="text-sm font-semibold text-slate-900">NoteMind</p>
            </div>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="h-10 px-4 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Tạo Notebook Mới
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Simplified top bar: only search and view toggle */}
        <section className="mb-6 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex-1 min-w-[240px] max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo tên notebook..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg border border-slate-200 bg-white">
            <button
              onClick={() => setViewType("grid")}
              className={`p-1.5 rounded ${viewType === "grid" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-100"}`}
              title="Grid view"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewType("list")}
              className={`p-1.5 rounded ${viewType === "list" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-100"}`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </section>

        <section>
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <div className="w-7 h-7 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-sm text-slate-500">Đang tải dữ liệu dashboard...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
              <p className="text-sm text-slate-600">Không có phiên nào phù hợp với tìm kiếm hiện tại.</p>
            </div>
          ) : viewType === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredSessions.map((session) => {
                const modeInfo = getModeBadge(session.mode);
                const ModeIcon = modeInfo.icon;
                const pastel = getPastelTheme(`${session.notebookTitle}-${session.sessionId}`);
                return (
                  <div
                    key={session.sessionId}
                    onClick={() => openNotebookSession(session)}
                    className="cursor-pointer text-left bg-white border border-slate-100 rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${modeInfo.className}`}>
                        <ModeIcon className="w-2.5 h-2.5" />
                        {modeInfo.label}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-full ${pastel}`}>
                          <Clock className="w-3 h-3" />
                          {timeAgo(session.lastUpdated)}
                        </span>
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuSessionId((prev) => (prev === session.sessionId ? null : session.sessionId));
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {activeMenuSessionId === session.sessionId && (
                            <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-sm p-1 z-10">
                              <button
                                onClick={(e) => renameNotebook(session, e)}
                                className="w-full px-2.5 py-2 rounded-lg text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <PencilLine className="w-3.5 h-3.5 text-slate-500" />
                                Chỉnh sửa tiêu đề
                              </button>
                              <button
                                onClick={(e) => deleteSession(session.sessionId, e)}
                                className="w-full px-2.5 py-2 rounded-lg text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Xóa phiên
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 truncate">{session.notebookTitle}</h3>
                    <div className="mt-2 text-xs text-slate-600 flex items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                        {session.messageCount} tin nhắn
                      </span>
                      <span className="text-slate-400">{session.sourceCount} tài liệu</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
              {filteredSessions.map((session) => {
                const modeInfo = getModeBadge(session.mode);
                const ModeIcon = modeInfo.icon;
                const pastel = getPastelTheme(`${session.notebookTitle}-${session.sessionId}`);
                return (
                  <div
                    key={session.sessionId}
                    onClick={() => openNotebookSession(session)}
                    className="cursor-pointer w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors relative"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{session.notebookTitle}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Cập nhật: {timeAgo(session.lastUpdated)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${pastel}`}>
                          {session.sourceCount} tài liệu
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${modeInfo.className}`}>
                          <ModeIcon className="w-2.5 h-2.5" />
                          {modeInfo.label}
                        </span>
                        <span className="text-xs text-slate-600">{session.messageCount} tin nhắn</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuSessionId((prev) => (prev === session.sessionId ? null : session.sessionId));
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {activeMenuSessionId === session.sessionId && (
                          <div className="absolute right-4 top-11 w-44 bg-white border border-slate-200 rounded-xl shadow-sm p-1 z-10">
                            <button
                              onClick={(e) => renameNotebook(session, e)}
                              className="w-full px-2.5 py-2 rounded-lg text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            >
                              <PencilLine className="w-3.5 h-3.5 text-slate-500" />
                              Chỉnh sửa tiêu đề
                            </button>
                            <button
                              onClick={(e) => deleteSession(session.sessionId, e)}
                              className="w-full px-2.5 py-2 rounded-lg text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Xóa phiên
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/30" onClick={() => setShowCreateModal(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">Tạo Notebook Mới</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              value={newNotebookTitle}
              onChange={(e) => setNewNotebookTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !creatingNotebook && createNotebook()}
              placeholder="Nhập tên notebook..."
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3.5 h-9 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                onClick={createNotebook}
                disabled={creatingNotebook}
                className="px-3.5 h-9 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                {creatingNotebook ? "Đang tạo..." : "Tạo và mở Workspace"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}