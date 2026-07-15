---
"@voyant-travel/workflow-runs": minor
"@voyant-travel/tools": minor
"@voyant-travel/mcp": patch
---

Add staff-only workflow-run Tools for typed run inspection, registered workflow
triggering, and rerun/resume retries. Writes require strict explicit scopes,
confirmation, approval, action-ledger recording, and a graph-selected
self-hosted workflow provider. Pass selected provider roles to package Tool
context contributions so management operations fail closed when deployment
authority is absent. Trigger and retry use a worst-case critical risk because
the runner port has no per-workflow side-effect descriptors. Cancellation
remains unavailable until the
provider-neutral runner port exposes a real cancellation capability.
