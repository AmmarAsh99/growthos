# API examples

Base URL: `http://localhost:3000/api/v1` for local API, or
`http://localhost:8080/api/v1` through Compose/nginx. Interactive OpenAPI is available
only on the development API at `/api/docs`, and JSON at `/api/docs-json`.
The frontend and server share response contracts in
`apps/api/src/common/contracts.ts`; Angular imports types only.

Registration body (`POST /auth/register`):

```json
{
  "email": "your-address@example.com",
  "password": "your-own-long-password",
  "displayName": "Your name"
}
```

Returns `{success:true,data:{user,accessToken},meta:{requestId,timestamp}}` and an
HttpOnly refresh cookie. Use `Authorization: Bearer <accessToken>` for protected
routes. `POST /auth/refresh` takes the cookie, rotates it, and returns another
access token; a used cookie cannot be replayed. `POST /auth/logout` requires only
the cookie, revokes its session, and clears it. Tokens are never stored in browser
localStorage. Access expires after 15 minutes; refresh after seven days.

Get your categories with `GET /categories`. Create an activity with one of those
IDs, a non-future logical date in your configured timezone, and integer minutes:

```json
{
  "activityDate": "2026-10-13",
  "title": "ArgoCD fundamentals",
  "categoryId": "your-category-uuid",
  "durationMinutes": 120,
  "description": "Practiced GitOps sync and applications."
}
```

Routes:

| Method           | Path                                                          | Purpose                                |
| ---------------- | ------------------------------------------------------------- | -------------------------------------- |
| GET              | `/auth/me`                                                    | Current safe profile and settings      |
| GET/PATCH        | `/users/me/settings`                                          | Goal, display name, IANA timezone      |
| GET/POST         | `/categories`                                                 | List or create categories              |
| PATCH            | `/categories/:id`                                             | Rename, recolor, archive or restore    |
| GET/POST         | `/activities`                                                 | Filtered history or create             |
| GET/PATCH/DELETE | `/activities/:id`                                             | Owned activity                         |
| GET              | `/dashboard/overview?period=month`                            | Goal cards and comparable-period facts |
| GET              | `/analytics/trends?granularity=day&points=30`                 | Zero-filled trend buckets              |
| GET              | `/analytics/categories?period=month`                          | Minutes and percentages by category    |
| GET              | `/analytics/heatmap?days=90`                                  | Per-day minutes and count              |
| GET              | `/analytics/activities-summary?from=2026-10-01&to=2026-10-13` | Totals and active days                 |

History accepts `page`, `limit` (max 100), `search`, `from`, `to`, `categoryId`.
Its `totalMinutes` covers **all filtered rows**, not just the current page.
Analytics accepts `categoryId`; trends support day/week/month/year, at most 365
points. Logical dates never shift when converting between timezones.

All JSON API results use an envelope; validation failures return field details.
Deletes return 204 without a body; `/metrics` is native Prometheus text. User IDs
are derived from access tokens and never accepted from input.

Goal percentage is `100 × min(actualMinutes / (dailyGoal × fullCalendarDays), 1)`.
The denominator is visible in the dashboard. Comparisons use equivalent elapsed
calendar-day windows, clamped to the prior period length. A zero prior denominator
returns null. Streaks can end today or yesterday; older missing days break them.
