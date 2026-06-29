"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Play, Send, ChevronRight, ChevronLeft, Loader2,
  CheckCircle2, XCircle, Clock, Code2, Terminal,
  MessageSquarePlus, RotateCcw, Trophy, AlertCircle,
  Zap, TrendingUp, Eye,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import CodeEditor from "@/components/CodeEditor";
import BackgroundEffect from "@/components/BackgroundEffect";
import { codingAPI, type CodingSession, type CodingProblem, type SubmissionResponse } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

type Tab = "problem" | "editor" | "output";
type OutputMode = "idle" | "running" | "run_done" | "submitting" | "submit_done";

const LANG_LABELS: Record<string, string> = {
  python: "Python", javascript: "JavaScript", java: "Java", cpp: "C++",
};
const DIFF_COLOR: Record<string, string> = {
  easy: "#34D399", medium: "#FCD34D", hard: "#F87171",
};

function ElapsedTimer() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem",
      color: "rgba(110,231,183,0.5)", fontSize: "0.8rem" }}>
      <Clock style={{ width: 13, height: 13 }} />
      {m}:{s}
    </div>
  );
}

export default function CodingPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = Number(params.sessionId);

  const [session, setSession] = useState<CodingSession | null>(null);
  const [problemIdx, setProblemIdx] = useState(0);
  const [language, setLanguage] = useState<"python" | "javascript" | "java" | "cpp">("python");
  const [code, setCode] = useState("");
  const [tab, setTab] = useState<Tab>("problem");
  const [outputMode, setOutputMode] = useState<OutputMode>("idle");
  const [runResults, setRunResults] = useState<any[]>([]);
  const [submission, setSubmission] = useState<SubmissionResponse | null>(null);
  const [followups, setFollowups] = useState<any[]>([]);
  const [followupAnswers, setFollowupAnswers] = useState<Record<number, string>>({});
  const [generatingFollowup, setGeneratingFollowup] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    codingAPI.getSession(sessionId)
      .then(s => {
        setSession(s);
        const lang = s.primary_language as "python" | "javascript" | "java" | "cpp";
        setLanguage(lang);
        const prob = s.problems[0];
        if (prob) setCode(prob.starter_code?.[lang] ?? "");
      })
      .catch(() => router.replace("/dashboard"))
      .finally(() => setLoading(false));
  }, [sessionId, router]);

  const problem: CodingProblem | undefined = session?.problems[problemIdx];

  // Reset code when switching problems or language
  const handleLanguageChange = (lang: "python" | "javascript" | "java" | "cpp") => {
    setLanguage(lang);
    if (problem) setCode(problem.starter_code?.[lang] ?? "");
    setSubmission(null);
    setRunResults([]);
    setFollowups([]);
    setOutputMode("idle");
    setError("");
  };

  const handleProblemChange = (idx: number) => {
    setProblemIdx(idx);
    const prob = session?.problems[idx];
    if (prob) setCode(prob.starter_code?.[language] ?? "");
    setSubmission(null);
    setRunResults([]);
    setFollowups([]);
    setOutputMode("idle");
    setError("");
    setTab("problem");
  };

  const handleRun = async () => {
    if (!problem || !session) return;
    setError("");
    setOutputMode("running");
    setTab("output");
    try {
      const result = await codingAPI.runCode(session.id, {
        problem_id: problem.id,
        code,
        language,
      });
      setRunResults(result.test_results);
      setOutputMode("run_done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Run failed");
      setOutputMode("idle");
    }
  };

  const handleSubmit = async () => {
    if (!problem || !session) return;
    setError("");
    setOutputMode("submitting");
    setTab("output");
    try {
      const sub = await codingAPI.submitSolution(session.id, {
        problem_id: problem.id,
        code,
        language,
      });
      setSubmission(sub);
      setRunResults(sub.test_results ?? []);
      setOutputMode("submit_done");
      // Refresh session to update scores
      const updated = await codingAPI.getSession(sessionId);
      setSession(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setOutputMode("idle");
    }
  };

  const handleGenerateFollowup = async () => {
    if (!submission || !session) return;
    setGeneratingFollowup(true);
    try {
      const fq = await codingAPI.generateFollowup(session.id, { submission_id: submission.id });
      setFollowups(prev => [...prev, fq]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not generate follow-up");
    } finally {
      setGeneratingFollowup(false);
    }
  };

  const handleFollowupAnswer = async (followupId: number) => {
    if (!session) return;
    const answer = followupAnswers[followupId];
    if (!answer?.trim()) return;
    try {
      await codingAPI.submitFollowupAnswer(session.id, {
        followup_id: followupId,
        answer,
      });
      setFollowups(prev => prev.map(f => f.id === followupId ? { ...f, user_answer: answer } : f));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save answer");
    }
  };

  if (loading || !session) {
    return (
      <div style={{ minHeight: "100vh", background: "#041B1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <BackgroundEffect />
        <Loader2 style={{ width: 32, height: 32, color: "#10B981", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (!problem) {
    return (
      <div style={{ minHeight: "100vh", background: "#041B1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(110,231,183,0.5)" }}>No problems found in this session.</p>
      </div>
    );
  }

  const totalProblems = session.problems.length;
  const isLastProblem = problemIdx === totalProblems - 1;
  const passedCount = submission?.test_cases_passed ?? 0;
  const totalCount = submission?.test_cases_total ?? 0;
  const allPassed = submission?.status === "accepted";

  return (
    <div style={{ minHeight: "100vh", background: "#041B1A", display: "flex", flexDirection: "column" }}>
      <BackgroundEffect />
      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", height: "100vh" }}>
        <Navbar />

        {/* ── Top bar ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0.5rem 1rem", gap: "1rem", flexShrink: 0,
          borderBottom: "1px solid rgba(16,185,129,0.1)",
          background: "rgba(4,20,18,0.9)", backdropFilter: "blur(12px)",
        }}>
          {/* Problem selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {session.problems.map((p, i) => (
              <button key={p.id} onClick={() => handleProblemChange(i)}
                style={{
                  padding: "0.25rem 0.75rem", borderRadius: "0.5rem",
                  fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${i === problemIdx ? "rgba(16,185,129,0.5)" : "rgba(16,185,129,0.12)"}`,
                  background: i === problemIdx ? "rgba(16,185,129,0.15)" : "transparent",
                  color: i === problemIdx ? "#34D399" : "rgba(110,231,183,0.4)",
                  transition: "all 0.2s",
                }}>
                {i + 1}
              </button>
            ))}
            <span style={{ fontSize: "0.8rem", color: "rgba(110,231,183,0.4)", marginLeft: "0.25rem" }}>
              {session.role} · <span style={{ color: DIFF_COLOR[session.difficulty] }}>{session.difficulty}</span>
            </span>
          </div>

          {/* Language + timer + actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <ElapsedTimer />

            <select value={language} onChange={e => handleLanguageChange(e.target.value as any)}
              style={{
                background: "rgba(4,20,18,0.9)", border: "1px solid rgba(16,185,129,0.2)",
                borderRadius: "0.5rem", color: "#A7F3D0", fontSize: "0.8rem",
                padding: "0.3rem 0.6rem", cursor: "pointer", outline: "none",
              }}>
              {(["python","javascript","java","cpp"] as const).map(l => (
                <option key={l} value={l}>{LANG_LABELS[l]}</option>
              ))}
            </select>

            <button onClick={handleRun}
              disabled={outputMode === "running" || outputMode === "submitting"}
              style={{
                display: "flex", alignItems: "center", gap: "0.375rem",
                padding: "0.375rem 0.875rem", borderRadius: "0.5rem",
                fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                background: "rgba(16,185,129,0.12)",
                border: "1px solid rgba(16,185,129,0.3)",
                color: "#34D399", transition: "all 0.2s",
                opacity: outputMode === "running" ? 0.6 : 1,
              }}>
              {outputMode === "running"
                ? <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} />
                : <Play style={{ width: 13, height: 13 }} />}
              Run
            </button>

            <button onClick={handleSubmit}
              disabled={outputMode === "running" || outputMode === "submitting" || !!submission}
              style={{
                display: "flex", alignItems: "center", gap: "0.375rem",
                padding: "0.375rem 0.875rem", borderRadius: "0.5rem",
                fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                background: submission
                  ? "rgba(16,185,129,0.05)"
                  : "linear-gradient(135deg,#10B981,#14B8A6)",
                border: `1px solid ${submission ? "rgba(16,185,129,0.15)" : "transparent"}`,
                color: submission ? "rgba(110,231,183,0.3)" : "#fff",
                boxShadow: submission ? "none" : "0 3px 12px rgba(16,185,129,0.3)",
                transition: "all 0.2s",
                opacity: outputMode === "submitting" ? 0.7 : 1,
              }}>
              {outputMode === "submitting"
                ? <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} />
                : <Send style={{ width: 13, height: 13 }} />}
              {submission ? "Submitted" : "Submit"}
            </button>

            {isLastProblem && submission && (
              <button onClick={() => router.push(`/coding/report/${session.id}`)}
                style={{
                  display: "flex", alignItems: "center", gap: "0.375rem",
                  padding: "0.375rem 0.875rem", borderRadius: "0.5rem",
                  fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                  background: "linear-gradient(135deg,#F59E0B,#EF4444)",
                  border: "none", color: "#fff",
                  boxShadow: "0 3px 12px rgba(245,158,11,0.3)",
                }}>
                <Trophy style={{ width: 13, height: 13 }} />
                View Report
              </button>
            )}
          </div>
        </div>

        {/* ── Mobile tabs ── */}
        <div className="lg:hidden" style={{
          display: "flex", borderBottom: "1px solid rgba(16,185,129,0.1)",
          background: "rgba(4,20,18,0.8)", flexShrink: 0,
        }}>
          {(["problem","editor","output"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                flex: 1, padding: "0.6rem",
                fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                background: "transparent", border: "none",
                borderBottom: `2px solid ${tab === t ? "#10B981" : "transparent"}`,
                color: tab === t ? "#34D399" : "rgba(110,231,183,0.4)",
                textTransform: "capitalize", transition: "all 0.2s",
              }}>
              {t}
            </button>
          ))}
        </div>

        {/* ── Main split layout ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

          {/* LEFT — Problem Panel */}
          <div className={tab === "problem" ? "flex" : "hidden lg:flex"}
            style={{
              width: "42%", flexDirection: "column", overflow: "hidden",
              borderRight: "1px solid rgba(16,185,129,0.08)",
              flexShrink: 0,
            }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem" }}>

              {/* Title + difficulty */}
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.5rem" }}>
                  <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>
                    {problem.title}
                  </h2>
                  <span style={{
                    fontSize: "0.65rem", fontWeight: 700, padding: "0.2rem 0.6rem",
                    borderRadius: "999px", textTransform: "uppercase", letterSpacing: "0.08em",
                    color: DIFF_COLOR[problem.difficulty],
                    background: `${DIFF_COLOR[problem.difficulty]}18`,
                    border: `1px solid ${DIFF_COLOR[problem.difficulty]}40`,
                  }}>
                    {problem.difficulty}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div style={{
                fontSize: "0.85rem", lineHeight: 1.75,
                color: "rgba(167,243,208,0.7)",
                marginBottom: "1.5rem",
                whiteSpace: "pre-wrap",
              }}>
                {problem.description}
              </div>

              {/* Examples */}
              {(problem.examples ?? []).length > 0 && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#10B981",
                    textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>
                    Examples
                  </p>
                  {(problem.examples as any[]).map((ex, i) => (
                    <div key={i} style={{
                      background: "rgba(4,14,12,0.8)", borderRadius: "0.625rem",
                      border: "1px solid rgba(16,185,129,0.1)",
                      padding: "0.875rem 1rem", marginBottom: "0.625rem",
                      fontFamily: "monospace", fontSize: "0.8rem",
                    }}>
                      <p style={{ color: "rgba(110,231,183,0.5)", marginBottom: "0.25rem" }}>
                        Input: <span style={{ color: "#A7F3D0" }}>{ex.input}</span>
                      </p>
                      <p style={{ color: "rgba(110,231,183,0.5)", marginBottom: ex.explanation ? "0.25rem" : 0 }}>
                        Output: <span style={{ color: "#A7F3D0" }}>{ex.output}</span>
                      </p>
                      {ex.explanation && (
                        <p style={{ color: "rgba(110,231,183,0.4)", marginTop: "0.375rem", fontFamily: "inherit", fontSize: "0.78rem" }}>
                          {ex.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Constraints */}
              {(problem.constraints ?? []).length > 0 && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#10B981",
                    textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>
                    Constraints
                  </p>
                  <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                    {(problem.constraints as string[]).map((c, i) => (
                      <li key={i} style={{
                        fontSize: "0.8rem", color: "rgba(167,243,208,0.6)",
                        fontFamily: "monospace", marginBottom: "0.25rem",
                      }}>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Sample test cases */}
              {(problem.sample_test_cases ?? []).length > 0 && (
                <div>
                  <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#10B981",
                    textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>
                    Sample Test Cases
                  </p>
                  {(problem.sample_test_cases as any[]).map((tc, i) => (
                    <div key={i} style={{
                      background: "rgba(4,14,12,0.8)", borderRadius: "0.5rem",
                      border: "1px solid rgba(16,185,129,0.1)",
                      padding: "0.75rem 1rem", marginBottom: "0.5rem",
                      fontFamily: "monospace", fontSize: "0.78rem",
                    }}>
                      <p style={{ color: "rgba(110,231,183,0.45)" }}>
                        Input: <span style={{ color: "#A7F3D0" }}>{tc.input}</span>
                      </p>
                      <p style={{ color: "rgba(110,231,183,0.45)" }}>
                        Expected: <span style={{ color: "#A7F3D0" }}>{tc.expected_output}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Hint */}
              {problem.solution_hint && (
                <details style={{ marginTop: "1.25rem" }}>
                  <summary style={{
                    fontSize: "0.78rem", color: "rgba(110,231,183,0.4)",
                    cursor: "pointer", listStyle: "none", userSelect: "none",
                  }}>
                    💡 Show hint
                  </summary>
                  <p style={{
                    marginTop: "0.5rem", fontSize: "0.8rem",
                    color: "rgba(167,243,208,0.55)", lineHeight: 1.6,
                    padding: "0.75rem", background: "rgba(16,185,129,0.05)",
                    borderRadius: "0.5rem", border: "1px solid rgba(16,185,129,0.1)",
                  }}>
                    {problem.solution_hint}
                  </p>
                </details>
              )}
            </div>
          </div>

          {/* RIGHT — Editor + Output */}
          <div className={tab !== "problem" ? "flex" : "hidden lg:flex"}
            style={{ flex: 1, flexDirection: "column", overflow: "hidden" }}>

            {/* Editor */}
            <div className={tab === "output" ? "hidden lg:block" : ""}
              style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              <CodeEditor
                value={code}
                onChange={setCode}
                language={language}
                height="100%"
              />
            </div>

            {/* Output panel */}
            <div style={{
              height: tab === "output" ? "100%" : "280px",
              flexShrink: 0,
              borderTop: "1px solid rgba(16,185,129,0.1)",
              background: "rgba(3,10,9,0.95)",
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                padding: "0.5rem 1rem",
                borderBottom: "1px solid rgba(16,185,129,0.08)",
                flexShrink: 0,
              }}>
                <Terminal style={{ width: 13, height: 13, color: "#10B981" }} />
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "rgba(110,231,183,0.6)" }}>
                  {outputMode === "submit_done" ? "Submission Results" : "Output"}
                </span>
                {submission && (
                  <span style={{
                    marginLeft: "auto", fontSize: "0.7rem", fontWeight: 700,
                    padding: "0.15rem 0.5rem", borderRadius: "999px",
                    color: allPassed ? "#34D399" : "#F87171",
                    background: allPassed ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                    border: `1px solid ${allPassed ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
                  }}>
                    {allPassed ? "✓ Accepted" : `${passedCount}/${totalCount} Passed`}
                  </span>
                )}
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "0.875rem 1rem" }}>

                {/* Loading state */}
                {(outputMode === "running" || outputMode === "submitting") && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", color: "rgba(110,231,183,0.5)" }}>
                    <Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} />
                    <span style={{ fontSize: "0.8rem" }}>
                      {outputMode === "running" ? "Running against sample test cases…" : "Submitting and evaluating…"}
                    </span>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: "0.5rem",
                    color: "#F87171", fontSize: "0.8rem",
                    padding: "0.625rem", background: "rgba(248,113,113,0.06)",
                    borderRadius: "0.5rem", border: "1px solid rgba(248,113,113,0.15)",
                  }}>
                    <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} /> {error}
                  </div>
                )}

                {/* Test case results */}
                {(outputMode === "run_done" || outputMode === "submit_done") && runResults.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {runResults.map((r, i) => (
                      <div key={i} style={{
                        borderRadius: "0.5rem", overflow: "hidden",
                        border: `1px solid ${r.passed ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`,
                      }}>
                        <div style={{
                          display: "flex", alignItems: "center", gap: "0.5rem",
                          padding: "0.4rem 0.75rem",
                          background: r.passed ? "rgba(52,211,153,0.06)" : "rgba(248,113,113,0.06)",
                        }}>
                          {r.passed
                            ? <CheckCircle2 style={{ width: 13, height: 13, color: "#34D399" }} />
                            : <XCircle style={{ width: 13, height: 13, color: "#F87171" }} />}
                          <span style={{
                            fontSize: "0.75rem", fontWeight: 600,
                            color: r.passed ? "#34D399" : "#F87171",
                          }}>
                            Test {i + 1} — {r.passed ? "Passed" : r.status.replace(/_/g, " ")}
                          </span>
                          {r.execution_time_ms > 0 && (
                            <span style={{ marginLeft: "auto", fontSize: "0.65rem", color: "rgba(110,231,183,0.35)" }}>
                              {r.execution_time_ms.toFixed(0)}ms
                            </span>
                          )}
                        </div>
                        {!r.passed && (
                          <div style={{
                            padding: "0.5rem 0.75rem", fontFamily: "monospace",
                            fontSize: "0.72rem", background: "rgba(3,10,9,0.8)",
                          }}>
                            {r.stdin && (
                              <p style={{ color: "rgba(110,231,183,0.4)", marginBottom: "0.2rem" }}>
                                Input: <span style={{ color: "#A7F3D0" }}>{r.stdin.slice(0, 100)}</span>
                              </p>
                            )}
                            <p style={{ color: "rgba(110,231,183,0.4)", marginBottom: "0.2rem" }}>
                              Expected: <span style={{ color: "#6EE7B7" }}>{r.expected.slice(0, 100)}</span>
                            </p>
                            <p style={{ color: "rgba(110,231,183,0.4)" }}>
                              Got: <span style={{ color: "#F87171" }}>{r.got.slice(0, 100) || "(empty)"}</span>
                            </p>
                            {r.stderr && (
                              <p style={{ color: "#F87171", marginTop: "0.25rem" }}>
                                {r.stderr.slice(0, 200)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* AI Feedback after submit */}
                {outputMode === "submit_done" && submission?.ai_feedback && (
                  <div style={{ marginTop: "1rem" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.875rem" }}>
                      {[
                        { label: "Quality", val: `${submission.code_quality_score?.toFixed(1)}/10`, icon: <Code2 style={{ width: 11, height: 11 }} /> },
                        { label: "Score", val: `${submission.overall_score?.toFixed(1)}/10`, icon: <Zap style={{ width: 11, height: 11 }} /> },
                        { label: "Time", val: (submission.ai_feedback as any).time_complexity, icon: <TrendingUp style={{ width: 11, height: 11 }} /> },
                        { label: "Space", val: (submission.ai_feedback as any).space_complexity, icon: <Eye style={{ width: 11, height: 11 }} /> },
                      ].map(stat => (
                        <div key={stat.label} style={{
                          display: "flex", alignItems: "center", gap: "0.3rem",
                          padding: "0.3rem 0.625rem", borderRadius: "0.4rem",
                          background: "rgba(16,185,129,0.07)",
                          border: "1px solid rgba(16,185,129,0.15)",
                          fontSize: "0.72rem", color: "#A7F3D0",
                        }}>
                          {stat.icon} <span style={{ color: "rgba(110,231,183,0.5)" }}>{stat.label}:</span> {stat.val}
                        </div>
                      ))}
                    </div>

                    <p style={{ fontSize: "0.8rem", color: "rgba(167,243,208,0.65)", lineHeight: 1.65, marginBottom: "0.75rem" }}>
                      {(submission.ai_feedback as any).feedback}
                    </p>

                    {/* Strengths */}
                    {(submission.ai_feedback as any).strengths?.length > 0 && (
                      <div style={{ marginBottom: "0.5rem" }}>
                        {(submission.ai_feedback as any).strengths.map((s: string, i: number) => (
                          <div key={i} style={{ display: "flex", gap: "0.375rem", marginBottom: "0.25rem" }}>
                            <CheckCircle2 style={{ width: 12, height: 12, color: "#34D399", flexShrink: 0, marginTop: 2 }} />
                            <span style={{ fontSize: "0.75rem", color: "rgba(52,211,153,0.75)" }}>{s}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Weaknesses */}
                    {(submission.ai_feedback as any).weaknesses?.length > 0 && (
                      <div style={{ marginBottom: "0.5rem" }}>
                        {(submission.ai_feedback as any).weaknesses.map((w: string, i: number) => (
                          <div key={i} style={{ display: "flex", gap: "0.375rem", marginBottom: "0.25rem" }}>
                            <XCircle style={{ width: 12, height: 12, color: "#F87171", flexShrink: 0, marginTop: 2 }} />
                            <span style={{ fontSize: "0.75rem", color: "rgba(248,113,113,0.75)" }}>{w}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Aira Follow-ups */}
                {outputMode === "submit_done" && (
                  <div style={{ marginTop: "1rem", borderTop: "1px solid rgba(16,185,129,0.08)", paddingTop: "0.875rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                      <span style={{ fontSize: "1rem" }}>🤖</span>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#34D399" }}>Aira Follow-up Questions</span>
                    </div>

                    {followups.map((fq) => (
                      <div key={fq.id} style={{
                        marginBottom: "0.875rem", padding: "0.75rem",
                        background: "rgba(16,185,129,0.04)",
                        border: "1px solid rgba(16,185,129,0.1)", borderRadius: "0.5rem",
                      }}>
                        <p style={{ fontSize: "0.8rem", color: "#A7F3D0", marginBottom: "0.5rem", lineHeight: 1.6 }}>
                          {fq.question}
                        </p>
                        {fq.user_answer ? (
                          <p style={{ fontSize: "0.75rem", color: "rgba(110,231,183,0.5)", fontStyle: "italic" }}>
                            ✓ {fq.user_answer}
                          </p>
                        ) : (
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <input
                              value={followupAnswers[fq.id] ?? ""}
                              onChange={e => setFollowupAnswers(prev => ({ ...prev, [fq.id]: e.target.value }))}
                              onKeyDown={e => e.key === "Enter" && handleFollowupAnswer(fq.id)}
                              placeholder="Type your answer and press Enter…"
                              style={{
                                flex: 1, padding: "0.4rem 0.625rem",
                                background: "rgba(4,14,12,0.8)",
                                border: "1px solid rgba(16,185,129,0.2)",
                                borderRadius: "0.4rem", color: "#ECFDF5",
                                fontSize: "0.78rem", outline: "none",
                              }}
                            />
                            <button onClick={() => handleFollowupAnswer(fq.id)}
                              style={{
                                padding: "0.4rem 0.625rem", borderRadius: "0.4rem",
                                background: "rgba(16,185,129,0.15)",
                                border: "1px solid rgba(16,185,129,0.25)",
                                color: "#34D399", cursor: "pointer", fontSize: "0.75rem",
                              }}>
                              Save
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {followups.length < 3 && (
                      <button onClick={handleGenerateFollowup}
                        disabled={generatingFollowup}
                        style={{
                          display: "flex", alignItems: "center", gap: "0.4rem",
                          padding: "0.4rem 0.875rem", borderRadius: "0.5rem",
                          fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                          background: "rgba(16,185,129,0.08)",
                          border: "1px solid rgba(16,185,129,0.2)",
                          color: "#34D399", transition: "all 0.2s",
                          opacity: generatingFollowup ? 0.6 : 1,
                        }}>
                        {generatingFollowup
                          ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />
                          : <MessageSquarePlus style={{ width: 12, height: 12 }} />}
                        {followups.length === 0 ? "Ask Aira a follow-up" : "Ask another follow-up"}
                      </button>
                    )}
                  </div>
                )}

                {/* Idle state */}
                {outputMode === "idle" && !error && (
                  <p style={{ fontSize: "0.8rem", color: "rgba(110,231,183,0.25)", fontStyle: "italic" }}>
                    Click Run to test your solution against sample cases, or Submit to evaluate.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}