import { getAccessToken, clearTokens } from "./auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    clearTokens();
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  email: string;
  target_role: string | null;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Question {
  id: number;
  question_text: string;
  order_index: number;
  is_followup: boolean;
}

export interface Session {
  id: number;
  role: string;
  difficulty: string;
  started_at: string;
  overall_score: number | null;
  is_resume_based: boolean;
  questions: Question[];
}

export interface Answer {
  id: number;
  question_id: number;
  transcript: string | null;
  eye_contact_score: number | null;
  posture_score: number | null;
  content_score: number | null;
  feedback: string | null;
  audio_duration_seconds: number | null;
}

export interface AnswerDetail {
  question_id: number;
  question_text: string;
  order_index: number;
  transcript: string | null;
  eye_contact_score: number | null;
  posture_score: number | null;
  content_score: number | null;
  overall_score: number | null;
  feedback: string | null;
  audio_duration_seconds: number | null;
}

export interface SessionReport {
  session_id: number;
  role: string;
  difficulty: string;
  started_at: string;
  completed_at: string | null;
  overall_score: number | null;
  total_questions: number;
  answered_questions: number;
  evaluated_questions: number;
  answers: AnswerDetail[];
}

// Resume feature types
export interface ExtractedResumeInfo {
  name: string;
  skills: string[];
  technologies: string[];
  projects: { name: string; description: string }[];
  experience: { role: string; company: string; duration: string }[];
  education: { degree: string; institution: string }[];
  summary: string;
}

export interface ResumeAnalysisResponse {
  resume_text: string;
  extracted_info: ExtractedResumeInfo;
  questions: string[];
}

// ── Auth ────────────────────────────────────────────────────────────────────

export const authAPI = {
  register: (email: string, password: string, targetRole?: string) =>
    request<User>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, target_role: targetRole }),
    }),
  login: (email: string, password: string) =>
    request<TokenPair>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>("/api/auth/me"),
};

// ── Sessions ────────────────────────────────────────────────────────────────

export const sessionsAPI = {
  create: (
    role: string,
    difficulty: string,
    questionCount: number,
    options?: { resumeText?: string; customQuestions?: string[] }
  ) =>
    request<Session>("/api/sessions/", {
      method: "POST",
      body: JSON.stringify({
        role,
        difficulty,
        question_count: questionCount,
        resume_text: options?.resumeText ?? null,
        custom_questions: options?.customQuestions ?? null,
      }),
    }),
  list: () => request<Session[]>("/api/sessions/"),
  get:  (id: number) => request<Session>(`/api/sessions/${id}`),
  clearAll: () =>
    request<void>("/api/sessions/", { method: "DELETE" }),
};

// ── Answers ─────────────────────────────────────────────────────────────────

export const answersAPI = {
  submit: (
    sessionId: number,
    questionId: number,
    audioBlob: Blob,
    eyeContactScore: number | null,
    postureScore: number | null,
    durationSeconds: number
  ) => {
    const form = new FormData();
    form.append("audio", audioBlob, "recording.webm");
    if (eyeContactScore !== null)
      form.append("eye_contact_score", eyeContactScore.toString());
    if (postureScore !== null)
      form.append("posture_score", postureScore.toString());
    form.append("audio_duration_seconds", durationSeconds.toString());
    return request<Answer>(
      `/api/sessions/${sessionId}/answers/${questionId}`,
      { method: "POST", body: form }
    );
  },

  evaluate: (sessionId: number, questionId: number) =>
    request<Answer>(
      `/api/sessions/${sessionId}/answers/${questionId}/evaluate`,
      { method: "POST" }
    ),

  generateFollowup: (sessionId: number, questionId: number) =>
    request<Question>(
      `/api/sessions/${sessionId}/answers/${questionId}/followup`,
      { method: "POST" }
    ),
};

// ── Report ───────────────────────────────────────────────────────────────────

export const reportAPI = {
  get: (sessionId: number) =>
    request<SessionReport>(`/api/sessions/${sessionId}/report`),
};

// ── Resume ───────────────────────────────────────────────────────────────────

export const resumeAPI = {
  analyze: (file: File, role: string, questionCount: number) => {
    const form = new FormData();
    form.append("file", file);
    return request<ResumeAnalysisResponse>(
      `/api/resume/analyze?role=${encodeURIComponent(role)}&question_count=${questionCount}`,
      { method: "POST", body: form }
    );
  },
};

// ── Coding feature types ────────────────────────────────────────────────────

export interface CodingProblem {
  id: number;
  session_id: number;
  title: string;
  difficulty: string;
  description: string;
  solution_hint: string | null;
  order_index: number;
  examples: unknown[];
  constraints: unknown[];
  starter_code: Record<string, string>;
  sample_test_cases: { input: string; expected_output: string; is_sample: boolean }[];
  submissions: SubmissionResponse[];
}

export interface CodingSession {
  id: number;
  role: string;
  difficulty: string;
  primary_language: string;
  started_at: string;
  completed_at: string | null;
  overall_score: number | null;
  problems: CodingProblem[];
}

export interface SubmissionResponse {
  id: number;
  problem_id: number;
  language: string;
  status: string;
  test_cases_passed: number;
  test_cases_total: number;
  execution_time_ms: number | null;
  code_quality_score: number | null;
  overall_score: number | null;
  ai_feedback: Record<string, unknown> | null;
  submitted_at: string;
  test_results?: TestCaseResult[];
}

export interface TestCaseResult {
  passed: boolean;
  stdin: string;
  expected: string;
  got: string;
  status: string;
  execution_time_ms: number;
  stderr: string;
}

export interface CodingFollowup {
  id: number;
  submission_id: number;
  question: string;
  user_answer: string | null;
  order_index: number;
  created_at: string;
}

// ── Coding API ───────────────────────────────────────────────────────────────

export const codingAPI = {
  createSession: (role: string, difficulty: string, language: string, problemCount: number) =>
    request<CodingSession>("/api/coding/sessions/", {
      method: "POST",
      body: JSON.stringify({ role, difficulty, language, problem_count: problemCount }),
    }),

  listSessions: () => request<CodingSession[]>("/api/coding/sessions/"),

  clearSessions: () => request<void>("/api/coding/sessions/", { method: "DELETE" }),

  getSession: (sessionId: number) =>
    request<CodingSession>(`/api/coding/sessions/${sessionId}`),

  runCode: (
    sessionId: number,
    payload: { problem_id: number; code: string; language: string }
  ) =>
    request<{ test_results: TestCaseResult[]; total_passed: number; total_ran: number; language: string }>(
      `/api/coding/sessions/${sessionId}/run`,
      { method: "POST", body: JSON.stringify(payload) }
    ),

  submitSolution: (
    sessionId: number,
    payload: { problem_id: number; code: string; language: string }
  ) =>
    request<SubmissionResponse>(
      `/api/coding/sessions/${sessionId}/submit`,
      { method: "POST", body: JSON.stringify(payload) }
    ),

  generateFollowup: (sessionId: number, payload: { submission_id: number }) =>
    request<CodingFollowup>(
      `/api/coding/sessions/${sessionId}/followup`,
      { method: "POST", body: JSON.stringify(payload) }
    ),

  submitFollowupAnswer: (
    sessionId: number,
    payload: { followup_id: number; answer: string }
  ) =>
    request<CodingFollowup>(
      `/api/coding/sessions/${sessionId}/followup/answer`,
      { method: "POST", body: JSON.stringify(payload) }
    ),

  getReport: (sessionId: number) =>
    request<unknown>(`/api/coding/sessions/${sessionId}/report`),
};