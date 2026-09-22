const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Resolves a salon logo/photo URL for <img src>. Uploaded images are stored
 * as relative /uploads/... paths (see POST /api/uploads/image) and need the
 * API origin prefixed; full http(s) URLs pass through unchanged.
 */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/**
 * Fired whenever an authenticated request comes back 401 — the httpOnly
 * cookie has expired or was invalidated server-side. AuthProvider subscribes
 * to this so the whole app can react in one place (the session-expired
 * dialog) instead of every page handling it independently.
 */
type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

// Endpoints where a 401 is an expected, normal outcome (e.g. checking
// whether a session exists at all) rather than a sign that a previously
// valid session just died — these must never trigger the dialog.
const SESSION_EXPIRY_EXEMPT_PATHS = ['/api/auth/login', '/api/auth/me', '/api/auth/logout'];

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Kept for call-site clarity; auth now travels via the httpOnly cookie on every request. */
  auth?: boolean;
  query?: Record<string, string | number | undefined | null>;
  /** Request timeout in ms, after which the call fails instead of hanging a spinner forever. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 20_000;

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const url = new URL(`${BASE}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      // Sends/receives the httpOnly auth cookie on every request, including
      // cross-port calls in dev (localhost:3000 -> localhost:4000).
      credentials: 'include',
      signal: controller.signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      throw new ApiError('The request took too long. Check your connection and try again.', 0);
    }
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = payload as { error?: string; details?: unknown } | null;
    if (response.status === 401 && !SESSION_EXPIRY_EXEMPT_PATHS.includes(path)) {
      sessionExpiredListeners.forEach((listener) => listener());
    }
    throw new ApiError(error?.error ?? response.statusText, response.status, error?.details);
  }
  return payload as T;
}

export const publicApi = <T,>(path: string, options: RequestOptions = {}) =>
  api<T>(path, { ...options, auth: false });
