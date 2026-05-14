# @voyantjs/workflow-runs

Workflow run recording, admin routes, and rerun/resume dispatch primitives for Voyant operator apps.

## Install

```sh
pnpm add @voyantjs/workflow-runs
```

The package is published with the same release-train version as the other installable Voyant packages.

For the matching importable React admin surface, install
`@voyantjs/workflows-ui` and point its API client at the routes mounted by
this package:

```tsx
import {
  createWorkflowRunsApiClient,
  WorkflowRunsPage,
} from "@voyantjs/workflows-ui"

const workflowRunsApi = createWorkflowRunsApiClient({ apiBase: "/api" })

export function WorkflowsRoute() {
  return <WorkflowRunsPage api={workflowRunsApi} />
}
```

## Mount the admin routes

`mountWorkflowRunsAdminRoutes` adds the workflow-run list, detail, rerun, and resume endpoints under `/v1/admin/workflow-runs`.

```ts
import { mountWorkflowRunsAdminRoutes, WorkflowRunnerRegistry } from "@voyantjs/workflow-runs"
import { createNodeSelfHostWorkflowClient } from "@voyantjs/workflows-orchestrator-node"

const workflowRunnerRegistry = new WorkflowRunnerRegistry()
const workflowServer = createNodeSelfHostWorkflowClient({
  baseUrl: process.env.WORKFLOW_SERVER_URL!,
})

workflowRunnerRegistry.register({
  name: "checkout-finalize",
  idempotency: "unsafe",
  description:
    "Confirms the booking and issues the final invoice. Use Resume to retry from a failed step.",
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
})
```

For self-hosted workflow services, keep runner registration close to the code that mounts the workflow service. The registry should dispatch to your external workflow server instead of importing worker-only runtime code into the admin API process. The resume path sends `ctx.resumeFromStep` plus `ctx.seedResults`; the self-host server starts a new run, pre-populates the journal with the seeded step outputs, and executes from the failed step onward.

## Record `@voyantjs/workflows` executions

Use `recordedWorkflow` as a drop-in replacement for `workflow(...)` when a
workflow should appear in the workflow runs admin UI. The helper records start,
success, and failure rows in `workflow_runs` without repeating recorder
boilerplate in every workflow body.

```ts
import { recordedWorkflow } from "@voyantjs/workflow-runs"

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

This helper only records observability data. Rerun and resume support still uses
`WorkflowRunnerRegistry` registration so apps can choose which workflows are
safe to dispatch from the admin UI.
