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

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Kept for call-site clarity; auth now travels via the httpOnly cookie on every request. */
  auth?: boolean;
  query?: Record<string, string | number | undefined | null>;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query } = options;
  const url = new URL(`${BASE}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    // Sends/receives the httpOnly auth cookie on every request, including
    // cross-port calls in dev (localhost:3000 -> localhost:4000).
    credentials: 'include',
  });

  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = payload as { error?: string; details?: unknown } | null;
    throw new ApiError(error?.error ?? response.statusText, response.status, error?.details);
  }
  return payload as T;
}

export const publicApi = <T,>(path: string, options: RequestOptions = {}) =>
  api<T>(path, { ...options, auth: false });
