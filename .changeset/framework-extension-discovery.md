---
"@voyant-travel/framework": minor
---

Add `extensionsFromGlob` + `defineDeploymentExtension` — the extension counterpart to `modulesFromGlob`/`defineDeploymentModule`. A deployment drops a `HonoExtension` into `src/extensions/<name>/index.ts` (custom routes on an *existing* module, e.g. `/v1/admin/bookings/notes`) and it is auto-discovered and mounted via `import.meta.glob`, keyed by directory name. Pairs with the deployment drizzle config glob (`src/extensions/*/schema.ts`) so an extension that owns tables is migrated as a deployment source after the framework bundle.

Completes the "build your own routes/modules without forking" seam (custom module + custom extension). See `docs/architecture/custom-modules.md`.
