# @voyantjs/workflows-orchestrator-node

Node/Docker runtime primitives for `@voyantjs/workflows-orchestrator`.

This package is the first building block for the Docker/GCE self-host target:

- file-backed `RunRecordStore` for single-node development and early self-host installs
- file-backed snapshot run store for dashboard / self-host HTTP APIs
- Drizzle-backed PostgreSQL snapshot + wakeup stores for Docker/GCE installs
- local scheduler for workflow `schedule` declarations
- run-record snapshot helpers for dashboard-facing local state
- local sleep-alarm manager for `ctx.sleep` wakeups in a single Node process
- lease-based wakeup store + poller primitives for the future multi-process / Postgres-backed adapter
- persistent wakeup manager for file-backed self-host installs
- entry loading + HTTP/SSE server helpers for the Node self-host target
- failed-step resume dispatch for operator dashboards (`POST /api/runs/:id/resume`)
- package-owned Postgres migration runner for Docker/runtime boot flows

It is intentionally smaller than the future full Node adapter. The first goal is
to move Node-specific runtime concerns out of the CLI and into a reusable package.

## Self-host dispatch client

Operator admin processes can use the client helper instead of hand-rolling the
self-host HTTP contract:

```ts
import { createNodeSelfHostWorkflowClient } from "@voyantjs/workflows-orchestrator-node";

const workflows = createNodeSelfHostWorkflowClient({
  baseUrl: process.env.WORKFLOW_SERVER_URL!,
});

const rerun = await workflows.trigger({
  workflowId: "checkout-finalize",
  input,
  tags: ["rerun:true"],
});

const resumed = await workflows.resume(parentRunId, {
  workflowId: "checkout-finalize",
  input,
  resumeFromStep: "issue_invoice",
  seedResults: {
    validate_booking: { ok: true },
  },
  tags: ["resume:true"],
  triggeredByUserId: userId,
});
```

`resume(...)` starts a new run linked to the parent id. When the parent id is a
self-host snapshot id and `seedResults` is omitted, the server derives seed
entries from the parent run's successful journaled steps before the failed step.
When the parent id comes from an external admin recorder such as
`@voyantjs/workflow-runs`, pass `workflowId`, `resumeFromStep`, and
`seedResults` from that recorder's `WorkflowResumeContext`. Seeded steps are
replayed from the journal, so their side effects do not run again.

## Postgres migrations

The PostgreSQL schema for the Node self-host target lives in
[`src/postgres-schema.ts`](./src/postgres-schema.ts) and is versioned
through committed Drizzle migrations in [`drizzle/`](./drizzle).

Apply migrations with:

```bash
DATABASE_URL='<postgres connection string>' \
  pnpm --filter @voyantjs/workflows-orchestrator-node db:migrate
```

Or run the same committed SQL migrations through the runtime-owned helper:

```ts
import { runPostgresMigrations } from "@voyantjs/workflows-orchestrator-node";

await runPostgresMigrations({
  databaseUrl: process.env.DATABASE_URL!,
});
```

Generate a new migration after editing the schema with:

```bash
pnpm --filter @voyantjs/workflows-orchestrator-node db:generate -- --name your_change_name
```

## Integration test

Run the Postgres-backed integration suite with a local database, for example:

```bash
TEST_DATABASE_URL='<postgres test connection string>' \
  pnpm --filter @voyantjs/workflows-orchestrator-node test:integration
```

For a Docker-first reference deployment, use
[`apps/workflows-selfhost-node-server`](../../apps/workflows-selfhost-node-server), which now
includes a multi-stage image, a container entrypoint, and a compose
example that can run these migrations on boot.

The reference HTTP server also exposes `GET /healthz`, `GET /readyz`, and
`GET /metrics`. When PostgreSQL is configured, readiness includes a database
connectivity check. The metrics endpoint emits Prometheus-style gauges for
registered workflows/schedules, persisted runs by status, and persisted wakeups.

Operational notes for single-node and multi-instance Postgres deployments
live in [`docs/selfhost-node-ops.md`](../../docs/selfhost-node-ops.md).
