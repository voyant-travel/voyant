---
"@voyant-travel/framework": minor
"@voyant-travel/core": minor
"@voyant-travel/runtime": minor
"@voyant-travel/operator-standard": minor
"@voyant-travel/workflows-orchestrator": minor
"@voyant-travel/workflow-runs": patch
---

Make `deployment.providers.workflows` authoritative for Node workflow execution and Workflow Runs admin ownership. Self-hosted Operators now use the durable Postgres driver and receive package-owned orchestrator migrations; local mode uses the in-memory adapter, `none` omits workflow composition, and Voyant Cloud fails closed when credentials are missing.

Scheduled one-shot dispatch disables resident scheduler and time-wheel loops and always shuts down its driver. Managed Cloud snapshots must select `voyant-cloud` before this release is deployed.

See the [Framework 0.42 migration guide](../docs/migrations/migrating-to-0.42.md) for provider, migration, and rollout steps.
