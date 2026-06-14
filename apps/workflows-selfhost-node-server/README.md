# apps/workflows-selfhost-node-server

Reference Node/Docker self-host server for Voyant Workflows.

This target is the Node-only counterpart to
[`apps/workflows-selfhost-cloudflare-worker`](../selfhost-cloudflare-worker). It
runs the workflow bundle in-process, persists dashboard-facing run
snapshots on local disk, and exposes the same `/api/runs/*` HTTP
surface used by the local dashboard.

## What you get

- One Node process hosting the public orchestration API and tenant-side
  step execution.
- File-backed run snapshots under `.voyant/runs/` by default, or
  Drizzle/Postgres-backed state when `DATABASE_URL` is set.
- In-process scheduling and lease-polled persistent `ctx.sleep` wakeups.
- No Cloudflare runtime requirements.
- Early failure on bad startup config: missing workflow bundle, invalid
  static dir, or a bundle that registers no workflows.

## Start

```bash
# 1. Build the self-host app runtime.
pnpm --filter @voyant-travel/workflows-selfhost-node-server build

# 2. Build + stage your workflow bundle for the Docker target.
voyant workflows deploy --target docker --file ./src/workflows.ts

# 3. If you are using PostgreSQL, apply the committed migrations.
DATABASE_URL='<postgres connection string>' \
  pnpm --filter @voyant-travel/workflows-selfhost-node-server migrate:runtime

# 4. Start the self-host server.
pnpm --filter @voyant-travel/workflows-selfhost-node-server start -- --file ./dist/bundle.mjs
```

By default the server listens on `127.0.0.1:3232`.

Supported flags:

- `--file <path>` or `VOYANT_ENTRY_FILE`
- `--host <host>` or `HOST`
- `--port <port>` or `PORT`
- `--static-dir <path>` or `VOYANT_STATIC_DIR`
- `--database-url <url>` or `DATABASE_URL`
- `--cache-bust-entry`

The CLI flags intentionally cover only entry loading, HTTP binding, static
assets, and storage. Workflows that call `ctx.services.resolve(...)` need a
host-provided service resolver. For those, either start the server from code
with `startNodeSelfHostServer({ services })`, or prefer the app-integrated
Node path with `createApp({ workflows: { driver: () =>
createNodeStandaloneDriver({ db }) } })`. See
[`@voyant-travel/workflows-orchestrator-node`](../../packages/workflows-orchestrator-node/README.md#service-backed-package-workflows)
for an example using the promotions catalog reindex workflow.

Operational endpoints:

- `GET /healthz` for liveness
- `GET /readyz` for readiness
- `GET /metrics` for Prometheus-style gauges

When PostgreSQL is configured, `/readyz` also checks database connectivity.
`/metrics` reports registered workflows/schedules, persisted run counts by
status, and persisted wakeup count.

## Docker

The Node self-host target now includes a reference container flow:

- [Dockerfile](./Dockerfile)
- [docker-compose.yml](./docker-compose.yml)
- [docker-entrypoint.sh](./scripts/docker-entrypoint.sh)

The container entrypoint waits for PostgreSQL when `DATABASE_URL` is set,
applies the committed Drizzle migrations by default, and then starts the
HTTP server. The runtime image is now a multi-stage build that copies a
deployed app tree into `/app`, so the container no longer depends on
workspace `pnpm` commands at boot.

Build the workflow bundle on the host first so the container can mount it:

```bash
voyant workflows deploy --target docker --file ./examples/basic-workflows.ts
voyant workflows deploy --target docker --file ./examples/basic-workflows.ts --apply
```

That deploy command now does two staging steps for the Docker target:

- copies the built bundle to `apps/workflows-selfhost-node-server/dist/bundle.mjs`
- writes a compose env file to
  `apps/workflows-selfhost-node-server/dist/selfhost.env`

`--apply` uses that generated env file automatically.

Before applying, you can validate the staged target:

```bash
voyant workflows doctor --target docker
voyant workflows doctor --target docker --check-docker
```

That compose file mounts `./apps/workflows-selfhost-node-server/dist/bundle.mjs` into
the container at `/app/workflows/bundle.mjs` and exposes the server on
`0.0.0.0:3232`.

`--apply` wraps:

```bash
docker compose \
  --env-file apps/workflows-selfhost-node-server/dist/selfhost.env \
  -f apps/workflows-selfhost-node-server/docker-compose.yml \
  up --build -d
```

The bundled example workflow is defined in
[examples/basic-workflows.ts](./examples/basic-workflows.ts) and registers a
single `docker-hello` workflow for smoke tests.

Useful container env vars:

- `VOYANT_ENTRY_FILE`
- `VOYANT_DATABASE_URL`
- `VOYANT_HOST_PORT=3233`
- `VOYANT_BIND_HOST=0.0.0.0`
- `VOYANT_BIND_PORT=3232`
- `VOYANT_SKIP_MIGRATIONS=1`
- `VOYANT_DATABASE_WAIT_SECONDS=30`

You can override those from the CLI when staging the Docker target:

```bash
voyant workflows deploy \
  --target docker \
  --file ./examples/basic-workflows.ts \
  --host-port 4321 \
  --database-url '<postgres connection string>' \
  --skip-migrations
```

For multi-instance rollouts, disable boot-time migrations on the app
containers and run them once as a separate release step. See
[`docs/selfhost-node-ops.md`](../../docs/selfhost-node-ops.md).

## Postgres mode

When `DATABASE_URL` is present, the server switches from file-backed
stores to Drizzle-backed PostgreSQL tables:

- `voyant_snapshot_runs`
- `voyant_wakeups`

Schema changes now go through committed Drizzle migrations in
[`packages/workflows-orchestrator-node/drizzle`](../../packages/workflows-orchestrator-node/drizzle).
Apply them before starting the server:

```bash
DATABASE_URL='<postgres connection string>' \
  pnpm --filter @voyant-travel/workflows-selfhost-node-server migrate:runtime
```

To generate a new migration after changing
[`packages/workflows-orchestrator-node/src/postgres-schema.ts`](../../packages/workflows-orchestrator-node/src/postgres-schema.ts):

```bash
pnpm --filter @voyant-travel/workflows-orchestrator-node db:generate -- --name your_change_name
```

## Status

This app is still a reference runtime surface, not the final production
adapter. The change here is that Docker/GCE now has a real boot path:

- file-backed mode remains useful for local installs
- Postgres mode is the intended Docker/GCE backend
- the next hardening step is broader productionization, not basic startup
