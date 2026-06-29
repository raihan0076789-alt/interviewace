"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, ChevronRight, Loader2, Trophy, FileText,
  Trash2, AlertTriangle, Zap, TrendingUp, Star, Flame,
  Code2, Layers, BarChart2, Server, GitBranch, Brain,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import ScoreBadge from "@/components/ScoreBadge";
import ResumeUpload from "@/components/ResumeUpload";
import BackgroundEffect from "@/components/BackgroundEffect";
import {
  authAPI, sessionsAPI, codingAPI,
  type User, type Session, type ExtractedResumeInfo,
} from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";


// ── Helpers ───────────────────────────────────────────────────────────────

const ROLE_ICONS: Record<string, React.ReactNode> = {
  "backend":      <Server className="w-4 h-4" />,
  "frontend":     <Code2 className="w-4 h-4" />,
  "full stack":   <Layers className="w-4 h-4" />,
  "data":         <BarChart2 className="w-4 h-4" />,
  "devops":       <GitBranch className="w-4 h-4" />,
  "python":       <Zap className="w-4 h-4" />,
  "ai":           <Brain className="w-4 h-4" />,
  "ml":           <Brain className="w-4 h-4" />,
};

function getRoleIcon(role: string): React.ReactNode {
  const lower = role.toLowerCase();
  for (const [key, icon] of Object.entries(ROLE_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return <Zap className="w-4 h-4" />;
}

function computeStreak(sessions: Session[]): number {
  if (!sessions.length) return 0;
  const DAY = 86400000;
  const today = new Date(); today.setHours(0,0,0,0);
  const days = new Set(sessions.map(s => {
    const d = new Date(s.started_at); d.setHours(0,0,0,0); return d.getTime();
  }));
  const t = today.getTime();
  if (!days.has(t) && !days.has(t - DAY)) return 0;
  let streak = 0;
  let cur = days.has(t) ? t : t - DAY;
  while (days.has(cur)) { streak++; cur -= DAY; }
  return streak;
}

const ROLES = [
  "SDE-1 Backend", "SDE-1 Frontend", "Full Stack Developer",
  "Data Analyst", "DevOps Engineer", "Python Developer",
  "AI/ML Engineer", "Other",
];
const DIFFICULTIES = ["easy", "medium", "hard"] as const;
type Tab = "quick" | "resume"| "coding";

// ── Component ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser]         = useState<User | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("quick");

  const [role, setRole]           = useState(ROLES[0]);
  const [difficulty, setDifficulty] = useState<typeof DIFFICULTIES[number]>("medium");
  const [questionCount, setQuestionCount] = useState(5);
  const [creating, setCreating]   = useState(false);
  const [formError, setFormError] = useState("");

  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing]         = useState(false);

  // Moved internal coding-related states inside the component scope
  const [codingLanguage, setCodingLanguage] = useState<"python"|"javascript"|"java"|"cpp">("python");
  const [codingProblemCount, setCodingProblemCount] = useState(1);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    Promise.all([authAPI.me(), sessionsAPI.list()])
      .then(([u, s]) => { setUser(u); setSessions(s); })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const completed = sessions.filter(s => s.overall_score !== null);
    const scores = completed.map(s => s.overall_score as number);
    return {
      total:   sessions.length,
      average: scores.length ? +(scores.reduce((a,b) => a+b,0)/scores.length).toFixed(1) : null,
      best:    scores.length ? +Math.max(...scores).toFixed(1) : null,
      streak:  computeStreak(sessions),
    };
  }, [sessions]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleQuickStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(""); setCreating(true);
    try {
      const session = await sessionsAPI.create(role, difficulty, questionCount);
      router.push(`/practice/${session.id}`);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create session");
      setCreating(false);
    }
  };

  const handleResumeStart = async (data: {
    resumeText: string; questions: string[]; role: string; extractedInfo: ExtractedResumeInfo;
  }) => {
    setCreating(true); setFormError("");
    try {
      const session = await sessionsAPI.create(
        data.role, "medium", data.questions.length,
        { resumeText: data.resumeText, customQuestions: data.questions }
      );
      router.push(`/practice/${session.id}`);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create session");
      setCreating(false);
    }
  };

  // Moved the coding handler inside the component scope
  const handleCodingStart = async () => {
    setFormError(""); setCreating(true);
    try {
      const session = await codingAPI.createSession(role, difficulty, codingLanguage, codingProblemCount);
      router.push(`/coding/${session.id}`);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create coding session");
      setCreating(false);
    }
  };

  const handleClearHistory = async () => {
    setClearing(true);
    try {
      await sessionsAPI.clearAll();
      setSessions([]);
      setConfirmClear(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to clear history");
    } finally {
      setClearing(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#041B1A" }}>
        <BackgroundEffect />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#10B981" }} />
          <p className="text-sm" style={{ color: "rgba(110,231,183,0.5)" }}>Loading your workspace…</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative" style={{ background: "#041B1A" }}>
      <BackgroundEffect />
      <div className="relative z-10">
        <Navbar email={user?.email} />

        <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">

          {/* Welcome */}
          <div className="animate-slide-up">
            <h1 className="text-2xl font-bold text-white">
              Welcome back{user?.email ? `, ${user.email.split("@")[0]}` : ""}
            </h1>
            <p className="text-sm mt-1" style={{ color: "rgba(110,231,183,0.5)" }}>
              {sessions.length === 0
                ? "Start your first practice session below."
                : `You have completed ${sessions.length} session${sessions.length !== 1 ? "s" : ""}. Keep going!`}
            </p>
          </div>

          {/* ── Stats row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up"
            style={{ animationDelay: "0.05s" }}>

            {/* Total Sessions */}
            <div className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "rgba(110,231,183,0.5)" }}>Sessions</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <Zap className="w-4 h-4" style={{ color: "#10B981" }} />
                </div>
              </div>
              <p className="text-3xl font-bold text-white">{stats.total}</p>
              <p className="text-xs mt-1" style={{ color: "rgba(110,231,183,0.4)" }}>Total practice sessions</p>
            </div>

            {/* Average Score */}
            <div className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "rgba(110,231,183,0.5)" }}>Average</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.2)" }}>
                  <TrendingUp className="w-4 h-4" style={{ color: "#14B8A6" }} />
                </div>
              </div>
              <p className="text-3xl font-bold text-white">
                {stats.average !== null ? stats.average : "—"}
              </p>
              <p className="text-xs mt-1" style={{ color: "rgba(110,231,183,0.4)" }}>Average score /10</p>
            </div>

            {/* Best Score */}
            <div className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "rgba(110,231,183,0.5)" }}>Best</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.2)" }}>
                  <Star className="w-4 h-4" style={{ color: "#34D399" }} />
                </div>
              </div>
              <p className="text-3xl font-bold text-white">
                {stats.best !== null ? stats.best : "—"}
              </p>
              <p className="text-xs mt-1" style={{ color: "rgba(110,231,183,0.4)" }}>Personal best /10</p>
            </div>

            {/* Streak */}
            <div className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "rgba(110,231,183,0.5)" }}>Streak</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.2)" }}>
                  <Flame className="w-4 h-4" style={{ color: "#F97316" }} />
                </div>
              </div>
              <p className="text-3xl font-bold text-white">
                {stats.streak}
                <span className="text-base font-normal ml-1" style={{ color: "rgba(110,231,183,0.4)" }}>day{stats.streak !== 1 ? "s" : ""}</span>
              </p>
              <p className="text-xs mt-1" style={{ color: "rgba(110,231,183,0.4)" }}>Consecutive days</p>
            </div>
          </div>

          {/* ── Main grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up"
            style={{ animationDelay: "0.1s" }}>

            {/* ── Left: New Session form ── */}
            <div className="lg:col-span-1">
              <div className="card sticky top-24 space-y-5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.2)" }}>
                    <Plus className="w-4 h-4" style={{ color: "#10B981" }} />
                  </div>
                  <h2 className="font-semibold text-white text-sm">New Session</h2>
                </div>

                {/* Tab bar */}
                <div className="tab-bar">
                  <button className={`tab-item ${activeTab === "quick" ? "active-quick" : ""}`}
                    onClick={() => setActiveTab("quick")}>
                    <Zap className="w-3.5 h-3.5" /> Quick
                  </button>
                  <button className={`tab-item ${activeTab === "resume" ? "active-resume" : ""}`}
                    onClick={() => setActiveTab("resume")}>
                    <FileText className="w-3.5 h-3.5" /> Resume
                  </button>
                  <button className={`tab-item ${activeTab === "coding" ? "active-resume" : ""}`}
                    onClick={() => setActiveTab("coding")}>
                    <Code2 className="w-3.5 h-3.5" /> Code
                  </button>
                </div>

                {formError && (
                  <div className="text-sm px-3 py-2 rounded-lg"
                    style={{ color: "#F87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
                    {formError}
                  </div>
                )}

                {activeTab === "quick" && (
                  <form onSubmit={handleQuickStart} className="space-y-4">
                    <div>
                      <label htmlFor="role">Target role</label>
                      <select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
                        {ROLES.map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="difficulty">Difficulty</label>
                      <select id="difficulty" value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value as typeof DIFFICULTIES[number])}>
                        {DIFFICULTIES.map((d) => (
                          <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label style={{ marginBottom: 0 }}>Questions</label>
                        <span className="text-sm font-semibold" style={{ color: "#34D399" }}>{questionCount}</span>
                      </div>
                      <input type="range" min={3} max={10} value={questionCount}
                        onChange={(e) => setQuestionCount(Number(e.target.value))} />
                      <div className="flex justify-between text-xs mt-1" style={{ color: "rgba(110,231,183,0.3)" }}>
                        <span>3 min</span><span>10 max</span>
                      </div>
                    </div>

                    <button type="submit" disabled={creating} className="btn-primary w-full">
                      {creating
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating questions…</>
                        : <><Plus className="w-4 h-4" /> Start Practice</>}
                    </button>
                  </form>
                )}

                {activeTab === "resume" && (
                  <div>
                    <p className="text-xs leading-relaxed mb-4"
                      style={{ color: "rgba(110,231,183,0.45)" }}>
                      Upload your resume and Aira will generate questions specifically
                      about your projects, skills, and experience.
                    </p>
                    <ResumeUpload onStart={handleResumeStart} loading={creating} />
                  </div>
                )}
                {activeTab === "coding" && (
                  <div className="space-y-4">
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(110,231,183,0.45)" }}>
                      Practice coding interviews with a real editor, test cases, and Aira's technical follow-up questions.
                    </p>
                    <div>
                      <label htmlFor="c-role">Target role</label>
                      <select id="c-role" value={role} onChange={(e) => setRole(e.target.value)}>
                        {ROLES.map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="c-diff">Difficulty</label>
                      <select id="c-diff" value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)}>
                        {DIFFICULTIES.map((d) => (
                          <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="c-lang">Language</label>
                      <select id="c-lang" value={codingLanguage} onChange={(e) => setCodingLanguage(e.target.value as any)}>
                        {[["python","Python"],["javascript","JavaScript"],["java","Java"],["cpp","C++"]].map(([v,l])=>(
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label>Problems ({codingProblemCount})</label>
                      <input type="range" min={1} max={3} value={codingProblemCount}
                        onChange={(e) => setCodingProblemCount(Number(e.target.value))}
                        className="w-full accent-indigo-500 bg-transparent border-none p-0 focus:ring-0" />
                      <div className="flex justify-between text-xs mt-1" style={{ color: "rgba(110,231,183,0.3)" }}>
                        <span>1</span><span>3</span>
                      </div>
                    </div>
                    <button onClick={handleCodingStart} disabled={creating} className="btn-primary w-full">
                      {creating
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating problems…</>
                        : <><Code2 className="w-4 h-4" /> Start Coding Interview</>}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Right: History ── */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-white">Practice History</h2>
                  {sessions.length > 0 && (
                    <p className="text-xs mt-0.5" style={{ color: "rgba(110,231,183,0.4)" }}>
                      {sessions.length} session{sessions.length !== 1 ? "s" : ""} · click to continue or view report
                    </p>
                  )}
                </div>

                {sessions.length > 0 && !confirmClear && (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                    style={{ color: "rgba(248,113,113,0.5)", border: "1px solid transparent" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = "#F87171";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(248,113,113,0.2)";
                      (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.06)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = "rgba(248,113,113,0.5)";
                      (e.currentTarget as HTMLElement).style.borderColor = "transparent";
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear History
                  </button>
                )}
              </div>

              {/* Confirm clear */}
              {confirmClear && (
                <div className="card animate-slide-up" style={{
                  borderColor: "rgba(248,113,113,0.25)",
                  background: "rgba(40,8,8,0.5)",
                }}>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#F87171" }} />
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{ color: "#F87171" }}>
                        Delete all {sessions.length} session{sessions.length !== 1 ? "s" : ""}?
                      </p>
                      <p className="text-xs mt-1" style={{ color: "rgba(248,113,113,0.6)" }}>
                        This permanently removes all your sessions, answers, scores, and feedback.
                        This action cannot be undone.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4 justify-end">
                    <button onClick={() => setConfirmClear(false)} disabled={clearing}
                      className="btn-secondary text-sm py-2 px-4">Cancel</button>
                    <button onClick={handleClearHistory} disabled={clearing}
                      className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-50"
                      style={{
                        background: "linear-gradient(135deg,#DC2626,#EF4444)",
                        color: "white",
                        boxShadow: "0 4px 12px rgba(220,38,38,0.3)",
                      }}>
                      {clearing
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Clearing…</>
                        : <><Trash2 className="w-4 h-4" /> Yes, Clear All</>}
                    </button>
                  </div>
                </div>
              )}

              {/* Session list */}
              {sessions.length === 0 ? (
                <div className="card text-center py-16" style={{ borderStyle: "dashed" }}>
                  <Trophy className="w-12 h-12 mx-auto mb-3" style={{ color: "rgba(16,185,129,0.2)" }} />
                  <p className="font-medium text-white">No sessions yet</p>
                  <p className="text-sm mt-1" style={{ color: "rgba(110,231,183,0.35)" }}>
                    Start a quick practice or upload your resume to begin
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {sessions.map((session, idx) => (
                    <div
                      key={session.id}
                      className="session-card flex items-center gap-4"
                      style={{ animationDelay: `${idx * 0.04}s` }}
                      onClick={() =>
                        session.overall_score !== null
                          ? router.push(`/report/${session.id}`)
                          : router.push(`/practice/${session.id}`)
                      }
                    >
                      {/* Role icon */}
                      <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                          background: "rgba(16,185,129,0.08)",
                          border: "1px solid rgba(16,185,129,0.15)",
                          color: "#10B981",
                        }}>
                        {getRoleIcon(session.role)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-white truncate">{session.role}</p>
                          {session.is_resume_based && (
                            <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-md"
                              style={{
                                background: "rgba(16,185,129,0.1)",
                                border: "1px solid rgba(16,185,129,0.2)",
                                color: "#34D399",
                              }}>
                              Resume
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "rgba(110,231,183,0.4)" }}>
                          {session.difficulty.charAt(0).toUpperCase() + session.difficulty.slice(1)}
                          {" · "}
                          {session.questions.length} question{session.questions.length !== 1 ? "s" : ""}
                          {" · "}
                          {new Date(session.started_at).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                        </p>
                      </div>

                      {/* Score + arrow */}
                      <div className="flex items-center gap-3 shrink-0">
                        {session.overall_score === null && (
                          <span className="text-xs px-2 py-1 rounded-md"
                            style={{
                              color: "rgba(251,191,36,0.8)",
                              background: "rgba(251,191,36,0.08)",
                              border: "1px solid rgba(251,191,36,0.2)",
                            }}>
                            In Progress
                          </span>
                        )}
                        <ScoreBadge score={session.overall_score} size="sm" />
                        <ChevronRight className="w-4 h-4" style={{ color: "rgba(16,185,129,0.3)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}