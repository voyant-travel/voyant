---
"@voyant-travel/workflows-orchestrator": patch
---

`findDashboardDir` no longer probes the in-repo `apps/workflows-local-dashboard/dist` path (that example app has been removed). It now falls back to a generic sibling `local-dashboard/dist`; production self-host should pass `staticDir` explicitly.
