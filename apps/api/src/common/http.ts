import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { map } from 'rxjs';
import type { Response } from 'express';
import type { AuthRequest } from './auth.guard.js';
import { logger } from '../telemetry/logging.js';
const meta = (req: AuthRequest) => ({
  requestId: req.requestId,
  timestamp: new Date().toISOString(),
});
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    return next.handle().pipe(map((data) => ({ success: true, data, meta: meta(req) })));
  }
}
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const req = host.switchToHttp().getRequest<AuthRequest>(),
      res = host.switchToHttp().getResponse<Response>();
    const prismaCode = (error as { code?: string })?.code;
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : prismaCode === 'P2002'
          ? 409
          : prismaCode === 'P2025'
            ? 404
            : 500;
    const response = error instanceof HttpException ? error.getResponse() : undefined;
    const messages =
      typeof response === 'object'
        ? (response as { message?: string | string[] }).message
        : response;
    const code =
      status === 400
        ? 'VALIDATION_FAILED'
        : status === 401
          ? 'UNAUTHORIZED'
          : status === 404
            ? 'NOT_FOUND'
            : status === 409
              ? 'CONFLICT'
              : status === 429
                ? 'RATE_LIMITED'
                : status >= 500
                  ? 'INTERNAL_ERROR'
                  : 'REQUEST_FAILED';
    if (status >= 500)
      logger.error(
        {
          event: 'http.error',
          requestId: req.requestId,
          code,
          errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
          stack:
            error instanceof Error
              ? error.stack
                  ?.split('\n')
                  .filter((line) => /^\s+at /.test(line))
                  .join('\n')
              : undefined,
        },
        'Request failed',
      );
    res.status(status).json({
      success: false,
      error: {
        code,
        message:
          status >= 500
            ? 'Service temporarily unavailable'
            : status === 409
              ? 'An account or category already exists'
              : Array.isArray(messages)
                ? 'The request contains invalid fields'
                : messages || 'Request failed',
        details: Array.isArray(messages)
          ? messages.map((message) => ({ field: message.split(' ')[0], message }))
          : undefined,
      },
      meta: meta(req),
    });
  }
}
