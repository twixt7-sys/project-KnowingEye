/**
 * Knowing Eye - typed API client for the Django REST backend.
 *
 * Features
 * --------
 *  • JWT login + auto-refresh of the access token on 401.
 *  • Strongly-typed request helpers per feature (auth, exams, sessions,
 *    monitoring, behavior, reports, profile).
 *  • WebSocket helper that injects the access token via query string.
 */

import { API_BASE_URL } from "./env";
import { extractApiErrorMessage } from "./extract-api-error";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Role = "ADMIN" | "EXAMINEE";

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
}

export interface ProfileUser extends AuthUser {
  avatar_url: string | null;
  phone: string;
  institution: string;
  student_id: string;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Exam {
  id: number;
  title: string;
  description: string;
  instructions?: string;
  exam_code?: string | null;
  duration_minutes: number;
  total_questions: number;
  passing_score: number;
  status: "draft" | "active" | "archived";
  available_from?: string | null;
  available_until?: string | null;
  max_attempts?: number;
  is_open?: boolean;
  created_at: string;
  updated_at?: string;
  questions?: Question[];
  publish_readiness?: PublishReadiness;
}

export interface PublishReadiness {
  ready: boolean;
  issues: string[];
  warnings: string[];
  question_count: number;
  total_points: number;
}

export interface QuestionAttachment {
  id: number;
  kind: "image" | "pdf" | "audio";
  url: string;
  caption: string;
  order: number;
  created_at?: string;
}

export interface Question {
  id: number;
  exam: number;
  question_text: string;
  question_type: "multiple_choice" | "true_false" | "short_answer" | "essay";
  options: string[];
  correct_answer?: string;
  points: number;
  order: number;
  attachments?: QuestionAttachment[];
}

export interface ExamSession {
  id: string;
  user: number;
  exam: Exam;
  status: "setup" | "in_progress" | "completed" | "terminated" | "expired";
  started_at?: string;
  exam_started_at?: string | null;
  submitted_at?: string;
  total_score?: number;
  percentage_score?: number;
  passed?: boolean;
  time_remaining_seconds?: number;
}

export interface ResponseData {
  question_id: number;
  answer_text: string;
  time_spent: number;
}

export interface SubmitSessionData {
  responses: ResponseData[];
  time_remaining: number;
}

export interface FrameMetrics {
  face_presence_pct: number;
  gaze_focus_pct: number;
  posture_compliance_pct: number;
  identity_match_pct: number | null;
  object_clear_pct: number;
  overall_compliance_pct: number;
  alert_threshold_pct: number;
  flagged_metrics: string[];
  all_compliant: boolean;
}

export interface FrameAnalysisFace {
  count: number;
  head_yaw_deg?: number | null;
  head_pitch_deg?: number | null;
  bbox?: number[] | null;
  bbox_norm?: number[] | null;
  identity_distance?: number | null;
}

export interface FrameAnalysisPosture {
  detected: boolean;
  shoulder_tilt_ratio?: number | null;
  spine_lean_ratio?: number | null;
  guide_status?: "ok" | "no_pose" | "off_center";
  posture_compliance_pct?: number;
}

export interface FrameAnalysisObject {
  label: string;
  confidence_pct: number;
  bbox?: number[];
  bbox_norm?: number[];
}

export interface FrameAnalysis {
  session_id: string | null;
  timestamp: string | null;
  frame_index: number | null;
  frame_size?: [number, number] | null;
  face?: FrameAnalysisFace;
  posture?: FrameAnalysisPosture;
  objects?: FrameAnalysisObject[];
  metrics: FrameMetrics;
  overall_compliance_pct: number;
  behavior_score: number;
  events: FrameEvent[];
  alerts: FrameAlert[];
  pipeline_mode?: string;
}

export interface FrameEvent {
  event_type: string;
  score_pct: number;
  confidence_pct: number;
  metadata?: Record<string, unknown>;
}

export interface FrameAlert {
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
  metric_pct?: number;
  resolved?: boolean;
}

export interface BehaviorLogRow {
  id: string;
  session: string;
  session_user?: string;
  exam_title?: string;
  event_type: string;
  score: number;
  confidence: number;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface AlertRow {
  id: string;
  session: string;
  session_user?: string;
  exam_title?: string;
  alert_type: string;
  severity: "low" | "medium" | "high";
  message: string;
  metric_pct: number | null;
  resolved: boolean;
  created_at: string;
}

export interface ReportSummary {
  total_sessions: number;
  active_sessions: number;
  completed_sessions: number;
  terminated_sessions: number;
  unresolved_alerts: number;
  resolved_alerts: number;
  behavior_events: number;
  average_score: number | null;
  pass_rate: number | null;
  alerts_by_severity: { severity: string; count: number }[];
  events_by_type: { event_type: string; count: number }[];
  generated_at: string;
}

export interface SessionReportRow {
  id: string;
  exam_id: number;
  exam_title: string;
  user: string;
  user_full_name: string;
  status: string;
  started_at: string;
  submitted_at: string | null;
  percentage_score: number | null;
  passed: boolean | null;
  alert_count: number;
  unresolved_alert_count: number;
  behavior_event_count: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface UserStats {
  total: number;
  admins: number;
  examinees: number;
  inactive: number;
}

type QueryParamValue = string | number | boolean | undefined | null;

function toQuery(params?: Record<string, QueryParamValue>): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------

const TOKEN_KEY = "auth_token";
const REFRESH_KEY = "refresh_token";

export const tokenStore = {
  get access() {
    return localStorage.getItem(TOKEN_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh?: string) {
    localStorage.setItem(TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

// ---------------------------------------------------------------------------
// HTTP client with refresh
// ---------------------------------------------------------------------------

class ApiClient {
  constructor(public baseURL: string) {}

  private async refresh(): Promise<boolean> {
    const refresh = tokenStore.refresh;
    if (!refresh) return false;
    const res = await fetch(`${this.baseURL}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) {
      tokenStore.clear();
      return false;
    }
    const data = await res.json();
    tokenStore.set(data.access, data.refresh ?? refresh);
    return true;
  }

  async request<T>(endpoint: string, options: RequestInit = {}, retry = true): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    };
    if (!(options.body instanceof FormData) && options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    if (tokenStore.access) {
      headers.Authorization = `Bearer ${tokenStore.access}`;
    }

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401 && retry && tokenStore.refresh) {
      const ok = await this.refresh();
      if (ok) return this.request<T>(endpoint, options, false);
    }

    if (!res.ok) {
      const raw = await res.text();
      let body: unknown = raw;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        /* keep plain-text/HTML error body */
      }
      throw new ApiError(res.status, body);
    }

    const raw = await res.text();
    if (!raw) {
      return undefined as T;
    }
    const ctype = res.headers.get("content-type") ?? "";
    if (ctype.includes("application/json")) {
      return JSON.parse(raw) as T;
    }
    return raw as unknown as T;
  }

  // ----- Auth -----
  async login(credentials: { username: string; password: string }) {
    const data = await this.request<{
      access: string;
      refresh: string;
      user: AuthUser;
    }>("/auth/token/", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    tokenStore.set(data.access, data.refresh);
    return data;
  }

  async register(userData: {
    username: string;
    email: string;
    password: string;
    password2: string;
    first_name?: string;
    last_name?: string;
    role?: Role;
  }) {
    return this.request<{ message: string; user: AuthUser }>("/auth/register/", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async getProfile() {
    return this.request<ProfileUser>("/auth/profile/me/");
  }

  async updateProfile(patch: Partial<ProfileUser>) {
    return this.request<{ message: string; user: ProfileUser }>(
      "/auth/profile/update_profile/",
      {
        method: "PATCH",
        body: JSON.stringify(patch),
      }
    );
  }

  async changePassword(body: {
    old_password: string;
    new_password: string;
    new_password2: string;
  }) {
    return this.request<{ message: string }>("/auth/profile/change-password/", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async uploadAvatar(file: File) {
    const form = new FormData();
    form.append("avatar", file);
    return this.request<ProfileUser>("/auth/profile/avatar/", {
      method: "POST",
      body: form,
    });
  }

  // ----- Admin user management -----
  async listUsers(params?: {
    role?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }) {
    return this.request<PaginatedResponse<ProfileUser>>(
      `/auth/users/${toQuery(params)}`
    );
  }

  async getUserStats() {
    return this.request<UserStats>("/auth/users/stats/");
  }

  async activateUser(id: number) {
    return this.request<ProfileUser>(`/auth/users/${id}/activate/`, {
      method: "POST",
    });
  }

  async deactivateUser(id: number) {
    return this.request<ProfileUser>(`/auth/users/${id}/deactivate/`, {
      method: "POST",
    });
  }

  async setUserRole(id: number, role: string) {
    return this.request<ProfileUser>(`/auth/users/${id}/set-role/`, {
      method: "POST",
      body: JSON.stringify({ role }),
    });
  }

  // ----- Exams -----
  async getExams(params?: { status?: string; search?: string }) {
    const qs = params
      ? "?" + new URLSearchParams(params as Record<string, string>).toString()
      : "";
    const data = await this.request<{ results?: Exam[]; count?: number } | Exam[]>(
      `/exams/${qs}`
    );
    return Array.isArray(data) ? data : data.results ?? [];
  }

  async getExam(id: number) {
    return this.request<Exam>(`/exams/${id}/`);
  }

  async createExam(payload: Partial<Exam>) {
    return this.request<Exam>("/exams/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateExam(id: number, payload: Partial<Exam>) {
    return this.request<Exam>(`/exams/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async deleteExam(id: number) {
    return this.request<void>(`/exams/${id}/`, { method: "DELETE" });
  }

  async publishExam(id: number) {
    return this.request<{ message: string; exam: Exam }>(`/exams/${id}/publish/`, {
      method: "POST",
    });
  }

  async archiveExam(id: number) {
    return this.request<{ message: string }>(`/exams/${id}/archive/`, {
      method: "POST",
    });
  }

  async listQuestions(examId: number) {
    return this.request<Question[]>(`/exams/${examId}/questions/`);
  }

  async createQuestion(examId: number, payload: Partial<Question>) {
    return this.request<Question>(`/exams/${examId}/questions/`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateQuestion(examId: number, questionId: number, payload: Partial<Question>) {
    return this.request<Question>(`/exams/${examId}/questions/${questionId}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async deleteQuestion(examId: number, questionId: number) {
    return this.request<void>(`/exams/${examId}/questions/${questionId}/`, {
      method: "DELETE",
    });
  }

  async getExamReadiness(examId: number) {
    return this.request<PublishReadiness>(`/exams/${examId}/readiness/`);
  }

  async importQuestions(examId: number, csv: string) {
    return this.request<{ imported: number; questions: Question[] }>(
      `/exams/${examId}/questions/import/`,
      { method: "POST", body: JSON.stringify({ csv }) }
    );
  }

  async reorderQuestions(examId: number, questionIds: number[]) {
    return this.request<Question[]>(`/exams/${examId}/questions/reorder/`, {
      method: "POST",
      body: JSON.stringify({ question_ids: questionIds }),
    });
  }

  async uploadQuestionAttachment(examId: number, questionId: number, file: File, caption?: string) {
    const form = new FormData();
    form.append("file", file);
    if (caption) form.append("caption", caption);
    return this.request<QuestionAttachment>(
      `/exams/${examId}/questions/${questionId}/attachments/`,
      { method: "POST", body: form }
    );
  }

  async deleteQuestionAttachment(examId: number, questionId: number, attachmentId: number) {
    return this.request<void>(
      `/exams/${examId}/questions/${questionId}/attachments/${attachmentId}/`,
      { method: "DELETE" }
    );
  }

  // ----- Sessions -----
  async startExamSession(examId: number) {
    const res = await this.request<{ session: ExamSession }>("/sessions/start/", {
      method: "POST",
      body: JSON.stringify({ exam: examId }),
    });
    return res.session;
  }

  async beginExamSession(sessionId: string) {
    const res = await this.request<{ session: ExamSession }>(
      `/sessions/${sessionId}/begin/`,
      { method: "POST" }
    );
    return res.session;
  }

  async submitExamSession(sessionId: string, data: SubmitSessionData) {
    return this.request<{ session: ExamSession; results: Record<string, unknown> }>(
      `/sessions/${sessionId}/submit/`,
      { method: "POST", body: JSON.stringify(data) }
    );
  }

  async getSession(sessionId: string) {
    return this.request<ExamSession>(`/sessions/${sessionId}/`);
  }

  async listSessions(params?: { status?: string; exam?: number; user?: number }) {
    const qs = params
      ? "?" + new URLSearchParams(params as Record<string, string>).toString()
      : "";
    const data = await this.request<{ results?: ExamSession[] } | ExamSession[]>(
      `/sessions/${qs}`
    );
    return Array.isArray(data) ? data : data.results ?? [];
  }

  async terminateSession(sessionId: string) {
    return this.request<{ message: string }>(`/sessions/${sessionId}/terminate/`, {
      method: "POST",
    });
  }

  // ----- Monitoring -----
  async sendFrame(body: { image: string; session_id: string }) {
    return this.request<{
      status: string;
      session_id: string;
      pipeline_mode: string;
      analysis: FrameAnalysis;
      persisted: { behavior_logs: number; alerts: number };
    }>("/monitoring/frame/", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async enrollReference(body: { image: string; session_id: string }) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90_000);
    try {
      return await this.request<{ ok: boolean; message?: string; pipeline_mode: string }>(
        "/monitoring/enroll/",
        {
          method: "POST",
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async getMonitoringHealth() {
    return this.request<{ status: string; pipeline_mode: string; service: string }>(
      "/monitoring/health/"
    );
  }

  // ----- Behavior -----
  async listBehaviorLogs(params?: { session?: string; event_type?: string }) {
    const qs = params
      ? "?" + new URLSearchParams(params as Record<string, string>).toString()
      : "";
    const data = await this.request<{ results?: BehaviorLogRow[] } | BehaviorLogRow[]>(
      `/behavior/logs/${qs}`
    );
    return Array.isArray(data) ? data : data.results ?? [];
  }

  async listAlerts(params?: { session?: string; resolved?: boolean; severity?: string }) {
    const qs = params
      ? "?" + new URLSearchParams(params as Record<string, string>).toString()
      : "";
    const data = await this.request<{ results?: AlertRow[] } | AlertRow[]>(
      `/behavior/alerts/${qs}`
    );
    return Array.isArray(data) ? data : data.results ?? [];
  }

  async resolveAlert(alertId: string) {
    return this.request<AlertRow>(`/behavior/alerts/${alertId}/resolve/`, {
      method: "POST",
    });
  }

  // ----- Reports -----
  async getReportSummary() {
    return this.request<ReportSummary>("/reports/summary/");
  }

  async listSessionReports(params?: {
    status?: string;
    exam?: number;
    search?: string;
    page?: number;
    page_size?: number;
  }) {
    return this.request<PaginatedResponse<SessionReportRow>>(
      `/reports/sessions/${toQuery(params)}`
    );
  }

  async getSessionReport(sessionId: string) {
    return this.request<{
      session: ExamSession;
      behavior_summary: { event_type: string; count: number; avg_score: number }[];
      behavior_logs: BehaviorLogRow[];
      alerts: AlertRow[];
    }>(`/reports/sessions/${sessionId}/`);
  }

  async getTimeseries() {
    return this.request<{
      sessions: { day: string; count: number }[];
      alerts: { day: string; count: number }[];
      behaviors: { day: string; count: number }[];
    }>("/reports/timeseries/");
  }

  private async downloadExport(
    path: string,
    accept: string,
    filename: string
  ): Promise<void> {
    const url = `${this.baseURL}${path}`;
    const headers: Record<string, string> = { Accept: accept };
    if (tokenStore.access) {
      headers.Authorization = `Bearer ${tokenStore.access}`;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const raw = await res.text();
      let body: unknown = raw;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        /* keep plain-text error body */
      }
      throw new ApiError(res.status, body);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }

  async downloadSessionsCSV(): Promise<void> {
    return this.downloadExport(
      "/reports/export/csv/",
      "text/csv",
      "knowing-eye-sessions.csv"
    );
  }

  async downloadSessionsPDF(): Promise<void> {
    return this.downloadExport(
      "/reports/export/pdf/",
      "application/pdf",
      "knowing-eye-sessions.pdf"
    );
  }
}

export class ApiError extends Error {
  constructor(public status: number, public payload: unknown) {
    super(`API ${status}`);
  }
  detail(): string {
    return extractApiErrorMessage(this.payload);
  }
}

export function formatApiError(err: unknown): string {
  if (err instanceof ApiError) return err.detail();
  if (err instanceof Error) return err.message;
  return "Request failed";
}

export const apiClient = new ApiClient(API_BASE_URL);

// ---------------------------------------------------------------------------
// WebSocket helper
// ---------------------------------------------------------------------------

export function buildMonitoringWsUrl(sessionId: string): string {
  const base = API_BASE_URL.replace(/^http/, "ws").replace(/\/api\/?$/, "");
  const token = tokenStore.access;
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${base}/ws/monitoring/${sessionId}/${q}`;
}

export function buildSessionObserverWsUrl(sessionId: string): string {
  const base = API_BASE_URL.replace(/^http/, "ws").replace(/\/api\/?$/, "");
  const token = tokenStore.access;
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${base}/ws/monitoring/observe/${sessionId}/${q}`;
}

export function buildAdminAlertsWsUrl(): string {
  const base = API_BASE_URL.replace(/^http/, "ws").replace(/\/api\/?$/, "");
  const token = tokenStore.access;
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${base}/ws/monitoring/alerts/${q}`;
}

// ---------------------------------------------------------------------------
// Legacy compatibility (old `examAPI` namespace expected by some pages)
// ---------------------------------------------------------------------------

export const examAPI = {
  startSession: (examId: number) => apiClient.startExamSession(examId),
  submitSession: (sessionId: string, responses: ResponseData[], timeRemaining: number) =>
    apiClient.submitExamSession(sessionId, {
      responses,
      time_remaining: timeRemaining,
    }),
  getSession: (sessionId: string) => apiClient.getSession(sessionId),
  sendMonitoringFrame: async (image: string, sessionId: string) => {
    try {
      return await apiClient.sendFrame({ image, session_id: sessionId });
    } catch (e) {
      console.warn("monitoring frame send failed", e);
    }
  },
};
