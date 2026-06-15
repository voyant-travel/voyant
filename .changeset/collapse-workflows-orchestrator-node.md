---
"@voyant-travel/workflows-orchestrator": minor
---

Fold the Postgres self-host runtime into `@voyant-travel/workflows-orchestrator`
and remove the separate `@voyant-travel/workflows-orchestrator-node` package.

Self-host deployments should import the Postgres driver, migration helpers,
scheduler/wakeup stores, dashboard helpers, and self-host server helpers from
the `@voyant-travel/workflows-orchestrator/selfhost` runtime subpath.
