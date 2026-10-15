# Codex master build prompt — GrowthOS

You are the senior full-stack engineer responsible for building **GrowthOS** from scratch, end to end, in the current repository.

The complete and authoritative product, engineering, UX, API, database, analytics, security, observability, testing and deployment requirements are in **`GROWTHOS_BLUEPRINT.md`**. Read that file fully before editing the repo and implement it faithfully.

## Non-negotiables

- Angular 22 standalone frontend with TypeScript and Tailwind, modern dark analytics dashboard.
- NestJS 12 REST backend with PostgreSQL 18, Prisma 7 migrations, DTO input validation, Swagger.
- JWT access + rotating refresh token authentication with Argon2id, proper per-user authorization.
- Actual activity logging with user-selected date/category/title/optional description/duration, real persistent database CRUD and history.
- Real backend-calculated daily/weekly/monthly/yearly goal progress and analytics, not invented "personal improvement" numbers. Use formulas, examples and edge cases from blueprint exactly.
- Chart.js + compatible ng2-charts, real backend data, activity heatmap, category breakdown, recent activity and streak.
- Structured JSON request logs with request ID, route, status, latency, optional OTel trace context; `/metrics` Prometheus metrics; opt-in OTel.
- Fully working local dev flow and `docker compose up --build` stack, documentation, tests.

## Working process

1. Inspect the current repository. If empty, scaffold the app structure from the blueprint; if existing, preserve useful work unless it conflicts with the blueprint.
2. Check official compatibility for current stable dependencies. Pin stable versions and lockfile; never use `--force`, beta packages or incompatible peer dependencies.
3. Write a brief execution plan and track progress, **then implement all phases rather than stopping after the plan**.
4. Build in vertical slices: initial environment -> authentication -> activity CRUD -> analytics -> charts -> observability -> Docker/docs/tests.
5. For each feature, build frontend and backend connectivity, not mock components without a server.
6. Write database migrations, secure config validation, seed data only as an explicit optional command, and `.env.example`.
7. Implement required automated tests; run install, lint, typecheck, tests, build and smoke checks in the available environment. Fix real failures before announcing completion.
8. Review OWASP basics, especially refresh session rotation, cookie settings, owner-scoped DB queries, DTO validation, error secrecy and redaction.
9. Use clear folder/module/component names and comment only non-obvious logic.
10. Final output: what works, which commands passed or failed, precise startup commands, how to add activity, where to see JSON logs/metrics, and any limitations.

## Avoid these common mistakes

- Hardcoded or randomly calculated percentages.
- Static/fake production charts and mock HTTP data.
- Assuming every month has 30 days or ignoring leap years/timezones.
- Using JWT localStorage when an in-memory + HttpOnly refresh design was specified.
- Returning passwords/tokens in logs or verbose response errors.
- Treating Loki as an OpenTelemetry trace store.
- Logging only successful requests and forgetting error paths.
- Sending userId from frontend and trusting it for data access.
- Building a beautiful dashboard without functional APIs, or functional APIs without a usable UI.
- Marking unchecked work as complete.

Proceed with implementation now. Read `GROWTHOS_BLUEPRINT.md` before writing code.
