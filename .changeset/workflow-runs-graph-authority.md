---
"@voyant-travel/workflow-runs": minor
"@voyant-travel/runtime": minor
---

Move Workflow Runs registry and route composition behind its selected-graph runtime port. The generic Node runtime no longer mounts Workflow Runs routes when the module is not selected.

Direct applications can continue to instantiate `WorkflowRunnerRegistry` and call `mountWorkflowRunsAdminRoutes`. Runtime-port implementations must now expose both `register()` and `get()`.

See the [Workflow Runs 0.119 migration guide](../docs/migrations/migrating-to-0.119.md) for the custom provider update.
