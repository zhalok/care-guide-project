import type { Note, Page, User } from './types';

/** nginx (and the Vite dev server) forward /api/* to the backend. */
const BASE = '/api';
const PAGE_SIZE = 20;

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  token?: string | null;
  method?: string;
  body?: unknown;
}

export async function api<T>(
  path: string,
  { token, method = 'GET', body }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ApiError(response.status, await errorMessage(response));
  }
  return (await response.json()) as T;
}

/** The backend answers errors as { statusCode, error, message, ... }. */
async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(', ');
    if (body.message) return body.message;
  } catch {
    // Not JSON (for example an nginx 502 page): fall through.
  }
  return response.status === 502 || response.status === 504
    ? 'The server is unavailable. Please try again.'
    : response.statusText || `Request failed (${response.status})`;
}

function pageQuery(cursor?: string): string {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) params.set('cursor', cursor);
  return params.toString();
}

export const login = (email: string, password: string) =>
  api<{ accessToken: string }>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });

export const getMe = (token: string) => api<User>('/users/me', { token });

export const listMyNotes = (token: string, cursor?: string) =>
  api<Page<Note>>(`/notes?${pageQuery(cursor)}`, { token });

export const listAllNotes = (token: string, cursor?: string) =>
  api<Page<Note>>(`/notes/all?${pageQuery(cursor)}`, { token });

export const listUsers = (token: string, cursor?: string) =>
  api<Page<User>>(`/users?${pageQuery(cursor)}`, { token });
