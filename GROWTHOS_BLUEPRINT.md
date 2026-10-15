# GrowthOS — Personal Growth Dashboard

**Status:** implementation-ready MVP blueprint  
**Baseline:** October 13, 2026  
**Goal:** Build a complete, working, self-hostable personal activity-tracking and progress-analytics application, NOT just a static UI.

---

## 1. Product idea

GrowthOS is a clean, motivating app where a person signs in, records self-development activities (e.g., "Learned ArgoCD for 2 hours"), and sees trustworthy time-based insights over days, weeks, months and years.

### Key user journey

1. A new user registers, signs in, and sets a daily investment goal (default: 120 minutes).
2. The app creates default categories: DevOps & Cloud, Programming, Reading, Fitness, Career, Personal. They can rename/add/archive them.
3. The user goes to **Add Activity**, picks an actual calendar date, category, title, optional description, and hours/minutes.
4. The user saves the activity and sees a success confirmation.
5. The **Dashboard** immediately reflects the new activity in progress cards, trends, streaks, a category chart, and a recent activity list.
6. The user can edit/delete a mistaken activity later; all analytics recalculate.
7. The user can filter by period and category, and view historical activity.

### Design principles

- Friendly and motivating, but no scientifically unsupported claims of "10% more developed as a human".
- All percentages must have a visible, auditable formula and meaningful denominator.
- A real multi-user system with strictly isolated data, even if initially only one person uses it.
- Modern, fast, accessible, responsive, dark-mode-first UI.
- Backend structured JSON logs and metrics from day one, ready for future Loki/Alloy/Grafana setup.
- MVP first: avoid AI features, social feeds, external integrations, microservices, complicated gamification, and unnecessary infrastructure.

---

## 2. Tech choices and verified baseline

- **Frontend:** Angular **22.x** (latest stable patch at install time), Angular standalone components, signals and modern Angular control flow, strict TypeScript.
- **UI:** Tailwind CSS (latest Angular-compatible stable release), responsive and accessible controls; Lucide icons or another lightweight Angular-compatible icon library.
- **Charts:** Chart.js + **ng2-charts 11.x** (ng2-charts' compatibility table maps v11 to Angular 22); if a peer dependency conflict is found at implementation time, resolve it by installing a compatible stable version, never `--force`.
- **Backend:** NestJS **12.x** (latest stable patch at install time), TypeScript, Express adapter, REST API, Swagger/OpenAPI.
- **Database:** PostgreSQL **18.x** stable (avoid PostgreSQL 19 betas/RCs); use Docker image `postgres:18` pinned to a suitable stable patch or digest when practical.
- **ORM:** Prisma ORM 7 with migrations and `@prisma/adapter-pg`. Follow current Prisma 7 Node/ESM/driver adapter conventions; do NOT copy Prisma 5/6 tutorials blindly.
- **Runtime:** Node.js **24 LTS**, selecting a current version that meets Angular 22 and Prisma requirements (Angular 22 compatibility docs specify Node 24.15.0+ among supported options).
- **Validation:** Nest `class-validator` and `class-transformer`, global `ValidationPipe` and typed DTOs; Zod is acceptable for validating config only if necessary.
- **Auth:** access JWT (short-lived), rotating refresh JWT in HttpOnly cookie, Argon2id password hashing.
- **Logging:** `nestjs-pino`/Pino JSON stdout logs, consistent request log + business event logs, redaction.
- **Telemetry:** OpenTelemetry Node SDK for traces, opt-in via environment settings, with HTTP + PostgreSQL instrumentation where compatible. `prom-client` for Prometheus metrics.
- **Dev/deployment:** npm workspaces or a simple monorepo with `apps/web` and `apps/api`; Docker Compose for PostgreSQL/API/web; multi-stage Dockerfiles, nginx serving built Angular, `/api` reverse proxy to Nest.
- **Testing:** Nest unit/integration tests, API E2E against a dedicated test DB, Angular tests, Playwright smoke E2E if practical; lint, format, build.

**Dependency rule:** At actual implementation time, verify current official versions and peer dependencies, choose stable releases, commit an exact lockfile. No pre-releases.

Official compatibility references:
- https://angular.dev/reference/releases
- https://angular.dev/reference/versions
- https://angular.dev/guide/tailwind
- https://docs.nestjs.com/
- https://www.npmjs.com/package/ng2-charts
- https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql
- https://opentelemetry.io/docs/languages/js/

---

## 3. Screens and information architecture

### Routes and sidebar

| Page | Angular route | Purpose |
|---|---|---|
| Login | `/login` | Email/password login |
| Register | `/register` | Create an account |
| Dashboard | `/dashboard` | Progress cards and charts |
| Add Activity | `/activities/new` | Log an activity |
| Activity History | `/activities` | Search/filter/edit/delete entries |
| Edit Activity | `/activities/:id/edit` | Edit existing activity |
| Categories | `/categories` | Manage activity categories |
| Settings | `/settings` | Display name, daily goal, timezone, week preference, logout |

Guard all authenticated routes. Redirect authenticated users away from login/register.

### Dashboard visual specification

**Aesthetic:** deep midnight/navy background, subtly different elevation on cards, violet and cyan accents, large clean typography, generous whitespace, 12–16px rounded corners, understated shadows/borders, clear focus/hover states, subtle micro-animations. No cluttered neon or exaggerated gaming UI. Support light theme later; implement dark as default in MVP.

**Desktop layout:** fixed collapsible left sidebar; header with greeting, local date, period filter, avatar/initials; responsive 12-column content region. On mobile use a drawer/sidebar and stacked charts/cards.

**Dashboard widgets:**
1. Welcome header: `Keep growing, {displayName}` and a prominent **+ Log Activity** CTA.
2. Four metric cards: **Today’s goal** (% with actual/goal minutes), **This week** (% toward full weekly goal), **This month** (% toward full monthly goal), **Current activity streak** (days).
3. Secondary facts row: **Total learning time** (selected period), **Active days**, **Number of activities**, **Change vs previous comparable period** (only if statistically defined).
4. Main line/bar chart: "Time invested" by day (7/30/90 days), week (12 weeks), month (12 months), year (5 years). Clear labels and tooltips. Toggle bars/line if easy.
5. Category breakdown doughnut chart showing minutes and percentage by category; show zero-data state.
6. Contribution heatmap for recent 90 days or a straightforward mini-calendar, with activity intensity based on minutes.
7. Recent activities list (last 5) with category badge, title, date, duration; link to all activities.
8. Small supportive copy driven by verified metrics (e.g., `You logged activities on 5 days this week!`), not invented personal rankings or health claims.

**Charts:** provide loading skeletons, accessible text summaries, responsive resizing, no broken charts when no data, no hard-coded/mock values in production. Charts must reload after add/edit/delete and period selection.

### Activity form

Fields:
- **Date:** required; default to TODAY in the user's configured timezone, can choose a past date; disallow future actual activities in MVP.
- **Title:** required, 2–120 chars. Example: "ArgoCD fundamentals".
- **Category:** required; choose user's category. Provide quick link to create a new category.
- **Duration:** hours integer 0–23 + minutes integer 0–59; total 1–1440 minutes; permit exactly `24h 0m` as a special valid input, but reject `24h` with any extra minutes. Validate both client and server. Example: 2h 0m => 120 minutes.
- **Description:** optional, up to 2,000 chars. Example: "Learned GitOps sync, applications, and automated deployment."

Submit states: save spinner, disable duplicate submission, inline validation, success toast, API error display. After save, navigate back to Dashboard or History using a clear button.

### History page

Paginated table/cards sorted by activity date descending, creation time descending. Filter by `from`, `to`, `categoryId`, and search title; include duration and total minutes for current filters (not just the current page). Edit/delete with confirmation; deletion updates analytics. Display empty state with CTA.

### Settings

- Update display name, IANA timezone (default `Asia/Riyadh`), daily goal in minutes (default 120), week start Monday (default).
- Explain: **Changing the goal re-evaluates historical goal percentages based on the current setting in MVP; logged time does not change.** Show a confirmation/notice when editing goals.
- Email/password changes and exporting CSV/JSON are Phase 2, not required for MVP.

---

## 4. Definition of progress and analytics (CRITICAL)

### 4.1 Principles

**Never say "you improved 70%" without explaining what this number measures.** The score is **progress toward your configured time-investment goal**, NOT a scientifically valid skill/personality/fitness improvement score.

Store all activity duration as **integer minutes** (not floating-point hours). Store each activity's logical date as PostgreSQL `DATE`. Use the user's configured IANA timezone to determine *today*, selected periods, and streak boundaries. Never shift a `YYYY-MM-DD` logical activity date through UTC and accidentally change it.

### 4.2 Formulas

Let:
- `actualMinutes(P) = SUM(durationMinutes)` of authenticated user's activities with activityDate in period P (all categories unless category filter supplied).
- `dailyTarget = settings.dailyGoalMinutes` (default 120).
- `calendarDays(P) = count of calendar days in P` (e.g. week = 7; October = 31; year = 365/366). MVP goal begins at start of the relevant calendar period, even if user signed up during that period; display formula transparently.
- `goalMinutes(P) = dailyTarget * calendarDays(P)`.
- `goalProgressPct(P) = 100 * min(actualMinutes(P) / goalMinutes(P), 1)`; round only at presentation to 1 decimal. This is **progress toward the full period goal**.
- `pacePct(P) = 100 * min(actualMinutes(elapsed portion of P) / (dailyTarget * elapsedCalendarDays(P)), 1)`. Show separately as **On-track to date** when useful, NOT as the main period goal percentage. Do not pro-rate today's goal by hour.

For a DAY, these formulas coincide. For a calendar week, week starts Monday. For MONTH and YEAR, use actual calendar month/year boundaries, not arbitrary 30/365 for all cases.

**Example:** Daily goal 120 minutes, entry 12 minutes today => daily goal progress **10%**. Entry 120 minutes today => daily goal progress **100%**. If October has 31 days, full monthly goal is 3,720 minutes; actual 1,860 minutes => monthly goal progress **50%**. The actual time must always be visible beside percentages.

Do not let progress exceed 100%, but show **raw actual minutes** even if > goal; optionally show `+30 minutes beyond goal`.

### 4.3 Comparison percentages

For the `Change vs previous period` badge, calculate the delta in **minutes** between equivalent elapsed windows. For current incomplete week/month/year, compare its elapsed calendar days with the same count of calendar days starting at the prior equivalent period's beginning, clamped if prior month/year is shorter. Define the method in a tooltip. Formula:

`changePct = ((currentComparableMinutes - previousComparableMinutes) / previousComparableMinutes) * 100`

If previous comparable minutes = 0, return `null` and show "No comparison yet" (not Infinity, NaN, or fake 100%). If current = previous = 0, show N/A. Do not call comparison `improvement`; label "Logged time vs previous period".

### 4.4 Activity streak

An **active day** is a user-local calendar date on which the sum of activity minutes is > 0. The active streak is the count of consecutive active dates ending today, or yesterday if today has no entry yet (today is not over). A missing day older than yesterday breaks the streak. Return `0` for accounts with no activity.

### 4.5 Data aggregation

- Use indexed, efficient backend queries to group real entries by date/week/month/year.
- Return missing time buckets with 0 minutes, in ascending time order.
- Grouping is done on the backend; do not load all years of entries into Angular and aggregate client-side.
- Filter by authenticated user ID everywhere; include category filter in analytics if supported.
- History changes should be reflected in dashboard results on subsequent refetch.
- Consistently use IANA timezone for today's date and calendar windows; activityDate is a DATE without a timezone.

---

## 5. Architecture

```text
Browser / Angular 22 (4200 dev; nginx 80 prod)
       |  HTTPS / same-origin /api
       v
Nginx (production frontend + /api reverse proxy)
       |
       v
NestJS 12 REST API (:3000)
  |-- Auth (JWT access, refresh rotation, Argon2id)
  |-- Users / Settings
  |-- Categories
  |-- Activities
  |-- Analytics / Dashboard
  |-- Health, validation, error handling
  |-- JSON request & app logs -> stdout
  |-- OTel traces -> OTLP (when enabled)
  |-- Prometheus metrics -> /metrics (internal only)
       |
       v
Prisma 7 + PostgreSQL 18

Future: Docker container stdout -> Grafana Alloy -> Loki -> Grafana
Future traces: Nest OTel -> Alloy / OTel Collector -> Tempo -> Grafana
Future metrics: Prometheus scrapes Nest /metrics -> Grafana
```

**Important:** Loki is a log backend, not a trace backend. Request duration can be queried from JSON logs in Loki; for true distributed traces, use an OTLP exporter and trace backend such as Tempo (or compatible service). OpenTelemetry traces are not automatically stored in Loki.

Local developer experience must work when OTel/Alloy/Tempo/Loki are NOT installed. Logs to stdout and `/metrics` still function.

### Suggested monorepo layout

```text
growthos/
  AGENTS.md
  GROWTHOS_BLUEPRINT.md
  README.md
  .env.example
  .gitignore
  package.json
  package-lock.json
  compose.yaml
  compose.dev.yaml                  # only if helpful
  .github/workflows/ci.yml
  apps/
    api/
      Dockerfile
      package.json
      prisma/
        schema.prisma
        migrations/
        seed.ts
      src/
        main.ts
        app.module.ts
        common/{dto,filters,guards,interceptors,middleware}
        config/
        telemetry/
        prisma/
        auth/
        users/
        categories/
        activities/
        analytics/
        health/
        metrics/
      test/
    web/
      Dockerfile
      nginx.conf
      package.json
      src/app/
        core/{auth,api,guards,interceptors}
        layout/
        shared/{components,pipes,utils}
        features/{auth,dashboard,activities,categories,settings}
      src/styles.css
  docs/
    api-examples.md
    observability.md
```

Keep code organized without turning a small app into a complicated multi-package architecture. No Kubernetes in MVP.

---

## 6. Database / Prisma data model

Use UUIDs for IDs and proper indexes/foreign keys. Implement with Prisma migrations and database constraints where useful.

### `users`

| column | type | notes |
|---|---|---|
| id | UUID PK | generated |
| email | VARCHAR(254) unique | trim + lowercase at registration, compare consistently |
| display_name | VARCHAR(80) | required |
| password_hash | TEXT | Argon2id, never return |
| created_at | TIMESTAMPTZ | default now |
| updated_at | TIMESTAMPTZ | |

### `user_settings`

| column | type | notes |
|---|---|---|
| user_id | UUID PK, FK users | 1:1 |
| daily_goal_minutes | INTEGER | default 120, valid 1..1440 |
| timezone | VARCHAR(100) | valid IANA zone, default `Asia/Riyadh` |
| week_start | SMALLINT | fixed `1` = Monday for MVP; if customizable, update analytics accordingly |
| updated_at | TIMESTAMPTZ | |

### `categories`

| column | type | notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK users | owner |
| name | VARCHAR(60) | required |
| slug | VARCHAR(80) | normalized; unique per user |
| color | VARCHAR(7) | validated hex `#RRGGBB` |
| icon | VARCHAR(40) | optional known icon name |
| is_archived | BOOLEAN | default false |
| sort_order | INTEGER | default 0 |
| created_at / updated_at | TIMESTAMPTZ | |

Add unique `(user_id, slug)` index. A user cannot edit, delete, or view another user's categories. For a category with historical entries, **archive** rather than hard-delete; preserve analytics.

### `activities`

| column | type | notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK users | owner |
| category_id | UUID FK categories | must belong to same user |
| activity_date | DATE | user-selected logical day |
| title | VARCHAR(120) | 2..120 chars |
| description | TEXT nullable | max 2,000 chars in validation |
| duration_minutes | INTEGER | 1..1440 |
| created_at / updated_at | TIMESTAMPTZ | |

Indexes: `(user_id, activity_date DESC)` and `(user_id, category_id, activity_date DESC)`. Foreign keys and Prisma operations must enforce ownership; do NOT trust submitted `userId` and NEVER accept it in create/update DTOs. Check the category belongs to current user before linking. Validate that activities are not logged for future dates using user's timezone. A user may have multiple activities on the same date.

### `refresh_sessions`

| column | type | notes |
|---|---|---|
| id | UUID PK | JWT jti / session id |
| user_id | UUID FK users | owner |
| refresh_token_hash | TEXT | hashed refresh JWT/token; never raw token |
| expires_at | TIMESTAMPTZ | |
| revoked_at | TIMESTAMPTZ nullable | for logout/revocation |
| created_at | TIMESTAMPTZ | |

Use secure refresh rotation and invalidate the used refresh token. Restrict number of active sessions if easy. Auth sessions should be deleted or expired during cleanup.

**Seed data:** account creation gets default categories and settings in one transaction. Provide a **DEMO SEED** mode with one clearly documented demo user and 90 days of synthetic entries for local development, but NEVER enable or print credentials for that user in production by default. An empty fresh user's dashboard must also work.

---

## 7. REST API contract

Prefix every API route with `/api/v1`. JSON content only. Generate interactive Swagger docs at `/api/docs` in development; in production gate or disable docs via config.

### Response envelope

For normal JSON endpoints:

```json
{
  "success": true,
  "data": { "id": "e930e0fa-78d0-4fbf-b046-63a97fb386e4" },
  "meta": {
    "requestId": "f7bb0d17-a97e-4a08-9fe3-4c25d7f5b3ed",
    "timestamp": "2026-10-13T17:00:00.000Z"
  }
}
```

For errors:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The request contains invalid fields",
    "details": [{ "field": "durationMinutes", "message": "must be between 1 and 1440" }]
  },
  "meta": {
    "requestId": "f7bb0d17-a97e-4a08-9fe3-4c25d7f5b3ed",
    "timestamp": "2026-10-13T17:00:00.000Z"
  }
}
```

Include `X-Request-Id` response header for correlation. Use REST status codes (201 create, 200 fetch/update, 204 delete if envelope omitted on 204, 400 validation, 401 unauthorized, 403 if applicable, 404 not found, 409 conflict, 429 rate-limited, 500 unexpected). Never include stack traces in client error JSON. Pagination metadata should include `page`, `limit`, `total`, `totalPages`.

### Authentication

| Method | Route | Request / outcome |
|---|---|---|
| POST | `/auth/register` | `{email, password, displayName}` -> create account/settings/categories, return user + accessToken, set refresh cookie |
| POST | `/auth/login` | `{email, password}` -> user + accessToken, set refresh cookie |
| POST | `/auth/refresh` | uses refresh HttpOnly cookie -> rotated cookie + new accessToken |
| POST | `/auth/logout` | revoke current refresh session; clear cookie |
| GET | `/auth/me` | bearer access JWT -> safe user/profile fields |

Access JWT TTL ~15 min and stored **in memory** in Angular (not localStorage). Refresh JWT TTL ~7 days, only in an `HttpOnly`, `Secure` in production, `SameSite=Lax` cookie scoped narrowly to refresh/logout path as practical. Prefer same-origin `/api` via Angular dev proxy and nginx production. Handle CSRF with the same-origin strategy, restrictive CORS, SameSite protections and/or CSRF token when cross-site deployment requires it. Rate-limit register/login/refresh; return generic invalid-credentials messages. Logout must work when access token has expired but refresh session exists.

### Categories

| Method | Route | Action |
|---|---|---|
| GET | `/categories` | list current user's categories, optional includeArchived |
| POST | `/categories` | `{name,color,icon?}` create |
| PATCH | `/categories/:id` | rename/recolor/archive/unarchive |

Default categories are ordinary user-owned rows; no shared global IDs. Do not hard-delete categories with activities.

### Activities

| Method | Route | Action |
|---|---|---|
| GET | `/activities?page=1&limit=20&from=2026-10-01&to=2026-10-31&categoryId=...&search=Argo` | filtered pagination |
| GET | `/activities/:id` | fetch owned activity |
| POST | `/activities` | create activity |
| PATCH | `/activities/:id` | update owned activity |
| DELETE | `/activities/:id` | delete owned activity and update analytics |

Example `POST /activities` body:

```json
{
  "activityDate": "2026-10-13",
  "title": "ArgoCD fundamentals",
  "description": "Studied GitOps, sync policies, and Applications for two hours.",
  "categoryId": "d82a2082-69a5-4206-91ae-8d0118f42282",
  "durationMinutes": 120
}
```

Response should return ID, sanitized fields, ISO createdAt/updatedAt and logical activityDate `YYYY-MM-DD` exactly.

### Dashboard and analytics

| Method | Route | Purpose |
|---|---|---|
| GET | `/dashboard/overview?date=2026-10-13` | today/week/month/year cards, streak, active days, time totals, count, comparable change |
| GET | `/analytics/trends?granularity=day&points=30&endDate=2026-10-13&categoryId=...` | missing buckets filled with 0; supported day/week/month/year; cap `points` |
| GET | `/analytics/categories?period=month&date=2026-10-13` | category totals and percentages |
| GET | `/analytics/heatmap?days=90&endDate=2026-10-13` | per-day minutes/activity count |
| GET | `/analytics/activities-summary?from=...&to=...&categoryId=...` | total minutes, activity count, active days for filters |

`GET /dashboard/overview` example shape (numbers are ILLUSTRATIVE only):

```json
{
  "success": true,
  "data": {
    "asOfDate": "2026-10-13",
    "timezone": "Asia/Riyadh",
    "dailyGoalMinutes": 120,
    "today": { "actualMinutes": 12, "goalMinutes": 120, "goalProgressPct": 10, "active": true },
    "week": { "actualMinutes": 300, "goalMinutes": 840, "goalProgressPct": 35.7, "pacePct": 100 },
    "month": { "actualMinutes": 1860, "goalMinutes": 3720, "goalProgressPct": 50, "pacePct": 100 },
    "year": { "actualMinutes": 5000, "goalMinutes": 43800, "goalProgressPct": 11.4, "pacePct": 14.6 },
    "currentActivityStreakDays": 4,
    "monthActiveDays": 10,
    "monthActivityCount": 18,
    "monthTotalMinutes": 1860,
    "timeChangeVsPreviousComparableMonthPct": 14.2
  },
  "meta": { "requestId": "...", "timestamp": "2026-10-13T17:00:00.000Z" }
}
```

The backend MUST compute every field, not the frontend. In implementation and tests, make all numbers internally consistent with actual query data. The illustrative JSON above is a contract sketch and must not be copied as hardcoded values. Swagger response DTOs should document the real contract and nullable comparison.

### User settings / system

| Method | Route | Purpose |
|---|---|---|
| GET | `/users/me/settings` | read settings |
| PATCH | `/users/me/settings` | update display name and settings; no admin/userId parameter |
| GET | `/health/live` | liveness, minimal unauthenticated reply |
| GET | `/health/ready` | readiness, 503 if PostgreSQL unavailable |
| GET | `/metrics` | Prometheus scrape endpoint, INTERNAL ONLY |

Do not wrap native `/metrics` plaintext in JSON, or return a body on 204. These are intentional exceptions to the JSON envelope.

---

## 8. Backend engineering and security

- Nest modules: `AuthModule`, `UsersModule`, `CategoriesModule`, `ActivitiesModule`, `AnalyticsModule`, `PrismaModule`, `HealthModule`, `MetricsModule`, `TelemetryModule` (where needed).
- Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`; validate query params as well as body params.
- Environment configuration validation (DB URL, JWT secrets, cookie settings, allowed origin, metrics/OTLP settings). Fail fast on missing production secrets.
- Use `@nestjs/swagger` for the contract; request and response DTOs.
- Access-token guards on all non-public controllers. Enforce per-user ownership in *database query filters*, not only UI or controller code. Return 404 for other users' resources to avoid enumeration.
- Hash passwords with Argon2id; enforce minimum length (e.g., 12+ characters) and sensible maximum. Never store plaintext or password in logs. Never use dev JWT secret for production.
- Cookie-based refresh rotation with server-side hash, `jti`, expiry and revocation; cover replay and logout in tests.
- Avoid leaking SQL errors/internal details. Sanitize, limit, and paginate API input; cap 100 results per page, 365 points max for daily graph.
- Use Prisma transactions for registration + defaults and for refresh token rotation.
- For user-provided descriptions, render as plain text (Angular interpolation, not unsanitized `innerHTML`).
- Prefer database-side aggregation via Prisma `groupBy` for date, and parameterized raw SQL only where date/week/month grouping is not conveniently supported; never interpolate raw untrusted SQL.
- Use sensible response caching only after basic functionality works; no Redis needed in MVP.

---

## 9. Structured JSON logging, tracing, and metrics

### Structured logging requirements

Every REST request, whether success or failure, should result in **one useful structured request-completed JSON log event** to stdout, including validation errors and auth failures. Add separate business event logs for activity create/update/delete and auth outcomes, without private content. Do NOT expose a verbose internal log object to API consumers; APIs return the response envelope and request ID.

Request log schema:

```json
{
  "timestamp": "2026-10-13T17:00:00.184Z",
  "level": "info",
  "service": "growthos-api",
  "environment": "development",
  "event": "http.request.completed",
  "requestId": "f7bb0d17-a97e-4a08-9fe3-4c25d7f5b3ed",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "spanId": "00f067aa0ba902b7",
  "method": "POST",
  "route": "/api/v1/activities",
  "statusCode": 201,
  "durationMs": 28.4,
  "userId": "6d772e98-3e04-48aa-b8c9-48ce5461b7a9",
  "message": "HTTP request completed"
}
```

`traceId` and `spanId` may be absent/null when tracing is disabled. `userId` may be absent/null for unauthenticated requests. Prefer stable **route templates** such as `/api/v1/activities/:id` instead of ID-filled paths to reduce metric cardinality. For 5xx errors, log a safe error code and stack **server-side only**, with secrets redacted. Include `durationMs` via monotonic clock measurement. Use incoming valid `X-Request-Id` when safe, otherwise generate UUID; return it in `X-Request-Id` header.

**Privacy/redaction:** NEVER log authorization headers, cookies, passwords, refresh/access JWTs, raw request bodies, personal activity descriptions, email addresses, or arbitrary query strings. Redact request headers and sensitive errors. Log broad event names and IDs instead. Do not log duplicate full request/response payloads.

### OpenTelemetry

- Build `telemetry` bootstrap that runs **before application imports** when `OTEL_ENABLED=true`. Use Node SDK and current OpenTelemetry instrumentation conventions for inbound HTTP/Express and PostgreSQL.
- Resource attrs: `service.name=growthos-api`, `service.version`, `deployment.environment.name` (based on current semantic convention support).
- OTLP exporter endpoint is configurable, e.g. `OTEL_EXPORTER_OTLP_ENDPOINT=http://alloy:4318`, with graceful startup when disabled. Prefer documented OTLP/HTTP or gRPC settings with matching ports.
- Propagate trace/span context into Pino logs when tracing is active.
- Keep core HTTP request logging functional if OTLP endpoint is unavailable; telemetry export must not break core requests.

### Prometheus metrics

Expose internally at `/metrics`:
- `http_server_requests_total{method,route,status_code}` counter.
- `http_server_request_duration_seconds_bucket{method,route,...}` histogram, with bounded route/status labels, no userId or raw URL.
- Default Node process metrics from `prom-client`.
- Avoid metric cardinality explosions: **never** label by user, activity title, email, request ID, or category ID.
- Prevent double counting if Pino and metrics middleware are both active.
- Document how to scrape internally; in prod, do not make metrics publicly reachable.

### Future observability (document only; not required to launch MVP)

```text
Docker stdout JSON logs --> Alloy docker/file discovery --> Loki --> Grafana Logs panels
/api /metrics ---------> Prometheus ----------------------> Grafana Metrics panels
OTel traces -----------> Alloy/OTel Collector -----------> Tempo --> Grafana Traces
```

In `docs/observability.md`, give a future example LogQL query concept:

```logql
{service="growthos-api"} | json | event="http.request.completed"
```

And a latency filter concept:

```logql
{service="growthos-api"} | json | event="http.request.completed" | durationMs > 500
```

Exact Loki stream labels will depend on the future Alloy pipeline; ensure sample LogQL and architecture notes explain that they are illustrative until Alloy config exists. Provide actual PromQL examples for RPS, 5xx rate and p95 latency using the metric names implemented.

---

## 10. Frontend implementation expectations

- Angular standalone components, lazy-loaded feature routes, router guards and `HttpClient` interceptors for access token + errors/correlation; use signals for local UI state and RxJS where appropriate.
- Typed API clients/types; derive from OpenAPI or share a lean TypeScript contract, but do not accidentally create two diverging contracts.
- Use Angular reactive forms, meaningful field constraints, and useful inline errors (server remains source of truth).
- Auth: access token in memory; on cold app startup call refresh endpoint to restore session, with a single-flight refresh mechanism for concurrent 401s. If session expired, sign out gracefully; avoid infinite retry loops.
- Same-origin `/api` path via dev proxy; `HttpClient` set credentials only where required for refresh cookie.
- Charts from real API data; wrap chart adapter logic into reusable components.
- UI states: loading, empty, unauthorized, API unavailable, success, field validation, confirm-delete.
- A11y: semantic labels, adequate contrast, keyboard navigation, aria on nav/sidebar and charts with alternative text.
- Format durations as `2h 15m`; store/transmit integer minutes. Tooltips include exact amounts and date.
- Use icons, color coding and consistent category colors without relying only on color to communicate meaning.
- No fake chart data in the production dashboard.

### Copy and UX

Use terms: "Goal progress", "Time invested", "Active streak", "Compared with last month", "Activity logged". Avoid "Your brain is 70% improved" or equally unsupported claims. Always allow a user to understand 50% of WHAT.

---

## 11. Environments, Compose and developer commands

Provide a working, documented simple workflow:

- `.env.example` with `DATABASE_URL`, PostgreSQL vars, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`, `NODE_ENV`, `COOKIE_SECURE`, `OTEL_ENABLED=false`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `METRICS_ENABLED=true`, and appropriate defaults. Do not commit secrets.
- `compose.yaml` launches PostgreSQL, Nest API and production-built Angular/nginx app; real healthchecks; volume persistence; `depends_on` health where useful. Host ports e.g. frontend `8080`, API accessed via frontend proxy, DB optionally host `5432` in dev only.
- One setup command for npm install, one for DB migrations/seed, one for dev frontend/API, and `docker compose up --build` for full stack; implement actual scripts in root `package.json`.
- A developer-friendly `README.md` with prerequisites (Node 24, npm, Docker), local vs Docker setup, env vars, API doc URL, DB migration commands, test commands, demo data seeding, safety note.
- DB migrations are version-controlled. `prisma migrate dev` for local, `prisma migrate deploy` for deployment. Never use `db push` as production migration method.
- Multi-stage Docker builds; non-root runtime user for Nest where possible; proper SIGTERM handling; no secrets baked into images.
- CI GitHub Actions runs install (`npm ci`), lint, typecheck, tests and builds; integration tests use ephemeral PostgreSQL service.

---

## 12. Tests and acceptance criteria

Automated tests **must** cover at minimum:

1. User can register, login, refresh, logout and query `/auth/me`; invalid login returns generic 401.
2. Unauthorized requests to activities/settings/analytics return 401.
3. User A cannot read/edit/delete User B's activity or category; analytics strictly isolate owners.
4. Invalid duration (`0`, negative, `>1440`), future date, missing category, invalid title, malformed UUID, invalid timezone are rejected cleanly.
5. Adding/editing/deleting a 120-minute activity changes all relevant dashboard totals correctly, no stale data.
6. Daily goal of 120 min + activity 12 min => 10% daily goal progress.
7. October full monthly goal with 120 min/day => `31*120=3720` minutes; analytics do not assume 30 days.
8. Leap year and February month length; Monday week rollover; timezone boundaries are handled.
9. Empty account gets zeros and empty buckets, not `NaN`/500.
10. Streak logic: today/yesterday active, missing yesterday, gaps.
11. Comparison when previous period is zero returns null, not Infinity or 100%.
12. Request logging emits a JSON `http.request.completed` record for success, errors, 401 and invalid DTOs; masks secrets and includes duration and correlation ID.
13. `/health/ready` fails when database unavailable; `/metrics` exposes real counter/histogram with bounded labels.
14. API response envelope and `X-Request-Id` are present for normal successful/error API paths.
15. Angular login and add-activity journey works against a **real** API; no production mock data.

### Manual final smoke test

- `docker compose up --build` completes successfully from a clean checkout and documented .env.
- Browser opens login at `http://localhost:8080`; create user, login, configure goal and timezone.
- Add "Learned ArgoCD" for 2h today. Activity appears in history and recent dashboard; total minutes increase by 120 and charts refresh.
- Add an entry for yesterday, confirm heatmap/streak; edit and delete, verify metrics correct.
- Invalid entry displays inline form validation; auth routes remain protected.
- `docker compose logs api` prints parseable structured JSON request logs; `GET /metrics` works inside allowed Docker network.
- README says exactly how to reproduce everything.

**Definition of done:** app runs end-to-end and all implemented functionality uses the database. Do not declare complete when only scaffolding, wireframes, or mock chart data exist. Run commands and report actual results honestly. If environment limitations prevent tests, identify specifically what was not executed.

---

## 13. Suggested Codex implementation order

Implement in this order. Maintain the ability to run/test each vertical slice.

### Phase 1 — Foundation
- Initialize clean monorepo, Angular 22, NestJS 12, Tailwind, PostgreSQL Compose, Prisma 7, config, migrations, formatting, root scripts.
- Add README and `.env.example` immediately.
- Confirm local builds and PostgreSQL connection.

### Phase 2 — Auth and categories
- User registration/login/refresh/logout, JWT guards, secure cookie, settings, category defaults and ownership.
- Build elegant auth screens, app shell/sidebar, loading/error patterns.
- Test security and auth.

### Phase 3 — Activity logging
- CRUD with DTO validation and ownership, proper DATE handling, history pagination/filter, add/edit form.
- End-to-end add/view/edit/delete through Angular.

### Phase 4 — Analytics dashboard
- Define/test backend aggregation and goal formulas first, then build real dashboard UI and charts.
- Test date/timezone, empty state, comparisons and streak.

### Phase 5 — Observability and delivery
- Pino per-request JSON logs; request IDs; global error format; OpenTelemetry opt-in; `/metrics`; health checks.
- Docker production frontend proxy, CI, integration tests, seed/demo instructions, screenshots optional.
- Verify the full acceptance criteria against a running app.

### Phase 2 backlog (NOT in MVP)
- Goal-setting history for prospective-only target changes.
- Monthly reflections/journal entries and manual assessments.
- Optional per-category targets and achievement badges.
- CSV/JSON export/import; user-configurable light mode.
- Grafana/Loki/Alloy/Prometheus/Tempo stack and dashboards.
- Email reminders, mobile PWA/offline sync, GitHub/Jira integrations.

---

## 14. Assumptions and UX decisions to preserve

- The app should be useful with just one user but implement correct multi-user data isolation.
- **Logged time** is not equal to actual skill mastery. MVP measures activity consistency/time investment, not competence.
- Activities can be logged retrospectively but not for future dates.
- Use a **simple goal of minutes per day**; aggregate to week/month/year by actual calendar days. Period percentages cap at 100%; raw minutes don't.
- Progress targets are based on current settings in MVP and historic percentages may change after target edits; disclose this in Settings.
- Dates use timezone-aware logic and PostgreSQL DATE. Times/duration use integer minutes.
- Default timezone: Asia/Riyadh, configurable.
- Default daily goal: 120 minutes, configurable.
- Weekly periods start Monday.
- Base UI in English, no mandatory localization in MVP.
- Loki/Alloy deployment is **future**, but logs and telemetry integrations are prepared now.

---

## 15. Instructions for coding agent

1. Read **all** of this blueprint before writing code.
2. Deliver a real implementation; do not stop after planning or creating placeholders.
3. Follow the phases in Section 13, with tests after each phase, and avoid unnecessary rewrites.
4. Verify version compatibility and use stable packages. Record installed versions in README.
5. Resolve ambiguities with a simple documented decision consistent with MVP scope, rather than blocking for approval.
6. Keep code readable, secure, typed and modular; do not overengineer a simple personal application.
7. Never output/fabricate credentials, telemetry, test passes, or build results.
8. Before final response, actually run available test/build/lint commands, Docker Compose if available, and summarize the evidence.
9. In final response, provide setup commands, URLs, demo seed steps, architecture summary, implemented pages/routes, tests run and any remaining limitations.

