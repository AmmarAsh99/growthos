# Repository instructions for coding agents

GrowthOS is specified in `GROWTHOS_BLUEPRINT.md`. All work must conform to that document. The recommended initial agent task is in `CODEX_BUILD_PROMPT.md`.

- Work in complete, testable vertical slices; do not stop at mockups or scaffolding.
- Favor a small maintainable monorepo (`apps/web`, `apps/api`).
- Keep Angular/Nest/Prisma dependencies compatible and stable, with a lockfile.
- Use secure per-user scoping, DTO validation, and consistent API envelope.
- Never fabricate goal progress or activity data; metrics must use actual database entries.
- Date is a user-local logical `YYYY-MM-DD` date; duration is integer minutes.
- Log every HTTP completion with structured JSON and latency, but never sensitive bodies, auth secrets or descriptions.
- Never enable public `/metrics`, `/api/docs` or demo credentials unintentionally in production.
- Include real tests and document commands performed/results in the final report.
