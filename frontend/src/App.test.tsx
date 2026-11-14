import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { AuthProvider } from './auth';
import type { Note, Page, User } from './types';

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const user = (role: 'user' | 'admin', name = 'Alice'): User => ({
  _id: `${role}-1`,
  name,
  email: `${name.toLowerCase()}@example.com`,
  role,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const note = (n: number): Note => ({
  _id: `note-${n}`,
  title: `Note title ${n}`,
  content: `Note content ${n}`,
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const page = <T,>(items: T[], nextCursor: string | null = null): Page<T> => ({
  items,
  nextCursor,
});

/** Routes fake backend responses by `METHOD /path` and records every call. */
function mockBackend(routes: Record<string, Handler>) {
  const calls: { key: string; url: URL; init: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init: RequestInit = {}) => {
      const url = new URL(input, 'http://localhost');
      const key = `${init.method ?? 'GET'} ${url.pathname}`;
      calls.push({ key, url, init });
      const handler = routes[key];
      return Promise.resolve(
        handler ? handler(url, init) : json(404, { message: `no route ${key}` }),
      );
    }),
  );
  return {
    calls,
    called: (key: string) => calls.filter((call) => call.key === key),
  };
}

const bearer = (init: RequestInit) =>
  (init.headers as Record<string, string>).authorization;

function renderApp() {
  return render(
    <AuthProvider>
      <App />
    </AuthProvider>,
  );
}

function signIn(email = 'alice@example.com', password = 'alice123') {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('login', () => {
  it('shows the login form when there is no stored token', () => {
    mockBackend({});

    renderApp();

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });

  it('logs in, loads the profile, then shows my notes', async () => {
    const backend = mockBackend({
      'POST /api/auth/login': () => json(200, { accessToken: 'jwt-token' }),
      'GET /api/users/me': () => json(200, user('user', 'Bob')),
      'GET /api/notes': () => json(200, page([note(1), note(2)])),
    });
    renderApp();

    signIn('bob@example.com', 'bob123');

    expect(await screen.findByText('Note title 1')).toBeTruthy();
    expect(screen.getByText('Note title 2')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();

    const loginCall = backend.called('POST /api/auth/login')[0];
    expect(JSON.parse(loginCall.init.body as string)).toEqual({
      email: 'bob@example.com',
      password: 'bob123',
    });
    // Authenticated calls carry the token the login returned.
    expect(bearer(backend.called('GET /api/users/me')[0].init)).toBe(
      'Bearer jwt-token',
    );
    expect(bearer(backend.called('GET /api/notes')[0].init)).toBe(
      'Bearer jwt-token',
    );
    expect(sessionStorage.getItem('care-guide.token')).toBe('jwt-token');
  });

  it('shows the backend message and stays on the form for bad credentials', async () => {
    mockBackend({
      'POST /api/auth/login': () =>
        json(401, { message: 'Invalid email or password' }),
    });
    renderApp();

    signIn('alice@example.com', 'wrong');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Invalid email or password',
    );
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(sessionStorage.getItem('care-guide.token')).toBeNull();
  });
});

describe('roles', () => {
  const admin = () =>
    mockBackend({
      'POST /api/auth/login': () => json(200, { accessToken: 'admin-token' }),
      'GET /api/users/me': () => json(200, user('admin')),
      'GET /api/notes': () => json(200, page([note(1)])),
      'GET /api/notes/all': () => json(200, page([note(7), note(8)])),
      'GET /api/users': () =>
        json(200, page([user('admin', 'Alice'), user('user', 'Bob')])),
    });

  it('a regular user only sees the "My notes" tab', async () => {
    mockBackend({
      'POST /api/auth/login': () => json(200, { accessToken: 't' }),
      'GET /api/users/me': () => json(200, user('user', 'Bob')),
      'GET /api/notes': () => json(200, page([note(1)])),
    });
    renderApp();

    signIn();
    await screen.findByText('Note title 1');

    expect(screen.getByRole('button', { name: 'My notes' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'All notes' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Users' })).toBeNull();
  });

  it('an admin sees all three tabs and can open them', async () => {
    const backend = admin();
    renderApp();

    signIn();
    await screen.findByText('Note title 1');

    fireEvent.click(screen.getByRole('button', { name: 'All notes' }));
    expect(await screen.findByText('Note title 7')).toBeTruthy();
    expect(backend.called('GET /api/notes/all')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Users' }));
    expect(await screen.findByText('bob@example.com')).toBeTruthy();
    expect(backend.called('GET /api/users')).toHaveLength(1);
  });

  it('shows a permission message when the API answers 403', async () => {
    mockBackend({
      'POST /api/auth/login': () => json(200, { accessToken: 't' }),
      'GET /api/users/me': () => json(200, user('admin')),
      'GET /api/notes': () => json(200, page([note(1)])),
      'GET /api/users': () =>
        json(403, { message: 'Insufficient permissions' }),
    });
    renderApp();
    signIn();
    await screen.findByText('Note title 1');

    fireEvent.click(screen.getByRole('button', { name: 'Users' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(
      /do not have permission/i,
    );
  });
});

describe('notes list', () => {
  function signedInBackend(notesHandler: Handler) {
    return mockBackend({
      'POST /api/auth/login': () => json(200, { accessToken: 't' }),
      'GET /api/users/me': () => json(200, user('user', 'Bob')),
      'GET /api/notes': notesHandler,
    });
  }

  it('loads further pages with the cursor and appends them', async () => {
    const backend = signedInBackend((url) =>
      url.searchParams.get('cursor') === 'cursor-1'
        ? json(200, page([note(3), note(4)], null))
        : json(200, page([note(1), note(2)], 'cursor-1')),
    );
    renderApp();
    signIn();
    await screen.findByText('Note title 1');

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Note title 4')).toBeTruthy();
    // Earlier items are kept, and there is nothing more to load.
    expect(screen.getByText('Note title 1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    const second = backend.called('GET /api/notes')[1];
    expect(second.url.searchParams.get('cursor')).toBe('cursor-1');
  });

  it('shows no "Load more" button on a single page', async () => {
    signedInBackend(() => json(200, page([note(1)], null)));
    renderApp();

    signIn();
    await screen.findByText('Note title 1');

    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('shows an empty state', async () => {
    signedInBackend(() => json(200, page([], null)));
    renderApp();

    signIn();

    expect(await screen.findByText('No notes yet.')).toBeTruthy();
  });

  it('shows a server error message', async () => {
    signedInBackend(() => new Response('<html>bad gateway</html>', { status: 502 }));
    renderApp();

    signIn();

    expect((await screen.findByRole('alert')).textContent).toMatch(
      /unavailable/i,
    );
  });
});

describe('session', () => {
  it('logging out returns to the login form and clears the token', async () => {
    mockBackend({
      'POST /api/auth/login': () => json(200, { accessToken: 't' }),
      'GET /api/users/me': () => json(200, user('user', 'Bob')),
      'GET /api/notes': () => json(200, page([note(1)])),
    });
    renderApp();
    signIn();
    await screen.findByText('Note title 1');

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(sessionStorage.getItem('care-guide.token')).toBeNull();
  });

  it('restores the session from a stored token on load', async () => {
    sessionStorage.setItem('care-guide.token', 'stored-token');
    const backend = mockBackend({
      'GET /api/users/me': () => json(200, user('user', 'Bob')),
      'GET /api/notes': () => json(200, page([note(1)])),
    });

    renderApp();

    expect(await screen.findByText('Note title 1')).toBeTruthy();
    expect(backend.called('POST /api/auth/login')).toHaveLength(0);
    expect(bearer(backend.called('GET /api/users/me')[0].init)).toBe(
      'Bearer stored-token',
    );
  });

  it('drops an expired stored token and shows the login form', async () => {
    sessionStorage.setItem('care-guide.token', 'expired');
    mockBackend({
      'GET /api/users/me': () => json(401, { message: 'Invalid or expired token' }),
    });

    renderApp();

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(sessionStorage.getItem('care-guide.token')).toBeNull();
  });

  it('logs out when a data request is rejected with 401', async () => {
    mockBackend({
      'POST /api/auth/login': () => json(200, { accessToken: 't' }),
      'GET /api/users/me': () => json(200, user('user', 'Bob')),
      'GET /api/notes': () => json(401, { message: 'Invalid or expired token' }),
    });
    renderApp();

    signIn();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy(),
    );
    expect(sessionStorage.getItem('care-guide.token')).toBeNull();
  });
});
