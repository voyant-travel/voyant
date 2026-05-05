# @voyantjs/workflow-runs

Workflow run recording, admin routes, and rerun/resume dispatch primitives for Voyant operator apps.

## Install

```sh
pnpm add @voyantjs/workflow-runs
```

The package is published with the same release-train version as the other installable Voyant packages.

## Mount the admin routes

`mountWorkflowRunsAdminRoutes` adds the workflow-run list, detail, rerun, and resume endpoints under `/v1/admin/workflow-runs`.

```ts
import { mountWorkflowRunsAdminRoutes, WorkflowRunnerRegistry } from "@voyantjs/workflow-runs"

const workflowRunnerRegistry = new WorkflowRunnerRegistry()

workflowRunnerRegistry.register({
  name: "checkout-finalize",
  rerun: async ({ run, input }) => {
    await workflowServer.dispatch("checkout-finalize", {
      idempotencyKey: run.idempotencyKey ?? run.id,
      input,
    })
  },
  resume: async ({ run, input, failedStep }) => {
    await workflowServer.dispatch("checkout-finalize", {
      resumeFromStep: failedStep?.stepName ?? null,
      originalRunId: run.id,
      input,
    })
  },
})

mountWorkflowRunsAdminRoutes(hono, {
  runners: workflowRunnerRegistry,
})
```

For self-hosted workflow services, keep runner registration close to the code that mounts the workflow service. The registry should dispatch to your external workflow server instead of importing worker-only runtime code into the admin API process.
