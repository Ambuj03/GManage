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
  password_confirm: string;  // Django expects this field
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

// Google OAuth Types
export interface GoogleOAuthStatus {
  authenticated: boolean;
  email?: string;
  profile?: {
    name: string;
    email: string;
    picture: string;
  };
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

export interface GmailLabel {
  id: string;
  name: string;
  type: string;
  messagesTotal?: number;
  messagesUnread?: number;
}

export interface EmailSearchParams {
  query?: string;
  page?: number;
  page_size?: number;
  label_ids?: string[];
}

export interface EmailSearchResponse {
  emails: Email[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Bulk Operations
export interface BulkDeleteRequest {
  message_ids: string[];
}

export interface DeleteByQueryRequest {
  query: string;
  limit?: number;
}

export interface PreviewRequest {
  search_query: string;  // Backend expects 'search_query', not 'query'
  sample_size?: number;
}

export interface PreviewResponse {
  emails: Email[];
  total_count: number;
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

// API Error Response
export interface ApiError {
  detail?: string;
  [key: string]: any;
}