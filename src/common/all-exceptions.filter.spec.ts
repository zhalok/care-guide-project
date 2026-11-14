import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Error as MongooseError } from 'mongoose';
import {
  AllExceptionsFilter,
  ErrorResponseBody,
} from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  const reply = jest.fn();
  const response = { res: true };
  const request = { url: '/notes?cursor=secret-cursor' };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  let filter: AllExceptionsFilter;
  let logError: jest.SpyInstance;

  /** The status and body handed to the HTTP adapter's reply(). */
  const sent = () => {
    const [res, body, status] = reply.mock.calls[0] as [
      unknown,
      ErrorResponseBody,
      number,
    ];
    return { res, body, status };
  };

  beforeEach(() => {
    jest.resetAllMocks();
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const httpAdapterHost = {
      httpAdapter: {
        reply,
        getRequestUrl: (req: { url: string }) => req.url,
        getRequestMethod: () => 'GET',
      },
    } as unknown as HttpAdapterHost;
    filter = new AllExceptionsFilter(httpAdapterHost);
  });

  it('replies on the original response object', () => {
    filter.catch(new NotFoundException('nope'), host);

    expect(sent().res).toBe(response);
  });

  it('keeps the status and message of an HttpException', () => {
    filter.catch(new ForbiddenException('Insufficient permissions'), host);

    expect(sent().status).toBe(403);
    expect(sent().body).toMatchObject({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Insufficient permissions',
    });
  });

  it('passes through a list of messages', () => {
    filter.catch(
      new BadRequestException(['a is required', 'b is invalid']),
      host,
    );

    expect(sent().body.message).toEqual(['a is required', 'b is invalid']);
  });

  it('handles an HttpException created with a plain string response', () => {
    filter.catch(new NotFoundException('User 1 not found'), host);

    expect(sent().body.message).toBe('User 1 not found');
  });

  it('includes the path without its query string, and an ISO timestamp', () => {
    filter.catch(new NotFoundException(), host);

    const { body } = sent();
    expect(body.path).toBe('/notes');
    expect(JSON.stringify(body)).not.toContain('secret-cursor');
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('does not log client errors', () => {
    filter.catch(new BadRequestException('bad'), host);

    expect(logError).not.toHaveBeenCalled();
  });

  it('maps a Mongoose CastError to 400', () => {
    filter.catch(new MongooseError.CastError('ObjectId', 'abc', '_id'), host);

    expect(sent().status).toBe(400);
    expect(sent().body.error).toBe('Bad Request');
  });

  it('maps a Mongoose ValidationError to 400', () => {
    filter.catch(new MongooseError.ValidationError(), host);

    expect(sent().status).toBe(400);
  });

  it('maps a duplicate key error (code 11000) to 409', () => {
    filter.catch(
      Object.assign(new Error('E11000 dup key'), { code: 11000 }),
      host,
    );

    expect(sent().status).toBe(409);
    expect(sent().body.error).toBe('Conflict');
    expect(sent().body.message).not.toContain('E11000');
  });

  it('turns an unknown error into a generic 500 without leaking details', () => {
    filter.catch(
      new Error('connection string mongodb://user:pw@host failed'),
      host,
    );

    expect(sent().status).toBe(500);
    expect(sent().body).toMatchObject({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
    expect(JSON.stringify(sent().body)).not.toContain('mongodb://');
  });

  it('logs the real error and stack for a 500', () => {
    const error = new Error('boom');

    filter.catch(error, host);

    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('GET /notes -> 500'),
      error.stack,
    );
  });

  it('handles a thrown non-Error value', () => {
    filter.catch('just a string', host);

    expect(sent().status).toBe(500);
    expect(logError).toHaveBeenCalledWith(expect.any(String), 'just a string');
  });
});
