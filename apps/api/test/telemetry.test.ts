import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { config } from 'dotenv';
config({ path: '../../.env', quiet: true });
test(
  'opt-in ESM instrumentation exports traces and survives exporter failure',
  { timeout: 45000 },
  async (t) => {
    const bodies: string[] = [];
    const collector = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        if (req.url === '/v1/traces') bodies.push(body);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{}');
      });
    });
    await new Promise<void>((resolve) => collector.listen(0, '127.0.0.1', resolve));
    const address = collector.address();
    assert.ok(address && typeof address === 'object');
    t.after(() => collector.close());
    const output: string[] = [];
    const child = spawn(process.execPath, ['dist/main.js'], {
      env: {
        ...process.env,
        PORT: '3103',
        NODE_ENV: 'test',
        DATABASE_URL:
          process.env.TEST_DATABASE_URL ||
          'postgresql://growthos:local-growthos@localhost:5432/growthos_test',
        OTEL_ENABLED: 'true',
        OTEL_BSP_SCHEDULE_DELAY: '100',
        OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${address.port}`,
        COOKIE_SECURE: 'false',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (b) => output.push(String(b)));
    child.stderr.on('data', (b) => output.push(String(b)));
    t.after(() => child.kill());
    for (let i = 0; i < 200; i++) {
      try {
        const r = await fetch('http://127.0.0.1:3103/api/v1/health/ready');
        if (r.ok) break;
      } catch {}
      if (i === 199) throw new Error('Telemetry API did not start: ' + output.join(''));
      await delay(100);
    }
    for (let i = 0; i < 100 && !bodies.length; i++) await delay(100);
    assert.ok(bodies.length > 0, 'OTLP collector received spans');
    assert.ok(
      bodies.some((b) => b.includes('growthos-api')),
      'service resource is exported',
    );
    const logs = output
      .join('')
      .split('\n')
      .filter((x) => x.startsWith('{'))
      .map((x) => JSON.parse(x) as Record<string, unknown>);
    assert.ok(
      logs.some(
        (l) =>
          l.event === 'http.request.completed' &&
          typeof l.traceId === 'string' &&
          typeof l.spanId === 'string',
      ),
      'request logs carry trace context',
    );
    await new Promise<void>((resolve) => collector.close(() => resolve()));
    const response = await fetch('http://127.0.0.1:3103/api/v1/health/ready');
    assert.equal(response.status, 200);
  },
);
