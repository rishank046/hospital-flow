export interface ApiResponse<T = unknown> {
  data?: T;
  message?: string;
  errors?: unknown[];
}

export interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}
