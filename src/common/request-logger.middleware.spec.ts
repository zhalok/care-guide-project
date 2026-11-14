import { Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import type { Request, Response } from 'express';
import { RequestLoggerMiddleware } from './request-logger.middleware';

/** The first argument of the first call, as a string. */
const firstMessage = (spy: jest.SpyInstance): string =>
  String((spy.mock.calls as unknown[][])[0][0]);

describe('RequestLoggerMiddleware', () => {
  let middleware: RequestLoggerMiddleware;
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;
  const next = jest.fn();

  const makeReq = (overrides: Partial<Request> = {}) =>
    ({
      method: 'GET',
      originalUrl: '/notes',
      ip: '203.0.113.7',
      headers: { authorization: 'Bearer secret-token' },
      ...overrides,
    }) as unknown as Request;

  const makeRes = (statusCode: number) => {
    const res = new EventEmitter() as EventEmitter & { statusCode: number };
    res.statusCode = statusCode;
    return res as unknown as Response & EventEmitter;
  };

  beforeEach(() => {
    jest.resetAllMocks();
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    middleware = new RequestLoggerMiddleware();
  });

  it('calls next and does not log until the response finishes', () => {
    const res = makeRes(200);

    middleware.use(makeReq(), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
  });

  it('logs method, path, status, latency and client ip on finish', () => {
    const res = makeRes(200);
    middleware.use(
      makeReq({ method: 'POST', originalUrl: '/auth/login' }),
      res,
      next,
    );

    res.emit('finish');

    expect(log).toHaveBeenCalledTimes(1);
    expect(firstMessage(log)).toMatch(
      /^POST \/auth\/login 200 \d+\.\dms ip=203\.0\.113\.7$/,
    );
  });

  it('leaves the query string out of the logged path', () => {
    const res = makeRes(200);
    middleware.use(
      makeReq({ originalUrl: '/notes?cursor=abc123&limit=5' }),
      res,
      next,
    );

    res.emit('finish');

    const message = firstMessage(log);
    expect(message).toContain('GET /notes 200');
    expect(message).not.toContain('cursor');
  });

  it('never logs the authorization header', () => {
    const res = makeRes(200);
    middleware.use(makeReq(), res, next);

    res.emit('finish');

    expect(JSON.stringify(log.mock.calls)).not.toContain('secret-token');
  });

  it('uses warn for 4xx responses', () => {
    const res = makeRes(403);
    middleware.use(makeReq(), res, next);

    res.emit('finish');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(firstMessage(warn)).toContain(' 403 ');
    expect(log).not.toHaveBeenCalled();
  });

  it('uses error for 5xx responses', () => {
    const res = makeRes(500);
    middleware.use(makeReq(), res, next);

    res.emit('finish');

    expect(error).toHaveBeenCalledTimes(1);
    expect(firstMessage(error)).toContain(' 500 ');
  });

  it('falls back to "unknown" when the ip is unavailable', () => {
    const res = makeRes(200);
    middleware.use(makeReq({ ip: undefined }), res, next);

    res.emit('finish');

    expect(firstMessage(log)).toContain('ip=unknown');
  });
});
