// User and Authentication Types
export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  date_joined?: string;
  is_active?: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

// Google OAuth Types - EXACTLY matching your Django backend
export interface GoogleOAuthStatus {
  has_token: boolean;
  is_expired: boolean | null;
  is_connected: boolean;
  scopes: string[];
  message?: string;
  gmail_info?: {
    email_address: string;
    messages_total: number;
    threads_total: number;
  };
  created_at?: string;
  updated_at?: string;
  // Computed field for compatibility
  authenticated: boolean;
}

// Gmail Types
export interface Email {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  date: string;
  snippet: string;
  labels: string[];
  size: number;
}

export interface EmailItem {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  size_estimate: number;
  labels: string[];
}

export interface GmailLabel {
  id: string;
  name: string;
  type: string;
  messagesTotal?: number;
  messagesUnread?: number;
}

export interface EmailSearchParams {
  q?: string;           // Changed from 'query' to 'q' to match backend
  page?: number;
  page_size?: number;
  label_ids?: string[];
}

export interface EmailSearchResponse {
  results: EmailItem[];  // Changed from 'emails' to 'results'
  count: number;         // Changed from 'total_count' to 'count'
  next: string | null;   // Added for pagination
  previous: string | null; // Added for pagination
}

// Bulk Operations
export interface BulkDeleteRequest {
  message_ids: string[];
}

export interface DeleteByQueryRequest {
  q: string;  // Changed from 'query' to 'q' to match backend
  label_ids?: string[];
  limit?: number;
}

// FIXED PREVIEW INTERFACES
export interface PreviewRequest {
  q: string;  // Changed from 'search_query' to 'q' to match backend
  label_ids?: string[];
  max_results?: number;  // Changed from 'sample_size' to 'max_results'
}

export interface PreviewResponse {
  emails: EmailItem[];  // Changed from Email[] to EmailItem[]
  total_estimate: number;  // Changed from 'total_count' to 'total_estimate'
  sample_count: number;
  estimated_deletion_time?: string;
}

export interface DeletionRule {
  id: number;
  name: string;
  query: string;
  is_active: boolean;
  created_at: string;
  last_executed?: string;
}

export interface TaskStatus {
  task_id: string;
  status: 'PENDING' | 'PROGRESS' | 'SUCCESS' | 'FAILURE';
  result?: any;
  progress?: {
    current: number;
    total: number;
    message?: string;
  };
}

export interface ApiError {
  detail?: string;
  [key: string]: any;
}

export interface EmailCountResponse {
  count: number;
  is_estimate: boolean;
  query: string;
  max_count: number;
}