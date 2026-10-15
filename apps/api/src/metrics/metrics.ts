import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
export const registry = new Registry();
collectDefaultMetrics({ register: registry });
export const requests = new Counter({
  name: 'http_server_requests_total',
  help: 'Completed HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});
export const duration = new Histogram({
  name: 'http_server_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});
