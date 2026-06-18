---
"@voyant-travel/framework-migrations": minor
---

Ship the D.1 standard-profile aggregate migration bundle (Workstream D.1, slice 2). `@voyant-travel/framework-migrations` now includes the generated `migrations/` bundle (`0000_framework_baseline`) — the standard-profile aggregate schema (the operator reference profile's package-owned schemas, minus the deployment-local cross-module link tables) — and exports `loadFrameworkBundleSource()` / `frameworkBundleDir()` to load it as the `framework` collector source (priority 0).

The bundle is incremental: `0000` is frozen; a standard-schema change appends `0001…` (never rewrites `0000`, which would trip the collector's content-hash immutability guard). `scripts/generate-framework-migration-bundle.mjs` generates it (from the operator reference config) and gates drift via `verify:framework-migration-bundle` (added to `verify:architecture`) — a clean re-generate must be a no-op. This slice ships + verifies the bundle; it is not yet wired into a live runner (slice 4).
