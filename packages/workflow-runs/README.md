# @voyant-travel/workflow-runs

Workflow run recording, admin routes, and rerun/resume dispatch primitives for Voyant operator apps.

## Install

```sh
pnpm add @voyant-travel/workflow-runs
```

The package is independently published with the rest of the workflows release cohort.

For the matching importable React admin surface, install
`@voyant-travel/workflows-react/ui` and point its API client at the routes mounted by
this package:

```tsx
import {
  createWorkflowRunsApiClient,
  WorkflowRunsPage,
} from "@voyant-travel/workflows-react/ui"

const workflowRunsApi = createWorkflowRunsApiClient({ apiBase: "/api" })

export function WorkflowsRoute() {
  return <WorkflowRunsPage api={workflowRunsApi} />
}
```

## Selected graph composition

When `@voyant-travel/workflow-runs` is selected in a Voyant project, its package
contributor creates the runner registry and its graph runtime mounts the admin
routes. Other selected packages register executable workflows through the
`workflows.runner-registry` runtime port; the generic Node host does not need
Workflow Runs-specific wiring.

## Direct composition

`mountWorkflowRunsAdminRoutes` adds the workflow-run list, detail, rerun, and resume endpoints under `/v1/admin/workflow-runs`, plus an explicit trigger endpoint at `POST /v1/admin/workflows/:name/runs`.

Applications that do not use the selected deployment graph can still compose
the registry and routes directly:

```ts
import { mountWorkflowRunsAdminRoutes, WorkflowRunnerRegistry } from "@voyant-travel/workflow-runs"
import { createSelfHostWorkflowClient } from "@voyant-travel/workflows-orchestrator/selfhost"

const workflowRunnerRegistry = new WorkflowRunnerRegistry()
const workflowServer = createSelfHostWorkflowClient({
  baseUrl: process.env.WORKFLOW_SERVER_URL!,
})

workflowRunnerRegistry.register({
  name: "checkout-finalize",
  idempotency: "unsafe",
  description:
    "Confirms the booking and issues the final invoice. Use Resume to retry from a failed step.",
  trigger: async (input, ctx) => {
    const saved = await workflowServer.trigger({
      workflowId: "checkout-finalize",
      input,
      tags: ctx.tags,
      triggeredByUserId: ctx.triggeredByUserId,
    })
    return { runId: saved.id }
  },
  rerun: async (input, ctx) => {
    const saved = await workflowServer.trigger({
      workflowId: "checkout-finalize",
      input,
      tags: [...ctx.tags, "rerun:true"],
    })
    return { runId: saved.id }
  },
  resume: async (input, ctx) => {
    const { saved } = await workflowServer.resume(ctx.parentRunId, {
      workflowId: "checkout-finalize",
      input,
      resumeFromStep: ctx.resumeFromStep,
      seedResults: ctx.seedResults,
      tags: [...ctx.tags, "resume:true"],
      triggeredByUserId: ctx.triggeredByUserId,
    })
    return { runId: saved.id }
  },
})

mountWorkflowRunsAdminRoutes(hono, {
  runners: workflowRunnerRegistry,
  adminSurface: "tenant",
})
```

`adminSurface` controls tenant-admin workflow management actions:

- `tenant` keeps local/self-host trigger, rerun, and resume routes available.
- `cloud` keeps read routes available but rejects tenant-admin trigger, rerun,
  and resume routes because the Voyant Cloud dashboard is the workflow control
  plane for managed deployments.
- `disabled` keeps read routes available and disables tenant-admin management
  actions completely.

Direct composition defaults to `tenant` when `adminSurface` is omitted. Selected
graph composition derives the surface from `deployment.providers.workflows`:
`self-hosted` maps to `tenant`, `voyant-cloud` maps to `cloud`, and `none` maps to
`disabled`. Environment variables never select the admin surface or imply
provider ownership.

Triggerable workflows must opt in by implementing `trigger(...)` on their registered runner. This keeps rerun/resume-only workflows closed to arbitrary admin dispatch while still allowing operators, cron jobs, queues, and API keys with `workflows:trigger` permission to call:

```http
POST /v1/admin/workflows/checkout-finalize/runs
Content-Type: application/json

{
  "input": { "bookingId": "bk_123" },
  "idempotencyKey": "checkout-finalize:bk_123",
  "correlationId": "bk_123",
  "tags": ["source:admin"]
}
```

The route returns `202 Accepted` with the queued run id:

```json
{
  "data": {
    "runId": "wfrn_...",
    "workflowName": "checkout-finalize",
    "status": "queued"
  }
}
```

For self-hosted workflow services, keep runner registration close to the code that mounts the workflow service. The registry should dispatch to your external workflow server instead of importing worker-only runtime code into the admin API process. The resume path sends `ctx.resumeFromStep` plus `ctx.seedResults`; the self-host server starts a new run, pre-populates the journal with the seeded step outputs, and executes from the failed step onward.

## Record `@voyant-travel/workflows` executions

Use `recordedWorkflow` as a drop-in replacement for `workflow(...)` when a
workflow should appear in the workflow runs admin UI. The helper records start,
success, and failure rows in `workflow_runs` without repeating recorder
boilerplate in every workflow body.

```ts
import { recordedWorkflow } from "@voyant-travel/workflow-runs"

export const generatePdfWorkflow = recordedWorkflow({
  id: "products.generate-pdf",
  tags: ["products"],
  async run(input, ctx) {
    const renderer = ctx.services.resolve("products:pdf-renderer")
    return renderer.generate(input)
  },
})
```

By default, `recordedWorkflow` resolves a Drizzle database from
`ctx.services.resolve("db")`. It records the workflow id, trigger, run id as the
correlation id, configured/runtime tags, input, result, parent run id for child
workflow triggers, and errors. Recording is best-effort: database or serializer
failures do not fail the workflow execution.

You can customize the database service key or payload serializers:

```ts
export const syncCatalogWorkflow = recordedWorkflow(
  {
    id: "catalog.sync",
    async run(input, ctx) {
      return ctx.services.resolve("catalog:sync").run(input)
    },
  },
  {
    dbServiceName: "postgres",
    input: ({ input }) => ({ catalogId: input.catalogId }),
    result: ({ output }) => ({ changed: output.changed }),
  },
)
```

This helper only records observability data. Trigger, rerun, and resume support
still uses `WorkflowRunnerRegistry` registration so apps can choose which
workflows are safe to dispatch from the admin UI.
