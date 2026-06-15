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

- **Node self-host**: `@voyant-travel/workflows-orchestrator-node` runs the
  orchestrator, workflow bodies, manifest store, schedules, wakeups, and admin
  reads against Postgres.
- **Managed Cloud**: app bundles use `@voyant-travel/workflows/client` and
  `createCloudWorkflowDriver(...)` to forward trigger/event calls to Voyant
  Cloud. Workflow bundles execute in the hosted Node runner implementation in
  `/Users/mihai/builds/internal/voyant-all/voyant-cloud`.

Cloudflare Workers may still host application/API code, and this repo still
contains legacy Cloudflare Worker/Durable Object workflow adapters. Those
adapters are compatibility surfaces for old self-host experiments; they are not
the managed Cloud workflow execution model and must not introduce new runtime
selection APIs.

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

`@voyant-travel/workflows-orchestrator` owns the transport-neutral state machine,
event routing, dispatch contracts, and compliance tests.

`@voyant-travel/workflows-orchestrator-node` is the primary self-host runtime. It
uses Postgres for run records, wakeups, manifests, schedules, and admin queries.

`@voyant-travel/workflows-orchestrator-cloudflare`,
`@voyant-travel/workflows-cloud-adapter`, and the Cloudflare Worker apps are
legacy compatibility surfaces. Keep fixes narrow and do not extend them with new
managed-runtime behavior.

## Application Wiring

Self-host Node apps wire a Node driver:

```ts
createApp({
  workflows: {
    driver: () => createNodeStandaloneDriver({ db }),
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

## Event Flow

Modules and plugins declare workflows and event filters. `createApp()` collects
them into a manifest and registers it with the configured driver. Event
forwarding calls `driver.ingestEvent(...)`; the driver loads the manifest,
routes matching filters, and triggers the corresponding workflow runs.

Self-host Node deployments do this in-process against Postgres. Managed Cloud
deployments forward the same logical calls to the Cloud control plane, which
then schedules execution on Node runners.

## Migration Rules

- Do not add new `edge` runtime types, options, docs, or tests.
- Do not reintroduce a `nodeStepRunner` split. The handler/executor takes one
  `stepRunner` path.
- Treat `runtime: "node"` as metadata only.
- Prefer Node/Postgres for new self-host workflow runtime work.
- Prefer `@voyant-travel/workflows/client` and
  `createCloudWorkflowDriver(...)` for managed Cloud app bundles.
- When a legacy Cloudflare workflow package must change, keep the change
  compatibility-focused and do not present it as the current architecture.
