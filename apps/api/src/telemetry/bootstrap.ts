import '../config.js';
import { register } from 'node:module';
export async function startTelemetry() {
  if (process.env.OTEL_ENABLED !== 'true') return;
  // ESM dependencies need the instrumentation loader before they are imported.
  register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);
  const [
    { NodeSDK },
    { OTLPTraceExporter },
    { HttpInstrumentation },
    { ExpressInstrumentation },
    { PgInstrumentation },
    { resourceFromAttributes },
  ] = await Promise.all([
    import('@opentelemetry/sdk-node'),
    import('@opentelemetry/exporter-trace-otlp-http'),
    import('@opentelemetry/instrumentation-http'),
    import('@opentelemetry/instrumentation-express'),
    import('@opentelemetry/instrumentation-pg'),
    import('@opentelemetry/resources'),
  ]);
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': 'growthos-api',
      'service.version': '1.0.0',
      'deployment.environment.name': process.env.NODE_ENV || 'development',
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${(process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318').replace(/\/$/, '')}/v1/traces`,
    }),
    instrumentations: [
      new HttpInstrumentation({ headersToSpanAttributes: undefined }),
      new ExpressInstrumentation(),
      new PgInstrumentation({ enhancedDatabaseReporting: false }),
    ],
  });
  sdk.start();
  process.once('SIGTERM', () => {
    void sdk.shutdown();
  });
}
