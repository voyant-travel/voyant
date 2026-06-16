---
"@voyant-travel/workflows-orchestrator": patch
---

Call workflow bundle `bootstrapWorkflowBundle` exports after loading entries so
detached workflow runners can initialize process-local dependencies before
executing workflow steps.
