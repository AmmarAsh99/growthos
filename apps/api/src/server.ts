import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module.js';
import { loadConfig } from './config.js';
import { EnvelopeInterceptor, ErrorFilter } from './common/http.js';
import { logger } from './telemetry/logging.js';
import { registry, requests, duration } from './metrics/metrics.js';
import type { AuthRequest } from './common/auth.guard.js';
import { documentEnvelopes, responseModels } from './common/openapi.js';
export async function createApp() {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use((req: AuthRequest, res: Response, next: NextFunction) => {
    const incoming = req.headers['x-request-id'];
    req.requestId =
      typeof incoming === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(incoming)
        ? incoming
        : randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    const started = performance.now();
    res.once('finish', () => {
      const durationMs = performance.now() - started;
      const route =
        typeof req.route?.path === 'string'
          ? req.route.path
          : ['/metrics', '/api/docs', '/api/docs-json'].includes(req.path)
            ? req.path
            : 'unmatched';
      const method = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'].includes(
        req.method,
      )
        ? req.method
        : 'OTHER';
      const labels = { method, route, status_code: String(res.statusCode) };
      requests.inc(labels);
      duration.observe(labels, durationMs / 1000);
      logger.info(
        {
          event: 'http.request.completed',
          requestId: req.requestId,
          method,
          route,
          statusCode: res.statusCode,
          durationMs,
          userId: req.user?.id,
          errorCode: res.locals.errorCode,
        },
        'HTTP request completed',
      );
    });
    next();
  });
  app.use(helmet());
  app.use(cookieParser());
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      ['POST', 'PATCH', 'DELETE', 'PUT'].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== config.origin
    ) {
      res.locals.errorCode = 'ORIGIN_REJECTED';
      res.status(403).json({
        success: false,
        error: { code: 'ORIGIN_REJECTED', message: 'Origin not allowed' },
        meta: { requestId: (req as AuthRequest).requestId, timestamp: new Date().toISOString() },
      });
      return;
    }
    next();
  });
  app.enableCors({ origin: config.origin, credentials: true, exposedHeaders: ['X-Request-Id'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalInterceptors(new EnvelopeInterceptor());
  app.useGlobalFilters(new ErrorFilter());
  const express = app.getHttpAdapter().getInstance();
  express.get('/metrics', (_req: Request, res: Response) => {
    if (!config.metrics) {
      res.sendStatus(404);
      return;
    }
    void registry.metrics().then((body) => res.type(registry.contentType).send(body));
  });
  if (!config.production) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('GrowthOS API').setVersion('1.0.0').addBearerAuth().build(),
      { extraModels: responseModels },
    );
    documentEnvelopes(document);
    SwaggerModule.setup('api/docs', app, document);
  }
  app.enableShutdownHooks();
  return app;
}
