# GrowthOS

A self-hostable personal activity tracker. Record time spent learning, exercising,
reading, or pursuing your own goals, then see accurate calendar-based trends.
Logged time measures investment and consistency, not skill mastery.

## Quick start: Docker

Requires Docker Compose and Node to create your local configuration. No npm install
is needed on the host for the Docker workflow.

```sh
node scripts/setup.mjs
docker compose up --build -d
```

Open **http://localhost:8080**, create an account, then choose **Log activity**.
Select a date and category, enter “Learned ArgoCD”, set 2 hours / 0 minutes, and
save. The dashboard, charts, heatmap, and history read the actual database entries.
Edit or delete entries in Activity history. Manage categories and your goal in the
sidebar. Fresh accounts have six categories and no fabricated activity.

The setup script preserves an existing `.env` and generates distinct random JWT
secrets for a new one. It never prints secrets. The included PostgreSQL password
is for local development; replace it for deployment. PostgreSQL and API ports are
private in Compose. The web port is bound to loopback. Data persists in the named
volume. `docker compose down` stops services without deleting that volume.

For a real deployment, terminate HTTPS in your own reverse proxy, set
`NODE_ENV=production`, `COOKIE_SECURE=true`, and `COMPOSE_ORIGIN=https://your-host`.
Forward to the loopback web port. The API refuses insecure production configuration.
nginx blocks Swagger and metrics; production also disables Swagger in Nest itself.
There are no built-in demo credentials. Avoid `docker compose down -v` unless you
intend to erase this deployment’s database.

## Local development

Requires **Node 24 LTS, at least 24.15.0**, npm and Docker. Verified with Node
24.21.0. On Windows PowerShell use `npm.cmd` if execution policy blocks `npm.ps1`.

```sh
npm ci
npm run setup
docker compose -f compose.dev.yaml up -d
npm run db:setup
npm run dev
```

- Angular: http://localhost:4200
- API: http://localhost:3000/api/v1
- Development Swagger: http://localhost:3000/api/docs
- Readiness: http://localhost:3000/api/v1/health/ready

Angular’s dev proxy forwards `/api` to Nest. Access tokens remain in memory; cold
startup restores the session using an HttpOnly cookie. Nest development uses
TypeScript compilation with decorator metadata and Node watch mode.

In this workspace a local Node 24.21.0 runtime was installed under `.tools` because
the host had Node 24.14.0. It is ignored by source control; new checkouts should
install a supported Node version. To use that existing local runtime in PowerShell:

```powershell
$env:PATH = "$PWD\.tools\node_modules\node\bin;$env:PATH"
node --version
npm.cmd run dev
```

`npm run db:dev -w apps/api -- --name your_change` is for creating development migrations.
`npm run db:migrate` applies version-controlled migrations with `migrate deploy`.
The initial migration includes duration/goal constraints and a composite foreign
key enforcing that activity and category owners match. Never use `db push` for
production. Review migrations and back up data before deploying schema changes.

## Architecture and versions

| Component                                | Pinned version |
| ---------------------------------------- | -------------- |
| Angular / CLI / CDK                      | 22.2.2         |
| NestJS                                   | 12.1.3         |
| TypeScript                               | 6.0.3          |
| Prisma client / CLI / PostgreSQL adapter | 7.10.0         |
| PostgreSQL                               | 18.6           |
| Tailwind CSS                             | 4.3.3          |
| Chart.js / ng2-charts                    | 4.5.1 / 11.0.0 |
| Node Docker runtime                      | 24.21.0        |
| Pino / nestjs-pino                       | 10.4.0 / 5.3.1 |

Versions and peers were checked against npm and the official
[Angular compatibility table](https://angular.dev/reference/versions),
[Prisma release status](https://www.prisma.io/docs/orm/release-status), and
[PostgreSQL 18.6 release](https://www.postgresql.org/docs/release/18.6/).
Prisma’s `latest` tag pointed to an 8.0 release candidate, so stable 7.10.0 is
explicitly pinned. The lockfile overrides `deepmerge-ts` to 8.0.2 and `mysql2` to
3.24.6 to fix audited transitive vulnerabilities; generation, migration and API
tests validate the combination. `prom-client` 15.1.3 is retained as specified,
although its publisher now marks it deprecated in favor of a renamed package.
No prerelease packages or forced peer-dependency resolutions are used.

`apps/web` contains standalone Angular feature routes, reactive forms, signals,
typed API access, auth guards and lazy pages. `apps/api` contains Nest modules for
authentication, settings, categories, activities, analytics, Prisma and health.
Response types are shared through `apps/api/src/common/contracts.ts` with type-only
frontend imports. PostgreSQL performs date/category aggregation; Angular renders
real results using Chart.js. Details: [API contract](docs/api-examples.md).

Pages: `/login`, `/register`, `/dashboard`, `/activities/new`, `/activities`,
`/activities/:id/edit`, `/categories`, `/settings`.

## Tests and checks

```sh
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

Integration tests require a **separate database whose name ends in `_test`**.
The default is `growthos_test` on the local development database server. Once:

```sh
docker compose -f compose.dev.yaml exec db createdb -U growthos growthos_test
```

PowerShell migration and tests:

```powershell
$env:DATABASE_URL = 'postgresql://growthos:local-growthos@localhost:5432/growthos_test'
$env:TEST_DATABASE_URL = $env:DATABASE_URL
npm.cmd run db:migrate
npm.cmd run test:integration
Remove-Item Env:DATABASE_URL, Env:TEST_DATABASE_URL
```

POSIX equivalent:

```sh
DATABASE_URL=postgresql://growthos:local-growthos@localhost:5432/growthos_test npm run db:migrate
npm run test:integration
```

The suite starts its own API processes, checks owner isolation, auth rotation,
validation, data-derived analytics, logs, metrics, readiness failure, and actual
OTLP trace export. It creates uniquely named test accounts in the test database.
Unit tests cover calendar lengths, leap years, Monday rollover, timezones, streaks,
zero comparisons, duration input and formatting.

With the Docker stack running:

```sh
npx playwright install chromium
npm run test:e2e
```

The browser test uses the real API and creates a unique test account in the
running local stack. It exercises registration, settings, activity CRUD, refresh
on reload and mobile layout. Set `E2E_BASE_URL=http://localhost:4200` to test local
development instead. CI runs all checks with ephemeral PostgreSQL and Chromium.
See [build evidence](BUILD_PROGRESS.md) for commands actually executed here.

## Optional synthetic demo seed

Seeding is an explicit development-only command. Set `DEMO_SEED=true`,
`DEMO_EMAIL` to an address you choose, and `DEMO_PASSWORD` to your own password
(12+ characters), then run `npm run db:seed`. It creates one account and 90 days
of clearly labeled synthetic entries, skipping some days. It refuses production,
missing credentials, and existing demo addresses. Normal registration is empty.
To seed the Compose database, pass those three variables to
`docker compose run --rm -e DEMO_SEED -e DEMO_EMAIL -e DEMO_PASSWORD migrate npm run db:seed`.

## Observability and configuration

`docker compose logs -f api` shows structured JSON request and business logs.
Scrape `http://api:3000/metrics` only inside the Docker network. No Grafana
infrastructure is required. `OTEL_ENABLED=true` enables tracing; set
`OTEL_EXPORTER_OTLP_ENDPOINT` to your collector’s HTTP base endpoint (port 4318).
[Observability guide](docs/observability.md) includes PromQL, log redaction,
trace correlation, and future Alloy/Loki/Tempo examples.

`.env.example` documents the database, JWT secrets, origin, cookies and telemetry.
Goal changes recalculate historical percentages under the current setting; actual
minutes remain unchanged. Weeks start Monday. Default timezone is Asia/Riyadh.
CSV export, password reset, email verification, light mode and external
integrations are outside this MVP. TLS and the future Grafana stack are not
provisioned by this repository.
