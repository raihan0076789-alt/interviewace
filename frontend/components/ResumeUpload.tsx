"use client";

import { useState, useRef } from "react";
import {
  Upload, FileText, Loader2, CheckCircle2,
  Briefcase, GraduationCap, FolderOpen, Cpu, User,
  ChevronDown, ChevronUp, PlayCircle,
} from "lucide-react";
import { resumeAPI, type ExtractedResumeInfo } from "@/lib/api";

const ROLES = [
  "SDE-1 Backend", "SDE-1 Frontend", "Full Stack Developer",
  "Data Analyst", "DevOps Engineer", "Python Developer",
  "AI/ML Engineer", "Other",
];

interface ResumeUploadProps {
  onStart: (data: {
    resumeText: string;
    questions: string[];
    role: string;
    extractedInfo: ExtractedResumeInfo;
  }) => void;
  loading?: boolean;
}

type UploadState = "idle" | "uploading" | "done";

export default function ResumeUpload({ onStart, loading }: ResumeUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [role, setRole] = useState(ROLES[0]);
  const [questionCount, setQuestionCount] = useState(7);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    resumeText: string;
    extractedInfo: ExtractedResumeInfo;
    questions: string[];
  } | null>(null);
  const [showQuestions, setShowQuestions] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (f.type !== "application/pdf" && !f.name.endsWith(".pdf")) {
      setError("Please upload a PDF file.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("File must be under 5 MB.");
      return;
    }
    setFile(f);
    setError("");
    setResult(null);
    setUploadState("idle");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setUploadState("uploading");
    setError("");
    try {
      const data = await resumeAPI.analyze(file, role, questionCount);
      setResult({
        resumeText: data.resume_text,
        extractedInfo: data.extracted_info,
        questions: data.questions,
      });
      setUploadState("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
      setUploadState("idle");
    }
  };

  const handleStart = () => {
    if (!result) return;
    onStart({
      resumeText: result.resumeText,
      questions: result.questions,
      role,
      extractedInfo: result.extractedInfo,
    });
  };

  const info = result?.extractedInfo;

  return (
    <div className="space-y-5">

      {/* ── Step 1: Role + Count ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="r-role">Target role</label>
          <select id="r-role" value={role} onChange={(e) => setRole(e.target.value)}
            disabled={uploadState === "uploading"}>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="r-count">Questions ({questionCount})</label>
          <input id="r-count" type="range" min={3} max={10} value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            disabled={uploadState === "uploading"}
            className="w-full accent-indigo-500 bg-transparent border-none p-0 focus:ring-0 mt-2" />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>3</span><span>10</span>
          </div>
        </div>
      </div>

      {/* ── Step 2: File drop zone ── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => uploadState !== "uploading" && fileRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-all duration-200 ${
            dragOver
              ? "border-indigo-500 bg-indigo-950/30"
              : file
              ? "border-green-700 bg-green-950/20"
              : "border-slate-700 hover:border-slate-500 bg-slate-800/30"
          } ${uploadState === "uploading" ? "pointer-events-none opacity-60" : ""}`}
      >
        <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

        {file ? (
          <div className="flex flex-col items-center gap-2">
            <FileText className="w-10 h-10 text-green-400" />
            <p className="font-medium text-green-300">{file.name}</p>
            <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB — click to change</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <Upload className="w-10 h-10" />
            <p className="font-medium text-slate-300">Drop your resume PDF here</p>
            <p className="text-xs">or click to browse — max 5 MB</p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {/* ── Analyze button ── */}
      {file && uploadState !== "done" && (
        <button onClick={handleAnalyze} disabled={uploadState === "uploading"}
          className="btn-primary w-full">
          {uploadState === "uploading" ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Analysing resume…</>
          ) : (
            <><FileText className="w-4 h-4" /> Analyse Resume &amp; Generate Questions</>
          )}
        </button>
      )}

      {/* ── Results ── */}
      {uploadState === "done" && result && info && (
        <div className="space-y-4 animate-in fade-in duration-300">

          {/* Candidate summary */}
          <div className="card bg-indigo-950/30 border-indigo-900">
            <div className="flex items-center gap-3 mb-2">
              <User className="w-5 h-5 text-indigo-400 shrink-0" />
              <p className="font-semibold text-white">
                {info.name || "Candidate Profile"}
              </p>
              <CheckCircle2 className="w-4 h-4 text-green-400 ml-auto" />
            </div>
            {info.summary && (
              <p className="text-sm text-slate-300 leading-relaxed">{info.summary}</p>
            )}
          </div>

          {/* Skills chips */}
          {(info.skills.length > 0 || info.technologies.length > 0) && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Cpu className="w-4 h-4 text-indigo-400" />
                <p className="text-sm font-semibold text-slate-200">Skills &amp; Technologies</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[...info.skills, ...info.technologies]
                  .filter((v, i, a) => a.indexOf(v) === i) // deduplicate
                  .slice(0, 20)
                  .map((s) => (
                    <span key={s}
                      className="px-2.5 py-1 bg-indigo-950/60 border border-indigo-800 text-indigo-300 text-xs rounded-full">
                      {s}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Projects */}
          {info.projects.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <FolderOpen className="w-4 h-4 text-amber-400" />
                <p className="text-sm font-semibold text-slate-200">Projects Detected</p>
              </div>
              <div className="space-y-2">
                {info.projects.slice(0, 4).map((p, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-amber-500 mt-0.5 shrink-0">▸</span>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{p.name}</p>
                      {p.description && (
                        <p className="text-xs text-slate-400">{p.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Experience + Education side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {info.experience.length > 0 && (
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <Briefcase className="w-4 h-4 text-green-400" />
                  <p className="text-sm font-semibold text-slate-200">Experience</p>
                </div>
                <div className="space-y-2">
                  {info.experience.slice(0, 3).map((e, i) => (
                    <div key={i}>
                      <p className="text-sm font-medium text-slate-200">{e.role}</p>
                      <p className="text-xs text-slate-400">{e.company} · {e.duration}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {info.education.length > 0 && (
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <GraduationCap className="w-4 h-4 text-blue-400" />
                  <p className="text-sm font-semibold text-slate-200">Education</p>
                </div>
                <div className="space-y-2">
                  {info.education.slice(0, 3).map((e, i) => (
                    <div key={i}>
                      <p className="text-sm font-medium text-slate-200">{e.degree}</p>
                      <p className="text-xs text-slate-400">{e.institution}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Questions preview (collapsible) */}
          <div className="card">
            <button onClick={() => setShowQuestions((v) => !v)}
              className="w-full flex items-center justify-between text-left">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <p className="text-sm font-semibold text-slate-200">
                  {result.questions.length} Personalised Questions Generated
                </p>
              </div>
              {showQuestions
                ? <ChevronUp className="w-4 h-4 text-slate-500" />
                : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>

            {showQuestions && (
              <ol className="mt-4 space-y-3 list-none">
                {result.questions.map((q, i) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-300">
                    <span className="text-indigo-400 font-mono font-semibold shrink-0 mt-0.5">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {q}
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Start button */}
          <button onClick={handleStart} disabled={loading}
            className="btn-primary w-full text-base py-4">
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Creating session…</>
            ) : (
              <><PlayCircle className="w-5 h-5" /> Start Resume Interview</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}