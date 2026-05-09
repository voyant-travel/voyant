---
"@voyantjs/workflows-orchestrator": patch
"@voyantjs/workflows-orchestrator-node": patch
"@voyantjs/workflows-orchestrator-cloudflare": patch
---

Wire `TriggerOptions.delay` through the workflow orchestrator drivers so delayed runs park on a DATETIME waitpoint and wake through the existing time wheel.
