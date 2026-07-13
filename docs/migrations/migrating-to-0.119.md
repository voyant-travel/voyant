# Workflow Runs 0.119

## TL;DR

- Custom `workflows.runner-registry` providers must implement both `register()` and `get()`.
- The selected Workflow Runs package now creates the standard registry and mounts its own routes.
- The generic Node runtime no longer mounts Workflow Runs routes when the module is not selected.
- `WorkflowRunnerRegistry` and `mountWorkflowRunsAdminRoutes` remain available for direct composition.
- There are no schema or HTTP path changes in this release.

## Runtime Port Contract

This migration only affects applications or packages that supply a custom
`WorkflowRunnerRegistryRuntime` implementation. The `get()` reader is required
so the package-owned trigger, rerun, and resume routes can resolve registered
workflows through the selected runtime port.

Before:

```ts
import type {
  WorkflowRunner,
  WorkflowRunnerRegistryRuntime,
} from "@voyant-travel/workflow-runs"

const runners = new Map<string, WorkflowRunner>()

export const workflowRunnerRegistry: WorkflowRunnerRegistryRuntime = {
  register(runner) {
    runners.set(runner.name, runner)
  },
}
```

After:

```ts
import type {
  WorkflowRunner,
  WorkflowRunnerRegistryRuntime,
} from "@voyant-travel/workflow-runs"

const runners = new Map<string, WorkflowRunner>()

export const workflowRunnerRegistry: WorkflowRunnerRegistryRuntime = {
  register(runner) {
    runners.set(runner.name, runner)
  },
  get(name) {
    return runners.get(name) ?? null
  },
}
```

## Direct Composition

Direct applications do not need to adopt the selected deployment graph in this
release. The existing registry and route APIs remain supported:

```ts
import {
  mountWorkflowRunsAdminRoutes,
  WorkflowRunnerRegistry,
} from "@voyant-travel/workflow-runs"

const runners = new WorkflowRunnerRegistry()
mountWorkflowRunsAdminRoutes(app, { runners })
```

Selected-graph applications should not mount these routes in their generic Node
host. Selecting `@voyant-travel/workflow-runs` now supplies the registry and
route composition through the package manifest.

## Full Changelogs

- [`@voyant-travel/workflow-runs`](../../packages/workflow-runs/CHANGELOG.md)
- [`@voyant-travel/runtime`](../../packages/runtime/CHANGELOG.md)
