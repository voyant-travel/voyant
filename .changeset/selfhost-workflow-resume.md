---
"@voyantjs/workflows-orchestrator-node": minor
"@voyantjs/workflows-orchestrator": minor
"@voyantjs/workflow-runs": minor
---

Add a supported self-host failed-step resume path for workflow-run dispatch.

The Node self-host server now exposes a resume endpoint that can start a new run
from a stored self-host parent snapshot or from an external admin recorder parent
id with explicit `workflowId`, `resumeFromStep`, and seeded step results. The
orchestrator can now trigger runs with a pre-populated journal, and the Node
self-host package exports a client helper for operator admin integrations.
