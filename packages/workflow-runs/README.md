# @voyantjs/workflow-runs

Workflow run recording, admin routes, and rerun/resume dispatch primitives for Voyant operator apps.

## Install

```sh
pnpm add @voyantjs/workflow-runs
```

The package is published with the same release-train version as the other installable Voyant packages.

For the matching importable React admin surface, install
`@voyantjs/workflow-runs-ui` and point its API client at the routes mounted by
this package:

```tsx
import {
  createWorkflowRunsApiClient,
  WorkflowRunsPage,
} from "@voyantjs/workflow-runs-ui"

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
