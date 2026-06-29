"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Trophy, RefreshCw, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import Navbar from "@/components/Navbar";
import ScoreBadge from "@/components/ScoreBadge";
import { reportAPI, type SessionReport, type AnswerDetail } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

function QuestionRow({ answer, index }: { answer: AnswerDetail; index: number }) {
  const [open, setOpen] = useState(index === 0);

  return (
    <div className="card space-y-0 p-0 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <span className="text-slate-500 text-sm font-mono w-6">Q{index + 1}</span>
          <span className="font-medium text-white line-clamp-1">{answer.question_text}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <ScoreBadge score={answer.overall_score} size="sm" />
          {open ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </button>

      {open && (
        <div className="px-6 pb-6 pt-2 border-t border-slate-800 space-y-4">
          {/* Score row */}
          <div className="flex flex-wrap gap-4 pt-2">
            {answer.content_score !== null && (
              <div className="text-center">
                <ScoreBadge score={answer.content_score} label="Content" />
              </div>
            )}
            {answer.eye_contact_score !== null && (
              <div className="text-center">
                <ScoreBadge score={answer.eye_contact_score * 10} label="Eye Contact" />
              </div>
            )}
            {answer.posture_score !== null && (
              <div className="text-center">
                <ScoreBadge score={answer.posture_score * 10} label="Posture" />
              </div>
            )}
            {answer.audio_duration_seconds !== null && (
              <div className="flex flex-col items-center border border-slate-700 rounded-xl px-4 py-3 bg-slate-800">
                <span className="text-2xl font-bold text-slate-300">
                  {Math.round(answer.audio_duration_seconds)}s
                </span>
                <span className="text-xs text-slate-500 mt-0.5">Duration</span>
              </div>
            )}
          </div>

          {/* Feedback */}
          {answer.feedback && (
            <p className="text-slate-300 leading-relaxed">{answer.feedback}</p>
          )}

          {/* Transcript */}
          {answer.transcript && (
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Transcript</p>
              <p className="text-sm text-slate-400 italic leading-relaxed">
                &ldquo;{answer.transcript}&rdquo;
              </p>
            </div>
          )}

          {/* Not yet answered */}
          {!answer.transcript && answer.content_score === null && (
            <p className="text-slate-500 text-sm italic">This question was not answered.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReportPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = Number(params.sessionId);

  const [report, setReport] = useState<SessionReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    reportAPI.get(sessionId)
      .then(setReport)
      .catch(() => router.replace("/dashboard"))
      .finally(() => setLoading(false));
  }, [sessionId, router]);

  if (loading || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const sortedAnswers = [...report.answers].sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-8">

        {/* Header card */}
        <div className="card text-center py-10">
          <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-1">Session Complete</h1>
          <p className="text-slate-400">
            {report.role} · {report.difficulty.charAt(0).toUpperCase() + report.difficulty.slice(1)}
          </p>

          <div className="flex flex-wrap justify-center gap-8 mt-8">
            <div>
              <ScoreBadge score={report.overall_score} size="lg" label="Overall Score" />
            </div>
            <div className="flex flex-col items-center justify-center gap-1">
              <span className="text-4xl font-bold text-slate-200">
                {report.evaluated_questions}/{report.total_questions}
              </span>
              <span className="text-xs text-slate-500">Evaluated</span>
            </div>
            {report.completed_at && (
              <div className="flex flex-col items-center justify-center gap-1">
                <span className="text-slate-300 font-semibold">
                  {new Date(report.completed_at).toLocaleDateString()}
                </span>
                <span className="text-xs text-slate-500">Completed</span>
              </div>
            )}
          </div>
        </div>

        {/* Per-question breakdown */}
        <div>
          <h2 className="text-lg font-semibold mb-4 text-slate-200">
            Question Breakdown
          </h2>
          <div className="space-y-3">
            {sortedAnswers.map((answer, i) => (
              <QuestionRow key={answer.question_id} answer={answer} index={i} />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 justify-center pb-8">
          <button
            onClick={() => router.push("/dashboard")}
            className="btn-primary"
          >
            <RefreshCw className="w-4 h-4" />
            Practice Again
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="btn-secondary"
          >
            Back to Dashboard
          </button>
        </div>
      </main>
    </div>
  );
}