import { CheckCircle2, AlertCircle, MessageSquare } from "lucide-react";
import ScoreBadge from "./ScoreBadge";
import type { Answer } from "@/lib/api";

interface FeedbackCardProps {
  answer: Answer;
  questionText: string;
}

export default function FeedbackCard({ answer, questionText }: FeedbackCardProps) {
  return (
    <div className="card space-y-5">
      {/* Question recap */}
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
          Question
        </p>
        <p className="text-slate-200 font-medium">{questionText}</p>
      </div>

      {/* Scores row */}
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col items-center">
          <ScoreBadge score={answer.content_score} label="Content" />
        </div>
        {answer.eye_contact_score !== null && (
          <div className="flex flex-col items-center">
            <ScoreBadge
              score={answer.eye_contact_score * 10}
              label="Eye Contact"
            />
          </div>
        )}
        {answer.posture_score !== null && (
          <div className="flex flex-col items-center">
            <ScoreBadge
              score={answer.posture_score * 10}
              label="Posture"
            />
          </div>
        )}
      </div>

      {/* Feedback text */}
      {answer.feedback && (
        <div className="flex gap-3">
          <MessageSquare className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-slate-300 leading-relaxed">{answer.feedback}</p>
        </div>
      )}

      {/* Transcript */}
      {answer.transcript && (
        <details className="group">
          <summary className="text-sm text-slate-500 hover:text-slate-300 cursor-pointer transition-colors list-none flex items-center gap-2">
            <span className="text-xs border border-slate-700 rounded px-2 py-0.5">
              View transcript
            </span>
          </summary>
          <p className="mt-3 text-sm text-slate-400 bg-slate-800/50 rounded-lg p-4 leading-relaxed italic">
            &ldquo;{answer.transcript}&rdquo;
          </p>
        </details>
      )}
    </div>
  );
}