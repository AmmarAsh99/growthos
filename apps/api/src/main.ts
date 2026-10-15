import { startTelemetry } from './telemetry/bootstrap.js';
await startTelemetry();
const { createApp } = await import('./server.js');
const app = await createApp();
await app.listen(Number(process.env.PORT || 3000), '0.0.0.0');
