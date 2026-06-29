"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Mic, MicOff, ChevronRight, Loader2, AlertCircle,
  Eye, User2, Volume2, VolumeX, RotateCcw, PlayCircle,
  MessageSquarePlus, FileText,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import FeedbackCard from "@/components/FeedbackCard";
import { sessionsAPI, answersAPI, type Session, type Answer, type Question } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { startTracking, stopTracking, loadModels } from "@/lib/faceTracking";
import { speak, stopSpeaking } from "@/lib/tts";

type Phase = "intro" | "intro_done" | "speaking" | "ready" | "recording" | "processing" | "feedback";

const WAVE_HEIGHTS = [6, 14, 10, 20, 8, 16, 6, 12, 18, 8];
const INTRO_MIN_MS = 5000;

function buildIntroScript(role: string, count: number, isResumeBased: boolean): string {
  const type = isResumeBased
    ? "a personalised session based on your resume"
    : `a ${role} interview`;
  return (
    `Hi, I'm Aira, your AI interview coach. ` +
    `Today's session is ${type}, with ${count} questions. ` +
    `A few quick rules before we start. ` +
    `Look directly at the camera — not the screen — so I can track your eye contact. ` +
    `Keep your head steady and sit upright for posture scoring. ` +
    `Take a moment to think before you speak, and aim for one to three minutes per answer. ` +
    (isResumeBased
      ? `I have studied your resume and will ask about your specific projects and experience. `
      : "") +
    `Whenever you are ready, click the button below and I will begin. ` +
    `Good luck.`
  );
}

export default function PracticePage() {
  const router    = useRouter();
  const params    = useParams();
  const sessionId = Number(params.sessionId);

  const [session, setSession]                   = useState<Session | null>(null);
  const [questionIndex, setQuestionIndex]       = useState(0);
  const [phase, setPhase]                       = useState<Phase>("intro");
  const [showIntro, setShowIntro]               = useState(false);
  const [introText, setIntroText]               = useState("");
  const [currentAnswer, setCurrentAnswer]       = useState<Answer | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [cvEnabled, setCvEnabled]               = useState(false);
  const [webcamReady, setWebcamReady]           = useState(false);
  const [error, setError]                       = useState("");
  const [muted, setMuted]                       = useState(false);
  const [generatingFollowup, setGeneratingFollowup] = useState(false);
  const [followupDoneSet, setFollowupDoneSet]   = useState<Set<number>>(new Set());

  const videoRef          = useRef<HTMLVideoElement>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const audioChunksRef    = useRef<Blob[]>([]);
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartRef = useRef<number>(0);
  const skipHandlerRef    = useRef<(() => void) | null>(null);

  // ── Load session ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    sessionsAPI.get(sessionId)
      .then(setSession)
      .catch(() => router.replace("/dashboard"));
  }, [sessionId, router]);

  // ── Webcam + face-api ─────────────────────────────────────────────────────

  const setupWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setWebcamReady(true);
      const loaded = await loadModels();
      setCvEnabled(loaded);
    } catch { setWebcamReady(false); }
  }, []);

  useEffect(() => {
    setupWebcam();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      stopSpeaking();
    };
  }, [setupWebcam]);

  // ── Aira intro ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!session) return;
    const script = buildIntroScript(session.role, session.questions.length, session.is_resume_based);
    setIntroText(script);
    setShowIntro(true);
    setPhase("intro");

    let speechDone = false, timerDone = false, skipRequested = false;

    const afterIntro = () => {
      if (skipRequested || !speechDone || !timerDone) return;
      setShowIntro(false);
      setPhase("intro_done");
    };

    const minTimer  = setTimeout(() => { timerDone = true; afterIntro(); }, INTRO_MIN_MS);
    const speakTimer = setTimeout(() => {
      if (muted) { speechDone = true; afterIntro(); return; }
      speak(script, undefined, () => { speechDone = true; afterIntro(); });
    }, 600);

    skipHandlerRef.current = () => {
      skipRequested = true;
      stopSpeaking();
      clearTimeout(minTimer);
      clearTimeout(speakTimer);
      setShowIntro(false);
      setPhase("intro_done");
    };

    return () => { clearTimeout(minTimer); clearTimeout(speakTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const handleUserReady = () => {
    if (!session) return;
    setPhase("speaking");
    speak(session.questions[0].question_text, undefined, () => setPhase("ready"));
  };

  const replayQuestion = () => {
    if (!session) return;
    setPhase("speaking");
    speak(session.questions[questionIndex].question_text, undefined, () => setPhase("ready"));
  };

  const toggleMute = () => {
    stopSpeaking();
    setMuted((prev) => { if (!prev) setPhase("ready"); return !prev; });
  };

  // ── Follow-up question ────────────────────────────────────────────────────

  const handleFollowup = async () => {
    if (!session) return;
    setGeneratingFollowup(true);
    setError("");
    const question = session.questions[questionIndex];
    try {
      const newQ: Question = await answersAPI.generateFollowup(session.id, question.id);

      // Mark this question as having generated a follow-up (prevent duplicates)
      setFollowupDoneSet((prev) => new Set([...prev, question.id]));

      // Insert follow-up right after current question in local state
      const updated: Question[] = [
        ...session.questions.slice(0, questionIndex + 1),
        newQ,
        ...session.questions.slice(questionIndex + 1),
      ];
      setSession({ ...session, questions: updated });

      // Advance to the follow-up
      const nextIdx = questionIndex + 1;
      setQuestionIndex(nextIdx);
      setCurrentAnswer(null);
      setError("");
      setPhase("speaking");
      speak(
        `Follow-up question: ${newQ.question_text}`,
        undefined,
        () => setPhase("ready")
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not generate follow-up.");
    } finally {
      setGeneratingFollowup(false);
    }
  };

  // ── Recording ─────────────────────────────────────────────────────────────

  const startRecording = async () => {
    if (!streamRef.current) return;
    setError("");
    audioChunksRef.current = [];
    const audioStream = new MediaStream(streamRef.current.getAudioTracks());
    const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
    const recorder = new MediaRecorder(audioStream, mimeType ? { mimeType } : {});
    recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
    recorder.onstop = handleRecordingStop;
    mediaRecorderRef.current = recorder;
    recorder.start(250);
    recordingStartRef.current = Date.now();
    if (cvEnabled && videoRef.current) await startTracking(videoRef.current);
    setRecordingSeconds(0);
    timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    setPhase("recording");
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setPhase("processing");
  };

  const handleRecordingStop = async () => {
    const cvScores = cvEnabled ? stopTracking() : null;
    const duration = (Date.now() - recordingStartRef.current) / 1000;
    const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
    const question = session!.questions[questionIndex];
    try {
      await answersAPI.submit(
        session!.id, question.id, audioBlob,
        cvScores?.eyeContactScore ?? null,
        cvScores?.postureScore    ?? null,
        duration
      );
      const evaluated = await answersAPI.evaluate(session!.id, question.id);
      setCurrentAnswer(evaluated);
      setPhase("feedback");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setPhase("ready");
    }
  };

  const goToNext = () => {
    if (!session) return;
    stopSpeaking();
    const next = questionIndex + 1;
    if (next >= session.questions.length) {
      router.push(`/report/${session.id}`);
    } else {
      setQuestionIndex(next);
      setCurrentAnswer(null);
      setError("");
      setPhase("speaking");
      setTimeout(() => {
        speak(session.questions[next].question_text, undefined, () => setPhase("ready"));
      }, 300);
    }
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // ── Render ────────────────────────────────────────────────────────────────

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const question   = session.questions[questionIndex];
  const isLast     = questionIndex === session.questions.length - 1;
  const isTalking  = phase === "intro" || phase === "speaking";
  const canFollowup = phase === "feedback"
    && currentAnswer?.transcript
    && !followupDoneSet.has(question.id);

  const airaStatus: Record<Phase, string> = {
    intro:      "👋 Introducing the session…",
    intro_done: "✅ Ready when you are!",
    speaking:   "🎙️ Reading your question…",
    ready:      "✋ Your turn to answer",
    recording:  "🎙️ Recording your answer…",
    processing: "⚙️ Evaluating your answer…",
    feedback:   "✅ Here's your feedback",
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Progress */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm text-slate-400">{session.role} · {session.difficulty}</p>
              {session.is_resume_based && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Resume
                </span>
              )}
            </div>
            <p className="font-semibold text-white mt-0.5">
              {phase === "intro" || phase === "intro_done"
                ? "Session Introduction"
                : `Question ${questionIndex + 1} of ${session.questions.length}`}
            </p>
          </div>
          <div className="flex gap-1.5">
            {session.questions.map((q, i) => (
              <div key={i} className={`h-1.5 w-6 rounded-full transition-colors ${
                q.is_followup ? "bg-amber-600" :
                i < questionIndex   ? "bg-green-500"  :
                i === questionIndex ? "bg-indigo-500" : "bg-slate-700"
              }`} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Left: Webcam + Controls ── */}
          <div className="lg:col-span-2 space-y-3">
            <div className="relative aspect-[4/3] bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
              {webcamReady ? (
                <video ref={videoRef} autoPlay muted playsInline
                  className="w-full h-full object-cover scale-x-[-1]" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-600">
                  <User2 className="w-12 h-12" />
                  <p className="text-sm">Camera unavailable</p>
                </div>
              )}
              {phase === "recording" && (
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  {formatTime(recordingSeconds)}
                </div>
              )}
              {cvEnabled && webcamReady && (
                <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-slate-900/80 text-green-400 text-xs px-2 py-1 rounded-full border border-green-900">
                  <Eye className="w-3 h-3" /> CV Active
                </div>
              )}
            </div>

            {error && (
              <div className="flex gap-2 px-3 py-2 bg-red-950 border border-red-800 rounded-lg text-red-300 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* ── Controls ── */}
            {phase === "intro" && (
              <button onClick={() => skipHandlerRef.current?.()} className="btn-secondary w-full">
                <VolumeX className="w-4 h-4" /> Skip Introduction
              </button>
            )}
            {phase === "intro_done" && (
              <button onClick={handleUserReady} className="btn-primary w-full text-base py-4 animate-pulse">
                <PlayCircle className="w-5 h-5" /> I&apos;m Ready — Let&apos;s Start!
              </button>
            )}
            {phase === "speaking" && (
              <button onClick={() => { stopSpeaking(); setPhase("ready"); }} className="btn-secondary w-full">
                <VolumeX className="w-4 h-4" /> Skip — I&apos;m ready
              </button>
            )}
            {phase === "ready" && (
              <button onClick={startRecording} className="btn-primary w-full">
                <Mic className="w-4 h-4" /> Start Recording
              </button>
            )}
            {phase === "recording" && (
              <button onClick={stopRecording}
                className="btn-secondary w-full border-red-800 text-red-400 hover:bg-red-950">
                <MicOff className="w-4 h-4" /> Stop Recording
              </button>
            )}
            {phase === "processing" && (
              <button disabled className="btn-primary w-full opacity-75">
                <Loader2 className="w-4 h-4 animate-spin" /> Analysing answer…
              </button>
            )}
            {phase === "feedback" && (
              <div className="space-y-2">
                {/* Follow-up button */}
                {canFollowup && (
                  <button onClick={handleFollowup} disabled={generatingFollowup}
                    className="btn-secondary w-full border-amber-800 text-amber-400 hover:bg-amber-950">
                    {generatingFollowup
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                      : <><MessageSquarePlus className="w-4 h-4" /> Ask Follow-up</>}
                  </button>
                )}
                <button onClick={goToNext} className="btn-primary w-full">
                  {isLast ? "View Full Report" : "Next Question"}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* ── Right: Aira + Content ── */}
          <div className="lg:col-span-3 space-y-4">

            {/* Aira card */}
            <div className="card flex items-center gap-5 py-5">
              <div className="relative shrink-0">
                {isTalking && (
                  <>
                    <div className="absolute inset-[-10px] rounded-full border border-indigo-500/30 animate-ping" />
                    <div className="absolute inset-[-5px] rounded-full border border-indigo-500/40 animate-pulse" />
                  </>
                )}
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl
                  transition-all duration-300 ${
                    phase === "intro_done" ? "bg-green-700 shadow-lg shadow-green-500/20" :
                    isTalking ? "bg-indigo-600 shadow-lg shadow-indigo-500/30" : "bg-slate-800"
                  }`}>
                  🤖
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">Aira</p>
                <p className="text-xs text-indigo-300 mb-1">AI Interview Coach</p>
                {isTalking ? (
                  <div className="flex items-end gap-0.5 mt-2 h-5">
                    {WAVE_HEIGHTS.map((h, i) => (
                      <div key={i} className="w-1 bg-indigo-400 rounded-full animate-bounce"
                        style={{ height: `${h}px`, animationDelay: `${i * 80}ms` }} />
                    ))}
                    <span className="text-xs text-indigo-300 ml-2 self-center">Speaking…</span>
                  </div>
                ) : (
                  <p className={`text-xs mt-1 ${phase === "intro_done" ? "text-green-400" : "text-slate-400"}`}>
                    {airaStatus[phase]}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-center gap-2 shrink-0">
                <button onClick={toggleMute} title={muted ? "Unmute Aira" : "Mute Aira"}
                  className="text-slate-500 hover:text-slate-300 transition-colors">
                  {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                {!isTalking && phase !== "recording" && phase !== "processing" && phase !== "intro_done" && (
                  <button onClick={replayQuestion} title="Replay question"
                    className="text-slate-500 hover:text-indigo-400 transition-colors">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Intro bubble */}
            {showIntro && introText && (
              <div className="card border-indigo-800 bg-indigo-950/50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">👋</span>
                  <p className="text-sm font-semibold text-indigo-300">Aira&apos;s Introduction</p>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">{introText}</p>
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full"
                      style={{ animation: `progress ${INTRO_MIN_MS}ms linear forwards` }} />
                  </div>
                  <span className="text-xs text-slate-500">auto-continuing…</span>
                </div>
              </div>
            )}

            {/* "I'm ready" card */}
            {phase === "intro_done" && (
              <div className="card border-green-900 bg-green-950/30 text-center py-8">
                <div className="text-4xl mb-3">🎯</div>
                <h3 className="text-lg font-semibold text-white mb-1">All set!</h3>
                <p className="text-slate-400 text-sm mb-6">
                  {session.is_resume_based
                    ? "Aira has studied your resume and is ready to ask about your specific projects and experience."
                    : "Aira will read your first question as soon as you click the button."}
                </p>
                <div className="flex flex-wrap justify-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Camera ready
                  </span>
                  {cvEnabled && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Eye tracking active
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Microphone ready
                  </span>
                </div>
              </div>
            )}

            {/* Follow-up badge */}
            {question?.is_followup && phase !== "intro" && phase !== "intro_done" && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-950/40 border border-amber-900 rounded-lg">
                <MessageSquarePlus className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-xs text-amber-300 font-medium">
                  Follow-up question — Aira wants to dig deeper on your previous answer
                </p>
              </div>
            )}

            {/* Question */}
            {!showIntro && phase !== "intro" && phase !== "intro_done" && (
              <div className="card">
                <p className="text-xs font-medium text-indigo-400 uppercase tracking-wider mb-3">
                  Your Question
                </p>
                <p className="text-xl font-medium text-white leading-relaxed">
                  {question.question_text}
                </p>
              </div>
            )}

            {/* Tips */}
            {(phase === "ready" || phase === "speaking") && (
              <div className="card bg-slate-800/50">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                  Tips from Aira
                </p>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li>✦ Structure your answer before speaking (take 10 seconds)</li>
                  <li>✦ Use the STAR format for behavioural questions</li>
                  <li>✦ Aim for 1–3 minutes per answer</li>
                  <li>✦ Look directly at the camera, not the screen</li>
                </ul>
              </div>
            )}

            {/* Processing */}
            {phase === "processing" && (
              <div className="card flex flex-col items-center py-10 gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="font-medium">Aira is evaluating your answer…</p>
                <p className="text-sm text-slate-500">Usually takes 5–10 seconds</p>
              </div>
            )}

            {/* Feedback */}
            {phase === "feedback" && currentAnswer && (
              <div className="space-y-3">
                <FeedbackCard answer={currentAnswer} questionText={question.question_text} />
                {canFollowup && (
                  <div className="flex items-start gap-2 px-3 py-2 bg-amber-950/20 border border-amber-900/50 rounded-lg">
                    <MessageSquarePlus className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-400/80">
                      Want Aira to dig deeper? Click <strong>Ask Follow-up</strong> and she&apos;ll
                      generate a personalised question based on what you just said.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <style jsx global>{`
        @keyframes progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </div>
  );
}