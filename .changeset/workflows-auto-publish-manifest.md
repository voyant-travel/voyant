---
"@voyantjs/workflows-cloud-adapter": minor
---

Auto-publish the in-process workflow registry to `WORKFLOW_MANIFESTS` KV on cold start. When the cloud adapter sees its first request and the KV binding is present, it builds a content-addressed manifest from `__listRegisteredWorkflows()` + the event-filter registry and writes it under `VOYANT_WORKFLOWS_ENVIRONMENT` (default `"production"`) — but only when the envelope is missing or its `versionId` differs. Steady state stays a single KV read; the publish runs via `ctx.waitUntil` when available so the hot path isn't blocked. Tenants who already POST `/api/manifests` or call `registerManifest` directly keep working unchanged — the auto-publish becomes a no-op. Opt out with `mountWorkflows(app, env, { autoPublishManifest: false })`.
