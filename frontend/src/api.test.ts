import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, listAllNotes, listMyNotes, login } from './api';

function respond(status: number, body?: unknown, statusText = '') {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    statusText,
    headers: { 'content-type': 'application/json' },
  });
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('api', () => {
  it('prefixes paths with /api', async () => {
    const fetchMock = stubFetch(respond(200, { ok: true }));

    await api('/users/me');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/users/me');
  });

  it('sends the bearer token when given one', async () => {
    const fetchMock = stubFetch(respond(200, {}));

    await api('/users/me', { token: 'abc' });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ authorization: 'Bearer abc' });
  });

  it('sends no authorization header without a token', async () => {
    const fetchMock = stubFetch(respond(200, {}));

    await api('/auth/login');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.headers).not.toHaveProperty('authorization');
  });

  it('serialises a body as JSON', async () => {
    const fetchMock = stubFetch(respond(200, { accessToken: 't' }));

    await login('a@x.com', 'pw');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'a@x.com',
      password: 'pw',
    });
  });

  it('returns the parsed JSON body', async () => {
    stubFetch(respond(200, { items: [], nextCursor: null }));

    await expect(api('/notes')).resolves.toEqual({ items: [], nextCursor: null });
  });

  describe('errors', () => {
    it('throws an ApiError with the status and the backend message', async () => {
      stubFetch(
        respond(401, { statusCode: 401, message: 'Invalid email or password' }),
      );

      const error = await api('/auth/login').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(401);
      expect((error as ApiError).message).toBe('Invalid email or password');
    });

    it('joins a list of messages', async () => {
      stubFetch(respond(400, { message: ['a is required', 'b is invalid'] }));

      await expect(api('/x')).rejects.toThrow('a is required, b is invalid');
    });

    it('explains a gateway error that is not JSON', async () => {
      stubFetch(new Response('<html>Bad Gateway</html>', { status: 502 }));

      await expect(api('/x')).rejects.toThrow(/unavailable/i);
    });

    it('falls back to the status text for an unknown error body', async () => {
      stubFetch(new Response('nope', { status: 418, statusText: "I'm a teapot" }));

      await expect(api('/x')).rejects.toThrow("I'm a teapot");
    });
  });

  describe('list helpers', () => {
    it('requests the first page with only a limit', async () => {
      const fetchMock = stubFetch(respond(200, { items: [], nextCursor: null }));

      await listMyNotes('t');

      expect(fetchMock.mock.calls[0][0]).toBe('/api/notes?limit=20');
    });

    it('adds the cursor for later pages', async () => {
      const fetchMock = stubFetch(respond(200, { items: [], nextCursor: null }));

      await listAllNotes('t', 'abc123');

      expect(fetchMock.mock.calls[0][0]).toBe('/api/notes/all?limit=20&cursor=abc123');
    });

    it('url-encodes the cursor', async () => {
      const fetchMock = stubFetch(respond(200, { items: [], nextCursor: null }));

      await listMyNotes('t', 'a b&c');

      expect(fetchMock.mock.calls[0][0]).toContain('cursor=a+b%26c');
    });
  });
});
