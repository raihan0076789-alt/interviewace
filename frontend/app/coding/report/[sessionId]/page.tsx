"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Trophy, CheckCircle2, XCircle, Loader2, Code2,
  TrendingUp, Eye, Zap, ChevronDown, ChevronUp,
  ArrowLeft, RotateCcw, MessageSquare, Clock,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import BackgroundEffect from "@/components/BackgroundEffect";
import { codingAPI } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

const LANG_LABELS: Record<string, string> = {
  python: "Python", javascript: "JavaScript", java: "Java", cpp: "C++",
};

const DIFF_COLOR: Record<string, string> = {
  easy: "#34D399", medium: "#FCD34D", hard: "#F87171",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  accepted:      { label: "Accepted",      color: "#34D399", bg: "rgba(52,211,153,0.1)"  },
  wrong_answer:  { label: "Wrong Answer",  color: "#F87171", bg: "rgba(248,113,113,0.1)" },
  runtime_error: { label: "Runtime Error", color: "#F87171", bg: "rgba(248,113,113,0.1)" },
  compile_error: { label: "Compile Error", color: "#F87171", bg: "rgba(248,113,113,0.1)" },
  time_limit:    { label: "Time Limit",    color: "#FCD34D", bg: "rgba(252,211,77,0.1)"  },
  pending:       { label: "Not Submitted", color: "rgba(110,231,183,0.3)", bg: "rgba(16,185,129,0.05)" },
};

function ScoreRing({ score, size = 80 }: { score: number | null; size?: number }) {
  const val = score ?? 0;
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (val / 10) * circumference;
  const color = val >= 8 ? "#34D399" : val >= 6 ? "#FCD34D" : "#F87171";

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(16,185,129,0.1)" strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: size > 70 ? "1.25rem" : "0.875rem", fontWeight: 800, color }}>
          {score !== null ? score.toFixed(1) : "—"}
        </span>
        <span style={{ fontSize: "0.55rem", color: "rgba(110,231,183,0.4)", marginTop: 1 }}>/10</span>
      </div>
    </div>
  );
}

function ProblemCard({ problem, index }: { problem: any; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const sub = problem.best_submission;
  const statusCfg = STATUS_CONFIG[sub?.status ?? "pending"];

  return (
    <div style={{
      background: "rgba(5,30,27,0.65)", backdropFilter: "blur(12px)",
      border: "1px solid rgba(16,185,129,0.12)", borderRadius: "0.875rem",
      overflow: "hidden", transition: "border-color 0.3s",
    }}>
      {/* Header row */}
      <button onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          gap: "0.875rem", padding: "1rem 1.25rem",
          background: "transparent", border: "none", cursor: "pointer",
          textAlign: "left",
        }}>

        {/* Problem number */}
        <div style={{
          width: 32, height: 32, borderRadius: "0.5rem", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)",
          fontSize: "0.8rem", fontWeight: 700, color: "#34D399",
        }}>
          {index + 1}
        </div>

        {/* Title + difficulty */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "#fff", marginBottom: "0.2rem" }}>
            {problem.title}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{
              fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.08em", padding: "0.15rem 0.5rem", borderRadius: "999px",
              color: DIFF_COLOR[problem.difficulty],
              background: `${DIFF_COLOR[problem.difficulty]}18`,
              border: `1px solid ${DIFF_COLOR[problem.difficulty]}35`,
            }}>
              {problem.difficulty}
            </span>
            {sub && (
              <span style={{
                fontSize: "0.62rem", fontWeight: 600, padding: "0.15rem 0.5rem",
                borderRadius: "999px", color: statusCfg.color,
                background: statusCfg.bg,
              }}>
                {statusCfg.label}
              </span>
            )}
          </div>
        </div>

        {/* Score ring */}
        <ScoreRing score={sub?.overall_score ?? null} size={52} />

        {open
          ? <ChevronUp style={{ width: 16, height: 16, color: "rgba(110,231,183,0.4)", flexShrink: 0 }} />
          : <ChevronDown style={{ width: 16, height: 16, color: "rgba(110,231,183,0.4)", flexShrink: 0 }} />}
      </button>

      {open && sub && (
        <div style={{ borderTop: "1px solid rgba(16,185,129,0.08)", padding: "1rem 1.25rem" }}>

          {/* Stats row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
            {[
              { icon: <CheckCircle2 style={{ width: 12, height: 12 }} />, label: "Tests", val: `${sub.test_cases_passed}/${sub.test_cases_total} passed` },
              { icon: <Code2 style={{ width: 12, height: 12 }} />, label: "Quality", val: `${sub.code_quality_score?.toFixed(1) ?? "—"}/10` },
              { icon: <TrendingUp style={{ width: 12, height: 12 }} />, label: "Time", val: (sub.ai_feedback as any)?.time_complexity ?? "—" },
              { icon: <Eye style={{ width: 12, height: 12 }} />, label: "Space", val: (sub.ai_feedback as any)?.space_complexity ?? "—" },
              { icon: <Clock style={{ width: 12, height: 12 }} />, label: "Runtime", val: sub.execution_time_ms ? `${sub.execution_time_ms.toFixed(0)}ms` : "—" },
              { icon: <Code2 style={{ width: 12, height: 12 }} />, label: "Language", val: LANG_LABELS[sub.language] ?? sub.language },
            ].map(s => (
              <div key={s.label} style={{
                display: "flex", alignItems: "center", gap: "0.3rem",
                padding: "0.3rem 0.625rem", borderRadius: "0.4rem",
                background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.14)",
                fontSize: "0.72rem", color: "#A7F3D0",
              }}>
                <span style={{ color: "rgba(110,231,183,0.4)" }}>{s.icon}</span>
                <span style={{ color: "rgba(110,231,183,0.4)" }}>{s.label}:</span> {s.val}
              </div>
            ))}
          </div>

          {/* AI Feedback */}
          {sub.ai_feedback && (
            <div style={{ marginBottom: "1rem" }}>
              <p style={{
                fontSize: "0.8rem", color: "rgba(167,243,208,0.65)",
                lineHeight: 1.7, marginBottom: "0.75rem",
              }}>
                {(sub.ai_feedback as any).feedback}
              </p>

              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                {/* Strengths */}
                {(sub.ai_feedback as any).strengths?.length > 0 && (
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <p style={{ fontSize: "0.68rem", fontWeight: 700, color: "#34D399",
                      textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>
                      Strengths
                    </p>
                    {(sub.ai_feedback as any).strengths.map((s: string, i: number) => (
                      <div key={i} style={{ display: "flex", gap: "0.375rem", marginBottom: "0.25rem" }}>
                        <CheckCircle2 style={{ width: 11, height: 11, color: "#34D399", flexShrink: 0, marginTop: 2 }} />
                        <span style={{ fontSize: "0.75rem", color: "rgba(52,211,153,0.7)" }}>{s}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Weaknesses */}
                {(sub.ai_feedback as any).weaknesses?.length > 0 && (
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <p style={{ fontSize: "0.68rem", fontWeight: 700, color: "#F87171",
                      textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>
                      To Improve
                    </p>
                    {(sub.ai_feedback as any).weaknesses.map((w: string, i: number) => (
                      <div key={i} style={{ display: "flex", gap: "0.375rem", marginBottom: "0.25rem" }}>
                        <XCircle style={{ width: 11, height: 11, color: "#F87171", flexShrink: 0, marginTop: 2 }} />
                        <span style={{ fontSize: "0.75rem", color: "rgba(248,113,113,0.7)" }}>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Optimizations */}
              {(sub.ai_feedback as any).optimizations?.length > 0 && (
                <div style={{ marginTop: "0.625rem" }}>
                  <p style={{ fontSize: "0.68rem", fontWeight: 700, color: "#FCD34D",
                    textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>
                    Optimization Suggestions
                  </p>
                  {(sub.ai_feedback as any).optimizations.map((o: string, i: number) => (
                    <div key={i} style={{ display: "flex", gap: "0.375rem", marginBottom: "0.25rem" }}>
                      <Zap style={{ width: 11, height: 11, color: "#FCD34D", flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontSize: "0.75rem", color: "rgba(252,211,77,0.7)" }}>{o}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Aira Follow-ups */}
          {problem.followups?.length > 0 && (
            <div style={{
              borderTop: "1px solid rgba(16,185,129,0.08)",
              paddingTop: "0.875rem", marginTop: "0.5rem",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.625rem" }}>
                <MessageSquare style={{ width: 13, height: 13, color: "#10B981" }} />
                <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#34D399",
                  textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Aira Follow-ups
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                {problem.followups.map((fq: any, i: number) => (
                  <div key={fq.id} style={{
                    padding: "0.625rem 0.875rem", borderRadius: "0.5rem",
                    background: "rgba(16,185,129,0.04)",
                    border: "1px solid rgba(16,185,129,0.1)",
                  }}>
                    <p style={{ fontSize: "0.78rem", color: "#A7F3D0", marginBottom: "0.35rem", lineHeight: 1.6 }}>
                      🤖 {fq.question}
                    </p>
                    {fq.user_answer ? (
                      <p style={{ fontSize: "0.73rem", color: "rgba(110,231,183,0.55)", fontStyle: "italic" }}>
                        ↳ {fq.user_answer}
                      </p>
                    ) : (
                      <p style={{ fontSize: "0.7rem", color: "rgba(110,231,183,0.25)", fontStyle: "italic" }}>
                        ↳ Not answered
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Not submitted */}
      {open && !sub && (
        <div style={{
          borderTop: "1px solid rgba(16,185,129,0.08)",
          padding: "1.25rem", textAlign: "center",
          color: "rgba(110,231,183,0.3)", fontSize: "0.8rem", fontStyle: "italic",
        }}>
          This problem was not submitted.
        </div>
      )}
    </div>
  );
}

export default function CodingReportPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = Number(params.sessionId);

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    codingAPI.getReport(sessionId)
      .then(setReport)
      .catch(() => router.replace("/dashboard"))
      .finally(() => setLoading(false));
  }, [sessionId, router]);

  if (loading || !report) {
    return (
      <div style={{ minHeight: "100vh", background: "#041B1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <BackgroundEffect />
        <Loader2 style={{ width: 32, height: 32, color: "#10B981", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  const passRate = report.total_test_cases > 0
    ? Math.round((report.total_test_cases_passed / report.total_test_cases) * 100)
    : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#041B1A" }}>
      <BackgroundEffect />
      <div style={{ position: "relative", zIndex: 10 }}>
        <Navbar />

        <main style={{ maxWidth: 860, margin: "0 auto", padding: "2rem 1rem 4rem" }}>

          {/* Back button */}
          <button onClick={() => router.push("/dashboard")}
            style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              fontSize: "0.8rem", color: "rgba(110,231,183,0.45)",
              background: "none", border: "none", cursor: "pointer",
              marginBottom: "1.5rem", padding: 0,
              transition: "color 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#34D399")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(110,231,183,0.45)")}>
            <ArrowLeft style={{ width: 14, height: 14 }} />
            Back to Dashboard
          </button>

          {/* Hero card */}
          <div style={{
            background: "rgba(5,30,27,0.7)", backdropFilter: "blur(16px)",
            border: "1px solid rgba(16,185,129,0.15)",
            borderRadius: "1rem", padding: "2rem", marginBottom: "1.5rem",
            textAlign: "center",
          }}>
            <Trophy style={{ width: 40, height: 40, color: "#F59E0B", margin: "0 auto 1rem" }} />
            <h1 style={{ fontSize: "1.625rem", fontWeight: 800, color: "#fff",
              letterSpacing: "-0.03em", marginBottom: "0.375rem" }}>
              Coding Interview Complete
            </h1>
            <p style={{ fontSize: "0.875rem", color: "rgba(110,231,183,0.45)", marginBottom: "1.75rem" }}>
              {report.role} · <span style={{ color: DIFF_COLOR[report.difficulty] }}>{report.difficulty}</span>
              {" · "}{LANG_LABELS[report.primary_language] ?? report.primary_language}
            </p>

            {/* Score rings row */}
            <div style={{ display: "flex", justifyContent: "center", gap: "2.5rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                <ScoreRing score={report.overall_score} size={88} />
                <span style={{ fontSize: "0.72rem", color: "rgba(110,231,183,0.4)",
                  textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Overall Score
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                <div style={{
                  width: 88, height: 88, borderRadius: "50%",
                  border: "6px solid rgba(16,185,129,0.1)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  background: "rgba(16,185,129,0.05)",
                }}>
                  <span style={{ fontSize: "1.5rem", fontWeight: 800,
                    color: passRate >= 80 ? "#34D399" : passRate >= 50 ? "#FCD34D" : "#F87171" }}>
                    {passRate}%
                  </span>
                  <span style={{ fontSize: "0.5rem", color: "rgba(110,231,183,0.4)", marginTop: 1 }}>pass rate</span>
                </div>
                <span style={{ fontSize: "0.72rem", color: "rgba(110,231,183,0.4)",
                  textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Test Cases
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                <div style={{
                  width: 88, height: 88, borderRadius: "50%",
                  border: "6px solid rgba(16,185,129,0.1)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  background: "rgba(16,185,129,0.05)",
                }}>
                  <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#A7F3D0" }}>
                    {report.submitted_problems}/{report.total_problems}
                  </span>
                  <span style={{ fontSize: "0.5rem", color: "rgba(110,231,183,0.4)", marginTop: 1 }}>solved</span>
                </div>
                <span style={{ fontSize: "0.72rem", color: "rgba(110,231,183,0.4)",
                  textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Problems
                </span>
              </div>
            </div>

            {/* Completion date */}
            {report.completed_at && (
              <p style={{ marginTop: "1.25rem", fontSize: "0.75rem", color: "rgba(110,231,183,0.3)" }}>
                Completed on {new Date(report.completed_at).toLocaleDateString("en-US", {
                  weekday: "long", year: "numeric", month: "long", day: "numeric",
                })}
              </p>
            )}
          </div>

          {/* Problem breakdown */}
          <h2 style={{
            fontSize: "0.85rem", fontWeight: 700, color: "rgba(110,231,183,0.6)",
            textTransform: "uppercase", letterSpacing: "0.12em",
            marginBottom: "0.875rem",
          }}>
            Problem Breakdown
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2rem" }}>
            {report.problems
              .slice()
              .sort((a: any, b: any) => a.order_index - b.order_index)
              .map((problem: any, i: number) => (
                <ProblemCard key={problem.problem_id} problem={problem} index={i} />
              ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => router.push("/dashboard")}
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                padding: "0.7rem 1.5rem", borderRadius: "0.7rem",
                background: "linear-gradient(135deg,#10B981,#14B8A6)",
                border: "none", color: "#fff", fontWeight: 700,
                fontSize: "0.875rem", cursor: "pointer",
                boxShadow: "0 4px 16px rgba(16,185,129,0.3)",
              }}>
              <RotateCcw style={{ width: 15, height: 15 }} />
              Practice Again
            </button>
            <button onClick={() => router.push("/dashboard")}
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                padding: "0.7rem 1.5rem", borderRadius: "0.7rem",
                background: "rgba(5,30,27,0.7)",
                border: "1px solid rgba(16,185,129,0.2)",
                color: "#6EE7B7", fontWeight: 700,
                fontSize: "0.875rem", cursor: "pointer",
              }}>
              <ArrowLeft style={{ width: 15, height: 15 }} />
              Dashboard
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}