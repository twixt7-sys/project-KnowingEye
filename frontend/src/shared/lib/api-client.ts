import { API_BASE_URL } from "@/core/config/env";
import { ApiError } from "@/shared/lib/api-error";
import { toQuery } from "@/shared/lib/query-params";
import { tokenStore } from "@/shared/lib/token-store";
import type {
  AlertRow,
  AuthUser,
  BehaviorLogRow,
  Department,
  Exam,
  ExamSession,
  FrameAnalysis,
  ProfileUser,
  PublishReadiness,
  Question,
  QuestionAttachment,
  ReportSummary,
  ResponseData,
  Role,
  SessionDepartmentAnalytics,
  SessionReportRow,
  SubmitSessionData,
  UserStats,
} from "@/shared/types/api";
import type { PaginatedResponse } from "@/shared/types/api";

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
    first_name: string;
    last_name: string;
    avatar: File;
    role?: Role;
  }) {
    const form = new FormData();
    form.append("username", userData.username);
    form.append("email", userData.email);
    form.append("password", userData.password);
    form.append("password2", userData.password2);
    form.append("first_name", userData.first_name);
    form.append("last_name", userData.last_name);
    form.append("avatar", userData.avatar);
    if (userData.role) {
      form.append("role", userData.role);
    }
    return this.request<{ message: string; user: AuthUser }>("/auth/register/", {
      method: "POST",
      body: form,
    });
  }

  async getProfile() {
    return this.request<ProfileUser>("/auth/profile/me/");
  }

  async updateProfile(patch: Partial<ProfileUser>) {
    return this.request<{ message: string; user: ProfileUser }>(
      "/auth/profile/update_profile/",
      { method: "PATCH", body: JSON.stringify(patch) },
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

  async listUsers(params?: {
    role?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }) {
    return this.request<PaginatedResponse<ProfileUser>>(`/auth/users/${toQuery(params)}`);
  }

  async getUserStats() {
    return this.request<UserStats>("/auth/users/stats/");
  }

  async activateUser(id: number) {
    return this.request<ProfileUser>(`/auth/users/${id}/activate/`, { method: "POST" });
  }

  async deactivateUser(id: number) {
    return this.request<ProfileUser>(`/auth/users/${id}/deactivate/`, { method: "POST" });
  }

  async setUserRole(id: number, role: string) {
    return this.request<ProfileUser>(`/auth/users/${id}/set-role/`, {
      method: "POST",
      body: JSON.stringify({ role }),
    });
  }

  async listDepartments(params?: { active_only?: boolean }) {
    const qs = params?.active_only ? "?active_only=1" : "";
    const data = await this.request<{ results?: Department[]; count?: number } | Department[]>(
      `/departments/${qs}`,
    );
    return Array.isArray(data) ? data : (data.results ?? []);
  }

  async createDepartment(payload: Pick<Department, "name" | "abbreviation"> & Partial<Department>) {
    return this.request<Department>("/departments/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateDepartment(id: number, payload: Partial<Department>) {
    return this.request<Department>(`/departments/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async deleteDepartment(id: number) {
    return this.request<void>(`/departments/${id}/`, { method: "DELETE" });
  }

  async getExams(params?: { status?: string; search?: string }) {
    const qs = params
      ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
      : "";
    const data = await this.request<{ results?: Exam[]; count?: number } | Exam[]>(`/exams/${qs}`);
    return Array.isArray(data) ? data : (data.results ?? []);
  }

  async getMyExams() {
    return this.request<Exam[]>("/exams/mine/");
  }

  async duplicateExam(id: number) {
    return this.request<{ message: string; exam: Exam }>(`/exams/${id}/duplicate/`, {
      method: "POST",
    });
  }

  async getExamAnalytics(id: number) {
    return this.request<{
      exam_id: number;
      session_count: number;
      questions: {
        question_id: number;
        order: number;
        question_type: string;
        points: number;
        response_count: number;
        correct_count: number;
        correct_pct: number;
        avg_time_spent: number;
      }[];
    }>(`/exams/${id}/analytics/`);
  }

  async listExamAssignments(examId: number) {
    return this.request<
      {
        id: number;
        user: number;
        user_email: string;
        user_name: string;
        status: string;
        extra_time_minutes: number;
        attempts_override: number | null;
      }[]
    >(`/exams/${examId}/assignments/`);
  }

  async createExamAssignment(
    examId: number,
    payload: { user_id?: number; email?: string; extra_time_minutes?: number },
  ) {
    return this.request(`/exams/${examId}/assignments/`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async importExamAssignments(examId: number, csv: string) {
    return this.request<{ created: number; updated: number }>(
      `/exams/${examId}/assignments/import/`,
      { method: "POST", body: JSON.stringify({ csv }) },
    );
  }

  async listExamSections(examId: number) {
    return this.request<
      {
        id: number;
        title: string;
        instructions: string;
        order: number;
        questions_per_page: number;
      }[]
    >(`/exams/${examId}/sections/`);
  }

  async createExamSection(
    examId: number,
    payload: { title: string; instructions?: string; order?: number; questions_per_page?: number },
  ) {
    return this.request(`/exams/${examId}/sections/`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async listQuestionPools(examId: number) {
    return this.request<
      { id: number; name: string; draw_count: number; order: number; question_count: number }[]
    >(`/exams/${examId}/pools/`);
  }

  async createQuestionPool(
    examId: number,
    payload: { name: string; draw_count: number; order?: number },
  ) {
    return this.request(`/exams/${examId}/pools/`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getExam(id: number) {
    return this.request<Exam>(`/exams/${id}/`);
  }

  async createExam(payload: Partial<Exam>) {
    return this.request<Exam>("/exams/", { method: "POST", body: JSON.stringify(payload) });
  }

  async updateExam(id: number, payload: Partial<Exam>) {
    return this.request<Exam>(`/exams/${id}/`, { method: "PATCH", body: JSON.stringify(payload) });
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
    return this.request<{ message: string }>(`/exams/${id}/archive/`, { method: "POST" });
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
    return this.request<void>(`/exams/${examId}/questions/${questionId}/`, { method: "DELETE" });
  }

  async getExamReadiness(examId: number) {
    return this.request<PublishReadiness>(`/exams/${examId}/readiness/`);
  }

  async importQuestions(examId: number, csv: string) {
    return this.request<{ imported: number; questions: Question[] }>(
      `/exams/${examId}/questions/import/`,
      { method: "POST", body: JSON.stringify({ csv }) },
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
      { method: "POST", body: form },
    );
  }

  async deleteQuestionAttachment(examId: number, questionId: number, attachmentId: number) {
    return this.request<void>(
      `/exams/${examId}/questions/${questionId}/attachments/${attachmentId}/`,
      { method: "DELETE" },
    );
  }

  async startExamSession(examId: number) {
    const res = await this.request<{ session: ExamSession }>("/sessions/start/", {
      method: "POST",
      body: JSON.stringify({ exam: examId }),
    });
    return res.session;
  }

  async beginExamSession(sessionId: string) {
    const res = await this.request<{ session: ExamSession }>(`/sessions/${sessionId}/begin/`, {
      method: "POST",
    });
    return res.session;
  }

  async submitExamSession(sessionId: string, data: SubmitSessionData) {
    return this.request<{ session: ExamSession; results: Record<string, unknown> }>(
      `/sessions/${sessionId}/submit/`,
      { method: "POST", body: JSON.stringify(data) },
    );
  }

  async getSession(sessionId: string) {
    return this.request<ExamSession>(`/sessions/${sessionId}/`);
  }

  async saveSessionResponses(sessionId: string, responses: ResponseData[]) {
    return this.request<{ saved: number }>(`/sessions/${sessionId}/responses/`, {
      method: "PATCH",
      body: JSON.stringify({ responses }),
    });
  }

  async sessionHeartbeat(sessionId: string) {
    return this.request<{
      server_now: string;
      deadline_at: string | null;
      time_remaining_seconds: number;
      status: string;
    }>(`/sessions/${sessionId}/heartbeat/`, { method: "POST" });
  }

  async logSessionEvent(
    sessionId: string,
    event_type: "tab_hidden" | "tab_visible" | "fullscreen_exit",
    details?: Record<string, unknown>,
  ) {
    return this.request(`/sessions/${sessionId}/log-event/`, {
      method: "POST",
      body: JSON.stringify({ event_type, details }),
    });
  }

  async recalculateSession(sessionId: string) {
    return this.request<ExamSession>(`/sessions/${sessionId}/recalculate/`, { method: "POST" });
  }

  async gradeResponse(
    responseId: number,
    payload: {
      is_correct?: boolean;
      points_awarded?: number;
      grader_comment?: string;
      flagged_for_review?: boolean;
    },
  ) {
    return this.request(`/responses/${responseId}/grade/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async listSessions(params?: { status?: string; exam?: number; user?: number }) {
    const qs = params
      ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
      : "";
    const data = await this.request<{ results?: ExamSession[] } | ExamSession[]>(`/sessions/${qs}`);
    return Array.isArray(data) ? data : (data.results ?? []);
  }

  async terminateSession(sessionId: string) {
    return this.request<{ message: string }>(`/sessions/${sessionId}/terminate/`, {
      method: "POST",
    });
  }

  async sendFrame(body: { image: string; session_id: string }) {
    return this.request<{
      status: string;
      session_id: string;
      pipeline_mode: string;
      analysis: FrameAnalysis;
      persisted: { behavior_logs: number; alerts: number };
    }>("/monitoring/frame/", { method: "POST", body: JSON.stringify(body) });
  }

  async enrollReference(body: { image: string; session_id: string }) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90_000);
    try {
      return await this.request<{ ok: boolean; message?: string; pipeline_mode: string }>(
        "/monitoring/enroll/",
        { method: "POST", body: JSON.stringify(body), signal: controller.signal },
      );
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async getMonitoringHealth() {
    return this.request<{ status: string; pipeline_mode: string; service: string }>(
      "/monitoring/health/",
    );
  }

  async listBehaviorLogs(params?: { session?: string; event_type?: string }) {
    const qs = params
      ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
      : "";
    const data = await this.request<{ results?: BehaviorLogRow[] } | BehaviorLogRow[]>(
      `/behavior/logs/${qs}`,
    );
    return Array.isArray(data) ? data : (data.results ?? []);
  }

  async listAlerts(params?: { session?: string; resolved?: boolean; severity?: string }) {
    const qs = params
      ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
      : "";
    const data = await this.request<{ results?: AlertRow[] } | AlertRow[]>(`/behavior/alerts/${qs}`);
    return Array.isArray(data) ? data : (data.results ?? []);
  }

  async resolveAlert(alertId: string) {
    return this.request<AlertRow>(`/behavior/alerts/${alertId}/resolve/`, { method: "POST" });
  }

  async getReportSummary() {
    return this.request<ReportSummary>("/reports/summary/");
  }

  async listSessionReports(params?: {
    status?: string;
    exam?: number;
    department?: number;
    search?: string;
    page?: number;
    page_size?: number;
  }) {
    return this.request<PaginatedResponse<SessionReportRow>>(
      `/reports/sessions/${toQuery(params)}`,
    );
  }

  async getSessionReport(sessionId: string) {
    return this.request<{
      session: ExamSession;
      behavior_summary: { event_type: string; count: number; avg_score: number }[];
      behavior_logs: BehaviorLogRow[];
      alerts: AlertRow[];
      department_analytics: SessionDepartmentAnalytics | null;
    }>(`/reports/sessions/${sessionId}/`);
  }

  async getTimeseries() {
    return this.request<{
      sessions: { day: string; count: number }[];
      alerts: { day: string; count: number }[];
      behaviors: { day: string; count: number }[];
    }>("/reports/timeseries/");
  }

  private async downloadExport(path: string, accept: string, filename: string): Promise<void> {
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
    return this.downloadExport("/reports/export/csv/", "text/csv", "knowing-eye-sessions.csv");
  }

  async downloadSessionsPDF(): Promise<void> {
    return this.downloadExport(
      "/reports/export/pdf/",
      "application/pdf",
      "knowing-eye-sessions.pdf",
    );
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

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
