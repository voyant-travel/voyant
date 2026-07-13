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

The application/API deployment and workflow runtime are both Node-only. The old
Cloudflare Worker/Durable Object workflow adapter, tenant-worker adapter, and
external step-server package have been removed from the workspace package
surface. A separate edge client may call the deployment, but it is not a Voyant
runtime target.

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

## Deployment Provider Authority

The resolved `deployment.providers.workflows` value is the only workflow-driver
selector. Environment variables configure the selected provider; they never
select one.

| Deployment mode | Provider | Runtime behavior |
| --- | --- | --- |
| `local` | `self-hosted` | In-memory local adapter |
| `self-hosted` | `self-hosted` | Postgres standalone driver |
| any | `voyant-cloud` | Cloud forwarding; URL and token are required |
| any | `none` | No workflow manifest, event forwarding, or scheduled dispatch |

`managed-cloud` plus `self-hosted` is invalid. Managed deployment snapshots
must declare `voyant-cloud` before deploying a runtime that enforces this
contract.

The standard Operator distribution declares `self-hosted`, so local development
stays lightweight while deployed self-hosted applications use durable Postgres
execution. Projects may explicitly select `none` when they do not use workflows.

Workflow Runs admin routes derive control-plane ownership from the same resolved
provider selection: `self-hosted` enables tenant actions, `voyant-cloud` leaves
reads available but reserves actions for Cloud, and `none` disables actions.
Environment variables do not select this route behavior.

The generated migration plan includes the committed
`@voyant-travel/workflows-orchestrator#migrations` source only for the
`self-hosted` provider. Run `voyant migrate` before first boot so run, manifest,
and wakeup tables exist.

Resident self-hosted drivers keep the schedule runner and persistent time wheel
active. A Node scheduled-event invocation is one-shot: it reuses the
process-cached Postgres connection, disables both background loops on the driver,
and shuts the driver down after trigger success or failure.

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

Workflow execution resolves definitions through an explicit `WorkflowResolver`
passed to the step handler. Runtime composition snapshots or constructs that
resolver after loading the selected workflow bundle; step execution must not
use the process-global authoring registry as its source of truth. The handler's
global-registry fallback exists only for backward compatibility with direct SDK
callers and is not the canonical runtime wiring.

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
- Select the implementation through `deployment.providers.workflows`; credentials
  must never change provider selection.
- Do not reintroduce Cloudflare workflow runtime adapter packages or external
  step-server packages.
