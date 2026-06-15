---
"@voyant-travel/workflows": minor
"@voyant-travel/commerce": patch
"@voyant-travel/db": patch
"@voyant-travel/hono": patch
---

Make workflows node-only and remove the stale Cloudflare edge/Node step split.

Workflow runtime annotations now accept only `runtime: "node"`, legacy
`runtime: "edge"` is rejected, and the old split-runner wiring has been removed.
Cloudflare workflow adapters remain legacy compatibility surfaces, while managed
Cloud apps should forward workflow calls to the hosted Node runtime.
