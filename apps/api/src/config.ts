import { config as dotenv } from 'dotenv';
dotenv({ path: ['.env', '../../.env'], quiet: true });
export function loadConfig() {
  const env = process.env;
  for (const key of ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'CORS_ORIGIN']) {
    if (!env[key]) throw new Error(`Missing configuration: ${key}`);
  }
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    if (env[key]!.length < 32 || env[key]!.startsWith('replace-'))
      throw new Error(`Configure a random ${key} of at least 32 characters`);
  }
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) throw new Error('JWT secrets must differ');
  for (const key of ['COOKIE_SECURE', 'METRICS_ENABLED', 'OTEL_ENABLED']) {
    if (env[key] && !['true', 'false'].includes(env[key]!))
      throw new Error(`Invalid boolean: ${key}`);
  }
  const production = env.NODE_ENV === 'production';
  if (env.OTEL_ENABLED === 'true' && env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    const endpoint = new URL(env.OTEL_EXPORTER_OTLP_ENDPOINT);
    if (!['http:', 'https:'].includes(endpoint.protocol)) throw new Error('OTLP requires HTTP(S)');
  }
  if (production && env.COOKIE_SECURE !== 'true')
    throw new Error('Production requires COOKIE_SECURE=true and HTTPS');
  const origin = new URL(env.CORS_ORIGIN!);
  if (origin.origin !== env.CORS_ORIGIN) throw new Error('CORS_ORIGIN must be a single origin');
  if (production && origin.protocol !== 'https:')
    throw new Error('Production requires an HTTPS origin');
  const db = new URL(env.DATABASE_URL!);
  if (!['postgres:', 'postgresql:'].includes(db.protocol))
    throw new Error('PostgreSQL URL required');
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  return {
    production,
    port,
    origin: origin.origin,
    databaseUrl: env.DATABASE_URL!,
    accessSecret: env.JWT_ACCESS_SECRET!,
    refreshSecret: env.JWT_REFRESH_SECRET!,
    cookieSecure: env.COOKIE_SECURE === 'true',
    metrics: env.METRICS_ENABLED !== 'false',
  };
}
