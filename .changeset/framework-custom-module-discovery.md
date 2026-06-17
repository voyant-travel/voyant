---
"@voyant-travel/framework": minor
---

Add `modulesFromGlob` + `defineDeploymentModule` — the runtime half of the "build your own module without forking" seam. A deployment feeds a Vite `import.meta.glob("../modules/*/index.ts", { eager: true })` (compiled to static imports at build time — Workers-safe) into `modulesFromGlob`, which keys each custom module by its `<name>` directory and normalizes its default export (a `HonoModule` or `ModuleFactory`, via `defineDeploymentModule`) into the composition registry.

Pairs with the deployment drizzle config glob (`src/modules/*/schema.ts`) so a custom module's tables are migrated as a deployment source after the framework bundle. See `docs/architecture/custom-modules.md`.
