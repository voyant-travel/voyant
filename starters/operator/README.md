# Operator Starter

The Voyant starter for tour operators. A resident **Node** process that serves
the `/v1/*` API and SSR dashboard, with Voyant Workflows as the default durable
task runtime.

Node is the first-class production target for the operator: the composed graph is
built once and reused for the process lifetime, avoiding the per-request graph
evaluation that makes Cloudflare Workers unsuitable for a composed operator API.
See [docs/architecture/deployment-targets.md](../../docs/architecture/deployment-targets.md)
(voyant#2966).

## Stack

- **Runtime**: Node (resident process — e.g. Cloud Run), booted by the
  `createVoyantProjectServerEntry` host from `@voyant-travel/runtime`
- **Framework**: TanStack Start + React 19 (Vite build, no `@cloudflare/vite-plugin`)
- **UI**: Shared `@voyant-travel/ui` components and styles + Tailwind CSS v4
- **DB**: Postgres via pooled node-postgres (`DATABASE_URL_DIRECT`, the Node
  production default); neon-http/WS remain fallback adapters
- **Auth**: Better Auth
- **Jobs**: Voyant Workflows

## Quick start

```bash
cp .env.example .env          # fill in DATABASE_URL, BETTER_AUTH_SECRET, …
pnpm -F operator dev          # Voyant development server + SSR (port 3300)
pnpm -F operator dev:worker   # Voyant Workflows dev loop (port 3310)
```

## Project customization

Add project-owned behavior under `src/api/admin`, `src/api/public`,
`src/workflows`, `src/jobs`, `src/subscribers`, and `src/links`. Each directory
contains the exact file convention and a minimal example. `voyant build`
discovers these files and emits the corresponding static graph entries; no
central registration file is required.

The Voyant CLI loads `.env` for local lifecycle commands while preserving
platform environment variables as authoritative in deployed environments. `pnpm dev` serves
the SSR dashboard, the `/api/*` routes, and Better Auth with hot-reload — the
same `src/server.ts` handler runs under Vite's dev server. The first `/api/*`
request compiles the API module graph on demand (a few seconds), then it's warm.

When the project needs additional Vite plugins or ordinary Vite options, add an
optional root `vite.config.ts`. `voyant develop` and `voyant build` discover and
merge it automatically; do not copy or replace Voyant's generated configuration
under `.voyant/`.

## Production (Node)

```bash
pnpm -F operator build        # complete graph, client, and Node server build
pnpm -F operator start        # starts the built Node application (PORT defaults to 8080)
```

The server exposes `/healthz` (probe), `/__voyant/scheduled?schedule=<id>` (the
Cloud Scheduler hook, origin-trust gated), and serves the client build. Scheduled
jobs come from the admitted graph. Provision them through deployment tooling
using `renderGoogleCloudSchedulerScript` from `@voyant-travel/framework/node-host`.

## Optional Cloud Services

Local and self-hosted deployments can run without a Voyant Cloud API key. Leave
`VOYANT_API_KEY` unset unless you want Cloud-backed notifications, realtime, or
Vault KMS.

Cloud-backed legal PDF rendering and finance FX lookup are configured
separately:

```bash
# Styled legal/invoice PDF rendering. Omit for the local basic PDF fallback.
VOYANT_CLOUD_PDF_API_KEY="vc_..."

# Hosted Voyant Data FX lookup for finance invoice/payment rates.
VOYANT_DATA_API_KEY="vd_..."
```

In `VOYANT_ADMIN_AUTH_MODE="voyant-cloud"` deployments, `VOYANT_API_KEY` remains
a legacy fallback for both of those specialized keys.

## Database

Selected packages own and publish their migration histories. The project graph
orders those package migrations and the Node runner applies them:

```bash
pnpm -F operator db:migrate
```

Project-local modules keep schema and migrations together under
`src/modules/<name>/`; generate those migrations with the module's ORM tooling
and admit that module-scoped folder through `voyant.config.ts`. Reusable plugins
ship their own migration history. `voyant migrate` applies the resolved plan but
never generates SQL. The starter does not maintain an aggregate Drizzle schema
or copy framework migrations.

## Deploy

The operator is a resident Node process. Run the built server directly on any
host (a VM, a container, Cloud Run), or use the reference `Dockerfile`.

```bash
pnpm -F operator build            # dist/client + dist/server/server.js
PORT=8080 pnpm -F operator start  # node dist/server/server.js
```

### Container image

`Dockerfile` is a multi-stage pnpm-monorepo build. Build it **from the repo
root** (it needs the workspace source):

```bash
docker build -f starters/operator/Dockerfile -t voyant-operator .
docker run --rm -p 8080:8080 --env-file starters/operator/.env voyant-operator
```

The `@voyant-travel/*` packages are bundled into the server bundle; the runtime
image ships the operator's production `node_modules` (via `pnpm deploy --prod`).

### Cloud Run

Node is the first-class target — keep the service **warm** (`--min-instances=1`)
so the composed graph stays resident. Env/secrets come from the platform (no
`.env` in the image).

```bash
# Build + push, from the repo root (custom Dockerfile path, so build locally and
# push — or run the same `docker build` inside a Cloud Build `--config` step):
IMAGE=REGION-docker.pkg.dev/PROJECT/voyant/operator
docker build -f starters/operator/Dockerfile -t "$IMAGE" .
docker push "$IMAGE"

# Deploy (secrets via Secret Manager; DATABASE_URL_DIRECT = the pooled Node lane):
gcloud run deploy operator \
  --image="$IMAGE" \
  --region=REGION --port=8080 --min-instances=1 --cpu-boost \
  --set-env-vars="APP_URL=https://operator.example/api,DASH_BASE_URL=https://operator.example,VOYANT_ADMIN_AUTH_MODE=local" \
  --set-secrets="DATABASE_URL_DIRECT=operator-db-direct:latest,BETTER_AUTH_SECRET=operator-auth:latest,SESSION_CLAIMS_SECRET=operator-session:latest,INTERNAL_API_KEY=operator-internal-key:latest,ORIGIN_TRUST_SECRET=operator-origin-trust:latest"
```

`/healthz` is the container/liveness probe. Set `ORIGIN_TRUST_SECRET` when a
dispatcher fronts the service (it stamps `x-voyant-origin-trust`; `/healthz` is
exempt). Crons don't run in-process. Deployment tooling derives Cloud Scheduler
jobs from the admitted graph and POSTs `/__voyant/scheduled?schedule=…`. See
[docs/architecture/deployment-targets.md](../../docs/architecture/deployment-targets.md).

## Routes

Standard frontend routes are emitted from package-owned contributions into the
gitignored `.voyant/routes` directory. TanStack's generated route tree also
lives under `.voyant`; neither is application-authored source. Project-specific
admin and public API routes belong in `src/api/admin` and `src/api/public`.
Repository verification also writes disposable TypeScript, ambient binding,
Vite, and Vitest metadata there; do not copy those generated files back to the
project root.

- `/v1/admin/*` — staff-facing API (requires `staff` actor)
- `/v1/public/*` — customer/partner/supplier API
- `/api/auth/*` — Better Auth handler
- `/*` — TanStack Start SSR dashboard
- `/healthz` — liveness probe (Node runtime)
- `/__voyant/scheduled?schedule=<id>` — Cloud Scheduler hook (origin-trust gated)

## External cruise adapters

External cruise inventory (any upstream — Voyant Connect is just one option) is
wired in **one place**: `src/api/lib/cruise-adapters-runtime.ts`. Add your
connector's `CruiseAdapter` to `configuredCruiseAdapters`:

```ts
import { createMyCruiseAdapter } from "my-cruise-connector"

export function configuredCruiseAdapters(env: CruiseAdapterEnv): CruiseAdapter[] {
  if (!_configured) {
    const adapters: CruiseAdapter[] = []
    adapters.push(createMyCruiseAdapter({ token: env.MY_CRUISE_ADAPTER_TOKEN }))
    _configured = adapters
  }
  return _configured
}
```

That single registration reaches every path: a cruise adapter is registered into
both the **vertical** registry (admin/public external cruise detail, refresh,
detach, external booking — `cruiseAdminRoutes` / `cruisePublicRoutes`, mounted at
`/v1/{admin,public}/cruises`) and the **catalog** `SourceAdapterRegistry` (content,
discovery/sync, snapshot capture, booking-engine sourced inventory). The same seam
runs in the live API and the external-cruise-refresh workflow. Bulk source sync is
an operational command composed from the selected deployment graph; it is not
implemented inside the standard project starter.

Owned adapters are wrapped with a short-TTL read cache (`memoizeCruiseAdapter`,
60s) automatically — push the **raw** adapter, don't pre-wrap. Repeated
detail/sailing/ship reads within an isolate then skip the upstream call (listings
stay live). Voyant Connect cruise reads are cached upstream in the plugin.

Missing config is a no-op — with no connector and Voyant Connect unconfigured,
external cruise reads return a clean `adapter_not_registered`, never a boot
failure. Voyant Connect cruise sources, when configured, are back-filled into the
vertical registry automatically (no manual entry needed). See
`docs/architecture/cruises-module.md` §10 for the adapter contract.

## Operator Shell

The workspace shell uses the shared `OperatorAdminWorkspaceLayout`. Operators
can collapse or expand the sidebar from the header trigger, or with `Cmd+B` on
macOS and `Ctrl+B` on Windows and Linux.

Use `OperatorAdminPageShell` from `@voyant-travel/admin` for route-level chrome:
breadcrumbs, page actions, and the padded page body. When a route adopts the
page shell, pass `showSidebarTrigger={false}` to `OperatorAdminWorkspaceLayout`
so the shell owns the only visible route header. Pass `padded={false}` to the
page shell for full-bleed operator tools that own their own spacing.

Route-level browser titles are auto-derived from the shared navigation items
and active locale. Override detail pages that need entity-specific metadata
with `useAdminPageHead({ title, description })` from `@voyant-travel/admin`. The
root document also sets `robots: noindex,nofollow`; keep operator deployments
out of search indexes.

## Charts

The dashboard uses `recharts` through `@voyant-travel/ui` and `@voyant-travel/admin`.
If chart cards render headers with blank bodies, run `pnpm -r why recharts`
and confirm the app resolves a single `recharts` version. Add a workspace
override only if a downstream dependency forces a second copy.

## License

Apache-2.0
