// Standalone Simulation HTTP Client
// Strictly isolated to apps/web/src/simulation/api/
import type { SimulationHttpRequestLog } from './simulation.api.types';

// Read existing Vite environment variables without modifying any outside files
const BASE_URL: string = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  (import.meta.env.VITE_API_URL as string | undefined) ||
  'https://hospital-flow-l825.onrender.com'
).replace(/\/$/, '');

export interface RequestActorContext {
  actorId: string;
  actorRole: string;
  actorName: string;
  token?: string | null;
}

export interface SimulationRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  actor?: RequestActorContext;
  runId?: string;
  workflowEvent?: string;
  correlationId?: string;
}

export type HttpLogListener = (log: SimulationHttpRequestLog) => void;

class SimulationHttpClient {
  private logListeners: Set<HttpLogListener> = new Set();

  public subscribeLogs(listener: HttpLogListener): () => void {
    this.logListeners.add(listener);
    return () => {
      this.logListeners.delete(listener);
    };
  }

  private emitLog(log: SimulationHttpRequestLog): void {
    for (const listener of this.logListeners) {
      try {
        listener(log);
      } catch (err) {
        console.error('[SimulationHttpClient] Log listener error:', err);
      }
    }
  }

  /**
   * Sanitizes payloads by removing passwords, tokens, auth headers, and secrets.
   */
  public sanitizeData(data: unknown): unknown {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('token') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('authorization') ||
        lowerKey.includes('jwt') ||
        lowerKey.includes('cookie')
      ) {
        sanitized[key] = '[REDACTED]';
      } else if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  public async request<T = unknown>(
    endpoint: string,
    options: SimulationRequestOptions = {}
  ): Promise<T> {
    const {
      body,
      actor,
      runId = 'SIM-GLOBAL',
      workflowEvent,
      correlationId,
      headers: customHeaders,
      ...fetchOptions
    } = options;

    const fullUrl = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const method = (fetchOptions.method || 'GET').toUpperCase() as SimulationHttpRequestLog['method'];

    const headers = new Headers(customHeaders);
    if (!headers.has('Content-Type') && body !== undefined && !(body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    // Actor credential isolation: attach the actor-specific token
    if (actor?.token) {
      headers.set('Authorization', `Bearer ${actor.token}`);
    }

    const startTime = performance.now();
    let status = 0;
    let errorMessage: string | undefined;
    let responseData: unknown;

    try {
      const fetchBody =
        body === undefined || body instanceof FormData
          ? (body as BodyInit | undefined)
          : JSON.stringify(body);

      const response = await fetch(fullUrl, {
        ...fetchOptions,
        method,
        headers,
        body: fetchBody,
      });

      status = response.status;
      const durationMs = Math.round(performance.now() - startTime);

      const text = await response.text();
      try {
        responseData = text ? JSON.parse(text) : {};
      } catch {
        responseData = { raw: text };
      }

      if (!response.ok) {
        const parsed = responseData as { message?: string; error?: string } | undefined;
        errorMessage = parsed?.message || parsed?.error || `HTTP ${status}: ${response.statusText}`;
      }

      // Safe redacted logging
      const sanitizedBody = body ? this.sanitizeData(body) : undefined;
      const logEntry: SimulationHttpRequestLog = {
        id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        runId,
        timestamp: new Date().toISOString(),
        actorId: actor?.actorId || 'SYSTEM',
        actorRole: actor?.actorRole || 'SYSTEM',
        actorName: actor?.actorName || 'System Orchestrator',
        method,
        url: fullUrl,
        endpoint,
        status,
        durationMs,
        workflowEvent,
        correlationId,
        error: errorMessage,
        redactedSummary: sanitizedBody ? JSON.stringify(sanitizedBody) : undefined,
      };

      this.emitLog(logEntry);

      if (!response.ok) {
        const error = new Error(errorMessage || `Request failed with status ${status}`);
        (error as unknown as { status: number; data: unknown }).status = status;
        (error as unknown as { status: number; data: unknown }).data = responseData;
        throw error;
      }

      return responseData as T;
    } catch (err: unknown) {
      if (status === 0) {
        // Network or CORS failure
        errorMessage = err instanceof Error ? err.message : 'Network error';
        const durationMs = Math.round(performance.now() - startTime);

        const logEntry: SimulationHttpRequestLog = {
          id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          runId,
          timestamp: new Date().toISOString(),
          actorId: actor?.actorId || 'SYSTEM',
          actorRole: actor?.actorRole || 'SYSTEM',
          actorName: actor?.actorName || 'System Orchestrator',
          method,
          url: fullUrl,
          endpoint,
          status: 0,
          durationMs,
          workflowEvent,
          correlationId,
          error: errorMessage,
        };

        this.emitLog(logEntry);
      }
      throw err;
    }
  }

  public getBaseUrl(): string {
    return BASE_URL;
  }
}

export const simulationHttp = new SimulationHttpClient();
