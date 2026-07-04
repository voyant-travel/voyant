# Workflows Runtime Architecture

Status: accepted, updated 2026-06.

Voyant workflows are node-only. The runtime no longer has a Cloudflare edge
lane plus a separate Node lane. Workflow definitions execute in a Node runtime
for both self-host and managed Cloud deployments.

## Current Model

`@voyant-travel/workflows` is the authoring SDK and execution protocol. It
still accepts `defaultRuntime: "node"` and step-level `runtime: "node"` as
compatibility annotations, but those fields do not select a lane. Any legacy
`runtime: "edge"` value is rejected.

The supported deployment shapes are:

- **Self-host**: `@voyant-travel/workflows-orchestrator/selfhost` runs the
  orchestrator, workflow bodies, manifest store, schedules, wakeups, and admin
  reads against Postgres.
- **Managed Cloud**: app bundles use `@voyant-travel/workflows/client` and
  `createCloudWorkflowDriver(...)` to forward trigger/event calls to Voyant
  Cloud. Workflow bundles execute in the hosted Node runner implementation in
  `/Users/mihai/builds/internal/voyant-all/voyant-cloud`.

Cloudflare Workers may still host application/API code, but the workflow
runtime itself is Node-only. The old Cloudflare Worker/Durable Object workflow
adapter, tenant-worker adapter, and external step-server package have been
removed from the workspace package surface.

## Evidence From `voyant-cloud`

The current Cloud source shows the hosted workflow runtime as a Node runner:

- `docs/cloud/workflows-hosted-runtime-plan.md` describes workflow bundle
  execution in hosted Node runners and explicitly avoids per-step lane
  selection.
- `apps/workflow-node-runner/src/server.ts` and
  `apps/workflow-node-runner/src/execution-worker.ts` implement the execution
  service.
- `apps/api/src/platform/workflow-runner-dispatch.ts` dispatches runs to that
  Node runner service.
- `apps/api/src/routes/internal-workflows.ts` exposes the internal API used by
  the runner/control plane.
- `packages/db/src/schema/workflows.ts` stores hosted workflow metadata and run
  state.

Inference from those sources: Cloudflare remains relevant to the product
platform, but hosted workflow execution itself is Node-only.

## Package Roles

`@voyant-travel/workflows` owns:

- workflow declaration and registry APIs,
- manifest/event-filter protocol types,
- the step handler and executor,
- the app-safe Cloud client under `@voyant-travel/workflows/client`.

`@voyant-travel/workflows-orchestrator` owns the state machine, event routing,
dispatch contracts, compliance tests, and the supported Postgres self-host
runtime. Self-host runtime imports use `@voyant-travel/workflows-orchestrator/selfhost`,
which uses Postgres for run records, wakeups, manifests, schedules, and admin
queries.

## Application Wiring

Self-host apps wire the Postgres driver:

```ts
createApp({
  workflows: {
    driver: () => createStandaloneDriver({ db }),
  },
})
```

Cloud-hosted or Cloud-connected apps forward to the managed Cloud API:

```ts
createApp({
  workflows: {
    driver: () =>
      createCloudWorkflowDriver({
        env: {
          VOYANT_CLOUD_WORKFLOWS_URL: env.VOYANT_CLOUD_WORKFLOWS_URL,
          VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN: env.VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN,
          VOYANT_CLOUD_APP_SLUG: env.VOYANT_CLOUD_APP_SLUG,
          VOYANT_CLOUD_ENVIRONMENT: env.VOYANT_CLOUD_ENVIRONMENT,
        },
      }),
  },
})
```

The `workflows` option remains explicit. Avoid environment probing that silently
switches drivers.

## Bundle Bootstrap Contract

Detached workflow bundles may need process-local runtime dependencies that are
normally assembled by the application host, such as a database client or an
adapter registry. Those dependencies must be wired by the workflow bundle, not
by HTTP middleware, because hosted runners import the workflow bundle without
booting the app server.

A workflow entry may export a well-known bootstrap function:

```ts
export function bootstrapWorkflowBundle(ctx: { env: NodeJS.ProcessEnv }) {
  // Construct process-local workflow dependencies from ctx.env / process.env.
}
```

Node runners call `bootstrapWorkflowBundle({ env: process.env })` after
importing the bundle and before executing any workflow step. The bootstrap must
be idempotent and process-local: it may cache clients/registries for the worker
process, but it must not depend on request context or app middleware.

The operator starter uses this contract to wire channel-push workflow deps from
`DATABASE_URL` and the booking-engine adapter registry. Channel-push workflow
registration is opt-in through
`@voyant-travel/distribution/channel-push-workflows`; importing
`@voyant-travel/distribution` for suppliers, external refs, or route wiring
must not register scheduled channel-push work. The availability/content
schedules are attached only when
`VOYANT_DISTRIBUTION_CHANNEL_PUSH_ENABLED=true`, which keeps non-channel
deployments from publishing 30s/5m hosted schedules.

## Event Flow

Modules and plugins declare workflows and event filters. `createApp()` collects
them into a manifest and registers it with the configured driver. Event
forwarding calls `driver.ingestEvent(...)`; the driver loads the manifest,
routes matching filters, and triggers the corresponding workflow runs.

Self-host Node deployments do this in-process against Postgres. Managed Cloud
deployments forward the same logical calls to the Cloud control plane, which
then schedules execution on Node runners.

Request-serving apps should keep module workflow metadata manifest-only when
workflow bodies execute in a detached bundle. `Module.workflows` accepts
`{ id, config }` descriptors, and `Module.eventFilters` accepts entries carrying
`{ id, eventType, manifest }`, so the API app can register workflow ids,
schedules, concurrency, and event routing without statically importing
run-bearing workflow modules. Workflow bundle entrypoints still import the full
`workflow({ id, run })` definitions so the Node runner can execute them.

## Migration Rules

- Do not add new `edge` runtime types, options, docs, or tests.
- Do not reintroduce a `nodeStepRunner` split. The handler/executor takes one
  `stepRunner` path.
- Treat `runtime: "node"` as metadata only.
- Prefer Node/Postgres for new self-host workflow runtime work.
- Prefer `@voyant-travel/workflows/client` and
  `createCloudWorkflowDriver(...)` for managed Cloud app bundles.
- Do not reintroduce Cloudflare workflow runtime adapter packages or external
  step-server packages.
