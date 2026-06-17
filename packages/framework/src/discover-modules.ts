/**
 * Deployment-local module discovery (consolidated-deployments RFC — the "20%"
 * extension seam: *custom module without forking*).
 *
 * A deployment drops a custom module at `src/modules/<name>/index.ts` that
 * default-exports a {@link HonoModule} (or a {@link ModuleFactory}) and it is
 * auto-mounted — no edit to a framework-owned file, no hand-wiring in the
 * deployment's composition. Discovery is **build-time**: the deployment feeds a
 * Vite `import.meta.glob("./modules/*\/index.ts", { eager: true })` (statically
 * compiled to static imports — Workers-safe) into {@link modulesFromGlob}, which
 * keys each module by its `<name>` directory segment.
 *
 *     // src/api/composition.ts (deployment-owned)
 *     const discoveredModules = modulesFromGlob<OperatorCapabilities>(
 *       import.meta.glob("../modules/*\/index.ts", { eager: true }),
 *     )
 *     export const deploymentLocalModules = { ...discoveredModules, ...handWired }
 *
 *     // src/modules/loyalty/index.ts (the dev's custom module)
 *     export default defineDeploymentModule({
 *       module: { name: "loyalty" },
 *       adminRoutes: loyaltyRoutes,
 *     })
 *
 * Schema for a custom module lives in `src/modules/<name>/schema.ts` and is
 * picked up by the deployment's drizzle config glob (a *deployment* migration
 * source, applied after the framework bundle by the D.1 collector).
 */

import type { ModuleFactory } from "@voyant-travel/hono/composition"
import type { HonoModule } from "@voyant-travel/hono/module"
import type { FrameworkProviders } from "./composition.js"

/** A deployment module declaration: a ready unit, or a factory that builds one. */
export type DeploymentModuleDeclaration<TProviders> =
  | HonoModule
  | HonoModule[]
  | ModuleFactory<TProviders>

/**
 * Normalize a deployment-local module declaration into a {@link ModuleFactory}.
 * Accepts a ready {@link HonoModule} (or array) or a factory; returns a factory
 * either way. Identity for factories, a thunk for ready units. Use it as the
 * `export default` of a `src/modules/<name>/index.ts`.
 */
export function defineDeploymentModule<TProviders = FrameworkProviders>(
  declaration: DeploymentModuleDeclaration<TProviders>,
): ModuleFactory<TProviders> {
  return typeof declaration === "function" ? declaration : () => declaration
}

/** A Vite `import.meta.glob(..., { eager: true })` result: path → module namespace. */
export type EagerModuleGlob = Record<string, unknown>

/**
 * Build a deployment-local module registry from a Vite `import.meta.glob`
 * (eager) of `src/modules/<name>/index.ts` files. Each entry's `default` export
 * is a {@link HonoModule} or {@link ModuleFactory} (wrap with
 * {@link defineDeploymentModule}); the registry key is the `<name>` directory
 * segment, which becomes the module's composition specifier.
 *
 * @throws if a matched file has no default export (a wiring mistake worth
 *   surfacing loudly rather than silently dropping the module).
 */
export function modulesFromGlob<TProviders = FrameworkProviders>(
  glob: EagerModuleGlob,
): Record<string, ModuleFactory<TProviders>> {
  const registry: Record<string, ModuleFactory<TProviders>> = {}
  for (const [path, namespace] of Object.entries(glob)) {
    const name = moduleNameFromPath(path)
    if (!name) {
      continue
    }
    const declaration = (namespace as { default?: unknown }).default
    if (declaration == null) {
      throw new Error(
        `deployment module "${path}" has no default export — ` +
          `add \`export default defineDeploymentModule(...)\` to src/modules/${name}/index.ts`,
      )
    }
    registry[name] = defineDeploymentModule(declaration as DeploymentModuleDeclaration<TProviders>)
  }
  return registry
}

/** Extract the `<name>` segment from a `.../modules/<name>/index.{ts,tsx,…}` path. */
function moduleNameFromPath(path: string): string | null {
  const match = path.match(/\/modules\/([^/]+)\/index\.[cm]?tsx?$/)
  return match ? (match[1] as string) : null
}
