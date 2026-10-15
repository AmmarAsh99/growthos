# Observability

Every completed HTTP request emits one Pino JSON `http.request.completed` event,
including validation failures and unauthorized requests. It includes UTC timestamp,
service/environment, safe correlation ID, method, route template, status, duration
measured with a monotonic clock, and authenticated user ID when available. Business
events record only event names and IDs. No bodies, arbitrary query strings, email,
descriptions, cookies, authorization headers, or tokens are logged. Error stacks
contain call frames only, without unsafe error messages. `X-Request-Id` is returned
on success and error responses. Incoming IDs are limited to 8–80 safe characters.

```sh
docker compose logs -f api
docker compose exec api node -e "fetch('http://localhost:3000/metrics').then(r=>r.text()).then(console.log)"
```

The API has no host port in Compose. nginx rejects `/metrics` and `/api/docs`.
In production Swagger is not registered at all. A scraper on the private Compose
network can use `http://api:3000/metrics`. Set `METRICS_ENABLED=false` to disable it.
Never expose the API port directly on a public interface. Local development exposes
port 3000; use local development only on a trusted machine.

Metrics:

```promql
# Requests per second
sum(rate(http_server_requests_total[5m]))

# Fraction of requests returning 5xx
sum(rate(http_server_requests_total{status_code=~"5.."}[5m]))
  / clamp_min(sum(rate(http_server_requests_total[5m])), 0.000001)

# p95 latency, seconds, by route
histogram_quantile(0.95,
  sum by (le, route) (rate(http_server_request_duration_seconds_bucket[5m])))
```

Labels are bounded method, route template, and status code. Unmatched paths use
`unmatched`; there are no user, category, request ID, title, or raw URL labels.
Default Node process metrics are registered in the same registry.

`GET /api/v1/health/live` checks the process; `/api/v1/health/ready` runs `SELECT 1`
and returns 503 on database failure. Health checks also produce request logs.

## Optional traces

`OTEL_ENABLED=false` is the default and requires no collector. When enabled, the
Node SDK initializes before application imports. HTTP/Express/PostgreSQL
instrumentations export OTLP/HTTP traces to
`OTEL_EXPORTER_OTLP_ENDPOINT` + `/v1/traces` (default port 4318). Resource attributes
include `service.name=growthos-api`, service version and deployment environment.
Pino attaches active trace/span IDs. Export failure must not interrupt requests.
Do not enable enhanced PostgreSQL parameter reporting. Keep collectors private.

## Future Grafana setup (not needed to run GrowthOS)

```text
Docker JSON stdout -> Alloy discovery -> Loki -> Grafana logs
API /metrics       -> Prometheus      -> Grafana metrics
OTel OTLP traces   -> Alloy/Collector -> Tempo -> Grafana traces
```

Loki is a log store, not a distributed trace backend. These LogQL queries are
illustrative until an Alloy pipeline assigns the `service` stream label:

```logql
{service="growthos-api"} | json | event="http.request.completed"
{service="growthos-api"} | json | event="http.request.completed" | durationMs > 500
```
