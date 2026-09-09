export type Role =
  | "ADMIN"
  | "GUIDANCE_STAFF"
  | "PROGRAM_HEAD"
  | "FACULTY"
  | "PROCTOR"
  | "STUDENT";

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
}

/** GET /auth/access-map/ - this user's role, visible modules, and granted actions. */
export interface AccessMap {
  role: Role | null;
  modules: string[];
  permissions: string[];
}

/** GET/PUT /auth/users/{id}/permissions/ - per-user module + action overrides. */
export interface UserPermissions {
  role: Role;
  modules: Record<string, "grant" | "deny">;
  actions: Record<string, boolean>;
}

export interface ProfileUser extends AuthUser {
  avatar_url: string | null;
  email_verified: boolean;
  phone: string;
  institution: string;
  student_id: string;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: number;
  name: string;
  abbreviation: string;
  is_active?: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

/** Guidance content classification (psychological, behavioral, ...), independent of department. */
export interface ExamCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  is_active?: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

/** Derived from status + the scheduling window - never stored, always computed server-side. */
export type ExamScheduleState = "upcoming" | "active" | "closed" | "expired" | null;

export interface Exam {
  id: number;
  title: string;
  description: string;
  instructions?: string;
  exam_code?: string | null;
  department?: Department | null;
  department_id?: number;
  departments?: Department[];
  department_ids?: number[];
  category?: ExamCategory | null;
  category_id?: number | null;
  duration_minutes: number;
  total_questions: number;
  passing_score: number;
  status: "draft" | "active" | "archived";
  schedule_state?: ExamScheduleState;
  available_from?: string | null;
  available_until?: string | null;
  max_attempts?: number;
  monitoring_enabled?: boolean;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  unanswered_counts_as_wrong?: boolean;
  requires_assignment?: boolean;
  results_release_at?: string | null;
  show_correct_answers?: "never" | "after_release" | "immediately";
  is_practice?: boolean;
  presentation_mode?: "one_per_page" | "section_per_page" | "scroll_all";
  max_tab_switches?: number | null;
  is_open?: boolean;
  attempts_remaining?: number | null;
  extra_time_minutes?: number;
  approval_status?: "not_submitted" | "pending" | "approved" | "rejected";
  submitted_by?: number | null;
  submitted_by_name?: string;
  submitted_at?: string | null;
  reviewed_by?: number | null;
  reviewed_by_name?: string;
  reviewed_at?: string | null;
  rejection_note?: string;
  approval_events?: ExamApprovalEvent[];
  created_by?: number;
  created_by_name?: string;
  created_by_email?: string;
  created_at: string;
  updated_at?: string;
  questions?: Question[];
  sections?: ExamSection[];
  publish_readiness?: PublishReadiness;
}

/** An in-exam question grouping - separate from the exam-level ExamCategory. */
export interface ExamSection {
  id: number;
  exam?: number;
  title: string;
  instructions?: string;
  order: number;
  questions_per_page?: number;
  created_at?: string;
}

export interface ExamApprovalEvent {
  id: number;
  action: "submit" | "approve" | "reject";
  note: string;
  actor: number | null;
  actor_name?: string;
  created_at: string;
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

/** A multiple-choice answer option - image is a media URL, set via the option-image upload endpoint. */
export interface QuestionOption {
  text: string;
  image: string | null;
}

export interface Question {
  id: number;
  exam: number;
  question_text: string;
  question_type: "multiple_choice" | "true_false" | "short_answer" | "essay";
  options: QuestionOption[];
  correct_answer?: string;
  points: number;
  order: number;
  section?: number | null;
  pool?: number | null;
  acceptable_answers?: string[];
  case_sensitive?: boolean;
  trim_whitespace?: boolean;
  shuffle_options_override?: boolean | null;
  attachments?: QuestionAttachment[];
}

export interface SessionResponse {
  id: number;
  question: number;
  answer_text: string;
  time_spent: number;
  is_correct?: boolean;
  flagged_for_review?: boolean;
  points_awarded?: number | null;
  grader_comment?: string;
  question_text?: string;
  question_type?: string;
  correct_answer?: string;
}

export interface ExamSession {
  id: string;
  user: number;
  exam: Exam;
  status: "setup" | "in_progress" | "pending_review" | "completed" | "terminated" | "expired";
  started_at?: string;
  exam_started_at?: string | null;
  submitted_at?: string;
  total_score?: number;
  percentage_score?: number;
  passed?: boolean;
  time_remaining_seconds?: number;
  time_remaining?: number;
  deadline_at?: string | null;
  option_order?: Record<string, string[]>;
  accommodation_extra_minutes?: number;
  responses?: SessionResponse[];
}

export interface ResponseData {
  question_id: number;
  answer_text: string;
  time_spent: number;
  flagged_for_review?: boolean;
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

export interface FrameAnalysis {
  session_id: string | null;
  timestamp: string | null;
  frame_index: number | null;
  frame_size?: [number, number] | null;
  face?: FrameAnalysisFace;
  posture?: FrameAnalysisPosture;
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

export interface DepartmentAnalyticsRow {
  department_id: number | null;
  department_name: string;
  department_abbreviation: string;
  completed_sessions: number;
  average_score: number | null;
  pass_rate: number | null;
  alert_count: number;
}

export interface SessionDepartmentAnalytics {
  department_id: number;
  department_name: string;
  department_abbreviation: string;
  exam_average_score: number | null;
  exam_pass_rate: number | null;
  exam_completed_sessions: number;
  department_average_score: number | null;
  department_pass_rate: number | null;
  department_completed_sessions: number;
  score_vs_department_avg: number | null;
  percentile_in_department: number | null;
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
  by_department: DepartmentAnalyticsRow[];
  generated_at: string;
}

export interface SessionReportRow {
  id: string;
  exam_id: number;
  exam_title: string;
  department_id?: number | null;
  department_name?: string | null;
  department_abbreviation?: string | null;
  user: string;
  user_full_name: string;
  /** Physical seat/room/station identifier, when assigned - lets a proctor find a flagged examinee in person. */
  seat_label?: string | null;
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
  guidance_staff: number;
  program_heads: number;
  faculty: number;
  proctors: number;
  students: number;
  inactive: number;
}
