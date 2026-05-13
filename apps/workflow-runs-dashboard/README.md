# `@voyantjs/workflow-runs-dashboard`

Standalone Vite + React SPA for the workflow_runs admin surface. The reusable
React surface ships from `@voyantjs/workflows-ui`; this app is a thin host
that configures the package against the mounted admin API.
Reads the `/v1/admin/workflow-runs` endpoints exposed by
`@voyantjs/workflow-runs/routes` (mounted in any deployment via
`mountWorkflowRunsAdminRoutes()`).

Distinct from `@voyantjs/workflows-local-dashboard` — that one is
the dashboard for the durable `@voyantjs/workflows` SDK driven by
the orchestrator-node Node server. This one is for the lightweight,
edge-compatible recorder that templates can ship without running a
separate worker process.

## Run against the operator template

```bash
# Terminal 1 — the operator template (has /v1/admin/workflow-runs mounted)
pnpm -F operator dev    # default port: 3300

# Terminal 2 — this dashboard
pnpm -F @voyantjs/workflow-runs-dashboard dev    # default port: 3500
```

Open http://localhost:3500 — the Vite dev server proxies `/api/*`
requests to `http://localhost:3300` so cookies / auth headers flow as
if same-origin.

Trigger a checkout in the operator's storefront
(http://localhost:3300/shop) and you'll see a `checkout-finalize`
run land in the dashboard once `payment.completed` fires
(card webhook → automatic, bank-transfer → admin "Mark payment
received" → automatic).

## Run against a different API target

```bash
VOYANT_API_TARGET=http://127.0.0.1:8787 pnpm -F @voyantjs/workflow-runs-dashboard dev
```

## Deploy standalone (separate origin)

Build with `VITE_API_BASE` pointing at the API:

```bash
VITE_API_BASE=https://operator.example.com pnpm -F @voyantjs/workflow-runs-dashboard build
# Serve dist/ from any static host. The SPA's fetch calls will use
# absolute URLs so CORS + auth need to be configured on the API side.
```

## Deploy same-origin

The `dist/` is a plain static bundle. Drop it into the operator
template's `public/` (or wherever the platform's static assets live)
and route `/admin/workflow-runs/*` to `index.html`. The SPA uses
`createWorkflowRunsApiClient({ apiBase: "/api" })`, so no env var is
needed for the operator template's default API prefix.

## Filtering

The list rail accepts:
- **Workflow** — exact match on `workflowName` (e.g. `checkout-finalize`).
- **Status** — `running` / `succeeded` / `failed` / `cancelled`.
- **Tag** — exact match on a tag string. Convention is
  `<key>:<value>` — e.g. `bookingId:bk_…` to scope to one booking,
  `paymentIntent:bank_transfer` to see all bank-transfer runs.

## What the recorder writes

Every run produces:
- one `workflow_runs` row with the run-level lifecycle (started /
  completed / duration / status / tags / input / result / error)
- one `workflow_run_steps` row per step with the same fields scoped
  to the step.

The recorder is fire-and-forget around the workflow body — DB
errors are logged but the workflow itself keeps running. Drop the
SPA at any time; the recorder writes regardless of whether the
dashboard is open.
