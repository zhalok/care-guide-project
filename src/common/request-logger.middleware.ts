import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * Logs one line per request once the response has been sent:
 * `METHOD /path STATUS 12.3ms ip=...`.
 * The query string is left out on purpose (it can carry cursors or other
 * identifiers), and so are headers and bodies (tokens, passwords).
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const latencyMs = Number(process.hrtime.bigint() - start) / 1e6;
      const path = req.originalUrl.split('?')[0];
      const message = `${req.method} ${path} ${res.statusCode} ${latencyMs.toFixed(1)}ms ip=${req.ip ?? 'unknown'}`;

      if (res.statusCode >= 500) this.logger.error(message);
      else if (res.statusCode >= 400) this.logger.warn(message);
      else this.logger.log(message);
    });

    next();
  }
}
