---
"@voyant-travel/framework": minor
"@voyant-travel/hono": patch
---

**Convergence (Workstream B step 3):** `@voyant-travel/framework` now exports `createVoyantApp({ providers, modules?, extensions?, …config })` — the config-driven front door. It assembles the framework-owned standard set (`FRAMEWORK_RUNTIME_MANIFEST` + `frameworkComposition`) with the deployment's injected providers and any deployment-local module/extension additions, then delegates to `@voyant-travel/hono`'s lower-level `createApp`.

A standard deployment's `app.ts` collapses to a single `createVoyantApp({ providers: buildOperatorProviders(), modules: deploymentLocalModules, …db/workflows/outbox/publicPaths })` call — no hand-maintained manifest or registry. The operator starter is converged: `buildOperatorCapabilities → buildOperatorProviders`, the two deployment-local module factories are extracted to `deploymentLocalModules`, and `OPERATOR_RUNTIME_MANIFEST` / `operatorComposition` remain only as derived exports for `voyant db doctor` parity + the composition tests.

(hono: docstring on `createApp` updated to point standard deployments at `createVoyantApp`.)
