import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { STATUS_CODES } from 'http';
import { Error as MongooseError } from 'mongoose';

export interface ErrorResponseBody {
  statusCode: number;
  /** HTTP reason phrase, e.g. "Bad Request". */
  error: string;
  /** A string, or a list of strings when several problems are reported. */
  message: string | string[];
  path: string;
  timestamp: string;
}

/**
 * Turns every uncaught exception into the same JSON error body.
 *
 * - `HttpException`s keep their own status and message.
 * - Mongoose cast/validation errors become 400, duplicate keys become 409.
 * - Anything else becomes a generic 500: details are logged, never returned.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request: unknown = ctx.getRequest();

    const { status, message } = this.normalize(exception);

    if (status >= 500) {
      this.logger.error(
        `${httpAdapter.getRequestMethod(request)} ${this.pathOf(request)} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseBody = {
      statusCode: status,
      error: STATUS_CODES[status] ?? 'Error',
      message,
      path: this.pathOf(request),
      timestamp: new Date().toISOString(),
    };
    httpAdapter.reply(ctx.getResponse(), body, status);
  }

  private pathOf(request: unknown): string {
    const { httpAdapter } = this.httpAdapterHost;
    // Drop the query string: it can carry cursors or other identifiers.
    const url = String(httpAdapter.getRequestUrl(request));
    return url.split('?')[0];
  }

  private normalize(exception: unknown): {
    status: number;
    message: string | string[];
  } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : ((response as { message?: string | string[] }).message ??
            exception.message);
      return { status: exception.getStatus(), message };
    }

    if (
      exception instanceof MongooseError.CastError ||
      exception instanceof MongooseError.ValidationError
    ) {
      return { status: HttpStatus.BAD_REQUEST, message: exception.message };
    }

    if (this.isDuplicateKeyError(exception)) {
      return {
        status: HttpStatus.CONFLICT,
        message: 'A resource with the same unique value already exists',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  private isDuplicateKeyError(exception: unknown): boolean {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      (exception as { code?: unknown }).code === 11000
    );
  }
}
