import pino from 'pino';
import { trace } from '@opentelemetry/api';
export const logger = pino({
  messageKey: 'message',
  base: { service: 'growthos-api', environment: process.env.NODE_ENV || 'development' },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  formatters: { level: (label) => ({ level: label }) },
  redact: [
    'password',
    'passwordHash',
    'accessToken',
    'refreshToken',
    'authorization',
    'cookie',
    'email',
    'description',
    'req',
    'res',
  ],
  mixin: () => {
    const span = trace.getActiveSpan()?.spanContext();
    return span ? { traceId: span.traceId, spanId: span.spanId } : {};
  },
});
