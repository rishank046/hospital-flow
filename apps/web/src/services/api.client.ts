const BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

export class ApiError extends Error {
  public status: number;
  public issues?: unknown[];

  constructor(message: string, status: number, issues?: unknown[]) {
    super(message);
    this.status = status;
    this.issues = issues;
    this.name = 'ApiError';
  }
}

export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('auth_token');
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', 'Bearer ' + token);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = 'An unexpected error occurred';
    let issues: unknown[] | undefined;
    try {
      const data = await response.json();
      errorMessage = data.message || errorMessage;
      issues = data.errors;
    } catch {
      errorMessage = response.statusText;
    }

    // Automatic session clearance on 401 Unauthorized
    if (response.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_role');
      localStorage.removeItem('auth_user');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    throw new ApiError(errorMessage, response.status, issues);
  }

  // Return empty object for 204 or empty bodies
  if (response.status === 204) {
    return {} as T;
  }

  const responseText = await response.text();
  if (!responseText.trim()) {
    return {} as T;
  }

  return JSON.parse(responseText) as T;
}
