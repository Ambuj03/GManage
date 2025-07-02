import axios, { AxiosInstance } from 'axios';
import { 
  LoginRequest, 
  RegisterRequest, 
  User, 
  AuthTokens,
  GoogleOAuthStatus,
  EmailSearchParams,
  EmailSearchResponse,
  GmailLabel,
  BulkDeleteRequest,
  DeleteByQueryRequest,
  PreviewRequest,
  PreviewResponse,
  DeletionRule,
  TaskStatus
} from '../types/api';

class ApiService {
  private api: AxiosInstance;
  private isRefreshing = false;
  private refreshPromise: Promise<AuthTokens> | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('access_token');
      // Always add token except for auth endpoints
      if (token && !config.url?.includes('/auth/login') && !config.url?.includes('/auth/register')) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor for token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Don't retry specific endpoints or if already retried
        if (
          originalRequest._retry ||
          originalRequest.url?.includes('/auth/login') ||
          originalRequest.url?.includes('/auth/register') ||
          originalRequest.url?.includes('/auth/refresh') ||
          !localStorage.getItem('refresh_token')
        ) {
          return Promise.reject(error);
        }

        if (error.response?.status === 401) {
          if (!this.isRefreshing) {
            this.isRefreshing = true;
            this.refreshPromise = this.refreshTokenInternal().catch(() => {
              this.clearAuthData();
              window.location.href = '/login';
              throw error;
            }).finally(() => {
              this.isRefreshing = false;
              this.refreshPromise = null;
            });
          }

          try {
            const tokens = await this.refreshPromise;
            if (tokens) {
              localStorage.setItem('access_token', tokens.access);
              localStorage.setItem('refresh_token', tokens.refresh);
              originalRequest.headers.Authorization = `Bearer ${tokens.access}`;
              originalRequest._retry = true;
              return this.api.request(originalRequest);
            }
          } catch (refreshError) {
            return Promise.reject(error);
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  private clearAuthData() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  private async refreshTokenInternal(): Promise<AuthTokens> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const response = await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1'}/auth/refresh/`, {
      refresh: refreshToken,
    });
    return response.data;
  }

  // Auth APIs
  async login(credentials: LoginRequest): Promise<AuthTokens> {
    const response = await this.api.post('/auth/login/', credentials);
    return response.data.tokens;
  }

  async register(userData: RegisterRequest): Promise<User> {
    const response = await this.api.post<User>('/auth/register/', userData);
    return response.data;
  }

  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        await this.api.post('/auth/logout/', { refresh: refreshToken });
      } catch (error) {
        console.warn('Logout API failed, clearing local tokens:', error);
      }
    }
  }

  async refreshToken(): Promise<AuthTokens> {
    return this.refreshTokenInternal();
  }

  // Google OAuth APIs - MATCHING YOUR BACKEND EXACTLY
  async getGoogleAuthUrl(): Promise<{ url: string }> {
    const response = await this.api.get('/auth/google/url/');
    // Your backend returns { auth_url, state, message, success }
    return { url: response.data.auth_url };
  }

  async handleGoogleCallback(code: string, state: string): Promise<void> {
    await this.api.get(`/auth/google/callback/?code=${code}&state=${state}`);
  }

  async getGoogleOAuthStatus(): Promise<GoogleOAuthStatus> {
    const response = await this.api.get('/auth/google/status/');
    const data = response.data;
    
    // Add computed field for compatibility
    return {
      ...data,
      authenticated: data.has_token && data.is_connected && !data.is_expired
    };
  }

  async revokeGoogleAuth(): Promise<void> {
    await this.api.delete('/auth/google/revoke/');
  }

  // Gmail APIs
  async testGmailConnectivity(): Promise<{ status: string; connected: boolean }> {
    const response = await this.api.get('/gmail/connectivity/');
    return response.data;
  }

  async getEmails(params: EmailSearchParams): Promise<EmailSearchResponse> {
    const response = await this.api.get<EmailSearchResponse>('/gmail/emails/', { params });
    return response.data;
  }

  async searchEmails(params: EmailSearchParams): Promise<EmailSearchResponse> {
    const response = await this.api.get<EmailSearchResponse>('/gmail/search/', { params });
    return response.data;
  }

  async getGmailLabels(): Promise<GmailLabel[]> {
    const response = await this.api.get<GmailLabel[]>('/gmail/labels/');
    return response.data;
  }

  // Email Management APIs
  async deleteSingleEmail(messageId: string): Promise<void> {
    await this.api.delete(`/gmail/emails/delete/${messageId}/`);
  }

  async recoverSingleEmail(messageId: string): Promise<void> {
    await this.api.post(`/gmail/emails/recover/${messageId}/`);
  }

  async bulkDeleteEmails(request: BulkDeleteRequest): Promise<TaskStatus> {
    const response = await this.api.post<TaskStatus>('/gmail/emails/bulk-delete/', request);
    return response.data;
  }

  async bulkRecoverEmails(request: BulkDeleteRequest): Promise<TaskStatus> {
    const response = await this.api.post<TaskStatus>('/gmail/emails/bulk-recover/', request);
    return response.data;
  }

  async deleteByQuery(request: DeleteByQueryRequest): Promise<TaskStatus> {
    const response = await this.api.post<TaskStatus>('/gmail/delete-by-query/', request);
    return response.data;
  }

  async recoverByQuery(request: DeleteByQueryRequest): Promise<TaskStatus> {
    const response = await this.api.post<TaskStatus>('/gmail/recover-by-query/', request);
    return response.data;
  }

  async previewEmails(request: PreviewRequest): Promise<PreviewResponse> {
    const response = await this.api.post<PreviewResponse>('/gmail/preview/', request);
    return response.data;
  }

  async getDeletionRules(): Promise<DeletionRule[]> {
    const response = await this.api.get<DeletionRule[]>('/gmail/rules/');
    return response.data;
  }

  async createDeletionRule(rule: Omit<DeletionRule, 'id' | 'created_at' | 'last_executed'>): Promise<DeletionRule> {
    const response = await this.api.post<DeletionRule>('/gmail/rules/', rule);
    return response.data;
  }

  async executeRule(ruleId: number): Promise<TaskStatus> {
    const response = await this.api.post<TaskStatus>(`/gmail/rules/${ruleId}/execute/`);
    return response.data;
  }

  async getTaskStatus(taskId: string): Promise<TaskStatus> {
    const response = await this.api.get<TaskStatus>(`/tasks/${taskId}/`);
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;