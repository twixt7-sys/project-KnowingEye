// API Service for Knowing Eye Backend Integration
// This demonstrates how the frontend would connect to the Django REST API

import { API_BASE_URL } from './env';

// Types for API responses
export interface Exam {
  id: number;
  title: string;
  description: string;
  duration_minutes: number;
  total_questions: number;
  passing_score: number;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  created_at: string;
  questions: Question[];
}

export interface Question {
  id: number;
  exam: number;
  question_text: string;
  question_type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER';
  options: string[];
  correct_answer: string;
  points: number;
  explanation?: string;
}

export interface ExamSession {
  id: string;
  user: number;
  exam: Exam;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'TERMINATED';
  started_at?: string;
  submitted_at?: string;
  total_score?: number;
  percentage_score?: number;
  passed?: boolean;
  duration?: number;
  time_remaining?: number;
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

// Generic API client
class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    // Get token from localStorage (would be set after login)
    this.token = localStorage.getItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Authentication methods
  async login(credentials: { username: string; password: string }) {
    const response = await this.request<{
      access: string;
      refresh: string;
      user: {
        id: number;
        username: string;
        email: string;
        role: string;
        first_name: string;
        last_name: string;
      };
    }>(
      '/auth/token/',
      {
        method: 'POST',
        body: JSON.stringify(credentials),
      }
    );

    this.token = response.access;
    localStorage.setItem('auth_token', response.access);
    localStorage.setItem('refresh_token', response.refresh);

    return response;
  }

  async register(userData: {
    username: string;
    email: string;
    password: string;
    password2: string;
    role?: 'ADMIN' | 'EXAMINEE';
  }) {
    const response = await this.request<{
      message: string;
      user: {
        id: number;
        username: string;
        email: string;
        first_name: string;
        last_name: string;
        role: string;
      };
    }>('/auth/register/', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    return response;
  }

  // Exam methods
  async getExams(): Promise<Exam[]> {
    return this.request('/exams/');
  }

  async getExam(id: number): Promise<Exam> {
    return this.request(`/exams/${id}/`);
  }

  // Session methods
  async startExamSession(examId: number): Promise<ExamSession> {
    const response = await this.request<{ session: ExamSession }>(
      '/sessions/start/',
      {
        method: 'POST',
        body: JSON.stringify({ exam: examId }),
      }
    );
    return response.session;
  }

  async submitExamSession(
    sessionId: string,
    data: SubmitSessionData
  ): Promise<{ session: ExamSession; results: any }> {
    return this.request(`/sessions/${sessionId}/submit/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSession(sessionId: string): Promise<ExamSession> {
    return this.request(`/sessions/${sessionId}/`);
  }

  // Monitoring methods (for future WebSocket integration)
  async sendFrame(frameData: { image: string; timestamp: number }) {
    return this.request('/monitoring/frame/', {
      method: 'POST',
      body: JSON.stringify(frameData),
    });
  }
}

// Create singleton instance
export const apiClient = new ApiClient(API_BASE_URL);

// Utility functions for exam taking
export const examAPI = {
  // Start a new exam session
  startSession: async (examId: number): Promise<ExamSession> => {
    try {
      return await apiClient.startExamSession(examId);
    } catch (error) {
      console.error('Failed to start exam session:', error);
      throw error;
    }
  },

  // Submit exam responses
  submitSession: async (
    sessionId: string,
    responses: ResponseData[],
    timeRemaining: number
  ) => {
    try {
      return await apiClient.submitExamSession(sessionId, {
        responses,
        time_remaining: timeRemaining,
      });
    } catch (error) {
      console.error('Failed to submit exam session:', error);
      throw error;
    }
  },

  // Get session details
  getSession: async (sessionId: string): Promise<ExamSession> => {
    try {
      return await apiClient.getSession(sessionId);
    } catch (error) {
      console.error('Failed to get session:', error);
      throw error;
    }
  },

  // Send monitoring frame (for behavior analysis)
  sendMonitoringFrame: async (imageData: string) => {
    try {
      return await apiClient.sendFrame({
        image: imageData,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Failed to send monitoring frame:', error);
      // Don't throw here as monitoring failures shouldn't break the exam
    }
  },
};