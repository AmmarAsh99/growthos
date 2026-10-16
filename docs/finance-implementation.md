# Finance and redesign implementation

## Phases

1. Inspect existing application and preserve activity/auth flows.
2. Add shared light/dark/system design tokens, responsive navigation and charts.
3. Add additive finance migration, owned ledger, monthly snapshots and validated APIs.
4. Build finance overview, transactions, budgets, income/transfer entry and reports.
5. Verify arithmetic, ownership, API integration, themes, responsive journeys and builds.

## Accounting decisions

- SAR amounts are integer halalas in the database/API. UI decimal strings are parsed without floating-point multiplication.
- Salary is a plan; actual income must be recorded. Transfers are recorded separately and never included in consumption expenses. Net cash flow is actual income minus expenses; unallocated cash additionally subtracts transfers.
- The first plan defaults to 13,200 SAR with the requested six allocations. A month's snapshot copies the latest earlier saved snapshot, or defaults if none exists. Future plan edits never rewrite earlier months. Closed months cannot be edited; historical transactions can still be corrected.
- Category limits are sublimits, not additional allocations. Categories map to envelopes explicitly; selecting another envelope on a transaction is an intentional override.
- Recurring frequency is descriptive metadata on actual payments. No scheduler or automatic duplicate payments.
- Forecasts use elapsed calendar days, including zero-entry days, and are estimates. Future months have no forecast; closed months show final actuals. Logging coverage is disclosed, never inferred as complete.
- Finance uses Asia/Riyadh logical dates. No external AI service, new package, or new required container environment variable is needed.
- Deployment requires rebuilding API/web images and applying the additive Prisma migration before starting the new API.

## Validation

Validation results are recorded below after execution.

Verified on 2026-10-16:

- `prisma validate` and `prisma generate`: passed.
- `prisma migrate deploy`: both initial and finance migrations applied to an isolated test database.
- `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`: no schema drift.
- API TypeScript build/typecheck and Angular production build/template typecheck: passed.
- ESLint (`apps --max-warnings 0`): passed.
- Unit tests: 18 passed (activity/date regressions, finance arithmetic/forecasts/reports, SAR parsing).
- Real PostgreSQL integration tests: 16 passed, including the existing auth/activity/readiness/OTel tests and the finance suite.
- Playwright: both real-API journeys passed, including activity CRUD, expense CRUD, income/transfer entry, budgets, reports, persisted light/dark/system modes and mobile finance pages. No browser runtime errors.
- The opt-in activity/finance seed ran successfully against a separate new demo account in the test database.
- Prettier passes for implementation files. Repository-wide formatting still flags the five pre-existing edited Kubernetes YAML files; those files were not reformatted as part of this feature.
- `git diff --check`: passed.

Docker image/Compose execution could not be verified: Docker Desktop failed while initializing
its inference-service socket. The fallback tests used a real isolated PostgreSQL 18.4 server,
bound to localhost:55432, from temporary binaries under ignored `.tools`. The temporary binary
packaging has a beta-tagged wrapper version; the PostgreSQL engine is stable 18.4. This is not an
application dependency. API, web and migration images still need rebuilding and deployment.

## Using finance

Open Finance Dashboard after signing in. Open Budgets to edit the selected month's salary,
envelopes, category defaults/sublimits and utilization warning threshold (80% initially).
The salary and all six allocations must reconcile exactly. Food defaults to Healthy food;
Gaming, Shopping and Entertainment share General monthly spending. Custom envelopes are supported.

Add Expense supports four entry choices: normal expense, recurring expense, actual savings/emergency
transfer, or received income. Recurring entries are actual payments with frequency metadata, not
scheduled future payments. Transactions supports filtering, sorting, pagination, full filtered
totals, editing and confirmed deletion. Changing the transaction date requires an envelope from
that new month. Old transaction corrections recalculate old reports while preserving their budgets.

Monthly Reports are calculated on demand, not stored stale summaries. The report distinguishes
recorded income, consumption, net cash flow, savings transfers, emergency transfers and cash after
transfers. A month is Excellent when all envelope/category budgets are respected and both transfer
targets are achieved; Good permits at most 5% consumption-budget overrun and at most 5% category
sublimit overruns, with transfer targets achieved. Otherwise it Needs Attention. Current/future
reports are provisional, and missing transaction records can change any assessment. Comparisons
use the previous full month and say so for partial months.

Forecast money is calculated with integer/BigInt arithmetic and rounded to the nearest halalah.
Percentages and SAR display formatting are presentation calculations. Forecasts include all elapsed
calendar days, not just transaction dates. Fewer than seven elapsed days or fewer than three logged
dates is limited data. Projected exhaustion becomes Critical only with at least seven elapsed days
and three recorded dates in that envelope; actual overspending is always Critical. Category limits
are checked separately without adding them to envelope allocations. The daily chart category filter
does not change headline balances or the overall projection.

## API

Every endpoint below uses the existing bearer JWT guard, owner scoping, response envelope, request
IDs, structured completion logs, latency metrics and optional OTel tracing. Descriptions, merchants,
notes, tokens and request bodies are excluded from logs. All money fields ending in `Halalas` are
integers: `50000` means SAR 500.00. Transactions accept actual logical dates (2000–2099, no future dates).

| Method             | `/api/v1` path                                                                 | Purpose                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| GET                | `/finance/categories`                                                          | Initialize/list the account's finance categories                                                             |
| GET / PUT          | `/finance/budget?month=YYYY-MM`                                                | Read or replace a monthly plan; PUT validates reconciliation                                                 |
| GET                | `/finance/summary?month=YYYY-MM&period=day\|week\|month\|year&date=YYYY-MM-DD` | Overview, period totals, daily/category/year charts, forecasts and alerts                                    |
| GET                | `/finance/report?month=YYYY-MM`                                                | Historical report and underlying financial totals                                                            |
| GET                | `/finance/transactions`                                                        | Filters: from/to, search, categoryId, envelopeId, kind; sort=date/amountHalalas, order=asc/desc, page, limit |
| GET / PUT / DELETE | `/finance/transactions/:id`                                                    | View, replace or delete an owned transaction                                                                 |
| POST               | `/finance/transactions`                                                        | Record an actual expense, income or transfer                                                                 |

Example expense body (use IDs returned by your own categories and monthly budget):

```json
{
  "kind": "expense",
  "amountHalalas": 50000,
  "date": "2026-10-16",
  "categoryId": "YOUR_SHOPPING_CATEGORY_UUID",
  "envelopeId": "YOUR_OCTOBER_GENERAL_ENVELOPE_UUID",
  "description": "Bought new clothes"
}
```

`time` (HH:mm), `notes`, `merchant`, and `frequency` (weekly/monthly/yearly) are optional.
Income has no category/envelope. Transfers reference savings or emergency envelopes and have no
expense category. PUT supplies the complete transaction, so omitted optional fields are cleared.

## Run locally

Use Node 24.15+ (tested with 24.21), with the existing lockfile:

```powershell
npm.cmd ci
npm.cmd run setup
docker compose -f compose.dev.yaml up -d
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run dev
```

Open http://localhost:4200. `DATABASE_URL` must point to that local development database, and
`CORS_ORIGIN` must match the browser origin. Existing authentication/environment rules still apply.
Alternatively `docker compose up --build -d` runs the migration service and serves http://localhost:8080.
There are **no new required environment variables**, no AI API keys, and no new runtime packages.

For Kubernetes, build/publish all three images using the existing workflow, update their image tags
in your manifests, then recreate the completed migration Job with the new migration image:

```powershell
kubectl delete job db-push -n growthos --ignore-not-found
kubectl apply -f k8s/job.yaml -n growthos
kubectl wait --for=condition=complete job/db-push -n growthos --timeout=180s
kubectl apply -f k8s/growthos-api.yaml -f k8s/growthos-web.yaml -n growthos
kubectl rollout status deployment/growthos-api-deployment -n growthos
kubectl rollout status deployment/growthos-web-deployment -n growthos
```

The Job runs `prisma migrate deploy`, not `db push`. No reset or PVC deletion is needed. Your live
cluster and existing Secret values were not changed by this implementation.

## Demo and tests

The existing opt-in demo seed now creates finance transactions only for a newly created demo
account. Every demo transaction is labeled DEMO. An existing email is rejected; production mode
is rejected. Use a dedicated local database, `DEMO_SEED=true`, and your own `DEMO_EMAIL` and
`DEMO_PASSWORD`, then `npm.cmd run db:seed`. These are existing optional seed variables, not new
container requirements. Normal accounts start with plans and zero ledger entries.

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
# TEST_DATABASE_URL must point to a separately migrated database ending in _test.
npm.cmd run test:integration
# Run the app against that test database first; E2E_BASE_URL selects its web origin.
npm.cmd run test:e2e
```

Browser tests use the real API and database, no mocked finance values. Screenshots are written to
`test-results/finance-{light,dark}-{desktop,mobile}.png`.
