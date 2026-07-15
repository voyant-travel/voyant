/**
 * Deployment-local module + extension discovery (consolidated-deployments RFC —
 * the "20%" extension seams: *custom module* and *custom route on an existing
 * module*, neither requiring a fork).
 *
 * A deployment drops a unit into a conventional directory and it is auto-mounted
 * — no edit to a framework-owned file, no hand-wiring in the deployment's
 * composition:
 *
 *   - `src/modules/<name>/index.ts`    → a new module (own routes + schema)
 *   - `src/extensions/<name>/index.ts` → a {@link ApiExtension} adding routes to
 *                                        an EXISTING module's surface
 *
 * Discovery is **build-time**: the deployment feeds a Vite
 * `import.meta.glob("./modules/*\/index.ts", { eager: true })` (statically
 * compiled to static imports — Workers-safe) into {@link modulesFromGlob} /
 * {@link extensionsFromGlob}, which key each unit by its `<name>` directory
 * segment.
 *
 *     // src/api/composition.ts (deployment-owned)
 *     const modules = modulesFromGlob<OperatorCapabilities>(
 *       import.meta.glob("../modules/*\/index.ts", { eager: true }),
 *     )
 *     const extensions = extensionsFromGlob<OperatorCapabilities>(
 *       import.meta.glob("../extensions/*\/index.ts", { eager: true }),
 *     )
 *
 *     // src/modules/loyalty/index.ts
 *     export default defineDeploymentModule({ module: { name: "loyalty" }, adminRoutes })
 *     // src/extensions/booking-notes/index.ts
 *     export default defineDeploymentExtension({
 *       extension: { module: "bookings" }, adminRoutes,  // → /v1/admin/bookings/*
 *     })
 *
 * Schema owned by a custom module/extension (`<dir>/<name>/schema.ts`) is picked
 * up by the deployment's drizzle config glob (a *deployment* migration source,
 * applied after the framework bundle by the D.1 collector).
 */

import type { ExtensionFactory, ModuleFactory } from "@voyant-travel/hono/composition"
import type { ApiExtension, ApiModule } from "@voyant-travel/hono/module"

/** A deployment module declaration: a ready unit, or a factory that builds one. */
export type DeploymentModuleDeclaration<TProviders> =
  | ApiModule
  | ApiModule[]
  | ModuleFactory<TProviders>

/** A deployment extension declaration: a ready unit, or a factory that builds one. */
export type DeploymentExtensionDeclaration<TProviders> = ApiExtension | ExtensionFactory<TProviders>

/**
 * Normalize a deployment-local module declaration into a {@link ModuleFactory}.
 * Accepts a ready {@link ApiModule} (or array) or a factory; returns a factory
 * either way. Use it as the `export default` of a `src/modules/<name>/index.ts`.
 */
export function defineDeploymentModule<TProviders = unknown>(
  declaration: DeploymentModuleDeclaration<TProviders>,
): ModuleFactory<TProviders> {
  return typeof declaration === "function" ? declaration : () => declaration
}

/**
 * Normalize a deployment-local extension declaration into an
 * {@link ExtensionFactory}. Accepts a ready {@link ApiExtension} or a factory.
 * Use it as the `export default` of a `src/extensions/<name>/index.ts`.
 */
export function defineDeploymentExtension<TProviders = unknown>(
  declaration: DeploymentExtensionDeclaration<TProviders>,
): ExtensionFactory<TProviders> {
  return typeof declaration === "function" ? declaration : () => declaration
}

/** A Vite `import.meta.glob(..., { eager: true })` result: path → module namespace. */
export type EagerModuleGlob = Record<string, unknown>

/**
 * Build a deployment-local **module** registry from a Vite `import.meta.glob`
 * (eager) of `src/modules/<name>/index.ts` files. Each entry's `default` export
 * is a {@link ApiModule} or {@link ModuleFactory} (wrap with
 * {@link defineDeploymentModule}); the registry key is the `<name>` directory
 * segment, which becomes the module's composition specifier.
 *
 * @throws if a matched file has no default export.
 */
export function modulesFromGlob<TProviders = unknown>(
  glob: EagerModuleGlob,
): Record<string, ModuleFactory<TProviders>> {
  return discoverFromGlob(glob, "modules", (declaration: DeploymentModuleDeclaration<TProviders>) =>
    defineDeploymentModule(declaration),
  )
}

/**
 * Build a deployment-local **extension** registry from a Vite `import.meta.glob`
 * (eager) of `src/extensions/<name>/index.ts` files. Each entry's `default`
 * export is a {@link ApiExtension} or {@link ExtensionFactory} (wrap with
 * {@link defineDeploymentExtension}); the registry key is the `<name>` directory
 * segment.
 *
 * @throws if a matched file has no default export.
 */
export function extensionsFromGlob<TProviders = unknown>(
  glob: EagerModuleGlob,
): Record<string, ExtensionFactory<TProviders>> {
  return discoverFromGlob(
    glob,
    "extensions",
    (declaration: DeploymentExtensionDeclaration<TProviders>) =>
      defineDeploymentExtension(declaration),
  )
}

/**
 * Shared scanner: map an eager glob of `<dir>/<name>/index.ts` files to a
 * `{ <name>: normalize(default) }` registry, ignoring non-matching paths.
 */
function discoverFromGlob<TDeclaration, TFactory>(
  glob: EagerModuleGlob,
  dir: string,
  normalize: (declaration: TDeclaration) => TFactory,
): Record<string, TFactory> {
  const registry: Record<string, TFactory> = {}
  for (const [path, namespace] of Object.entries(glob)) {
    const name = nameFromPath(path, dir)
    if (!name) {
      continue
    }
    const declaration = (namespace as { default?: unknown }).default
    if (declaration == null) {
      throw new Error(
        `deployment ${dir.replace(/s$/, "")} "${path}" has no default export — ` +
          `add \`export default ${dir === "modules" ? "defineDeploymentModule" : "defineDeploymentExtension"}(...)\` ` +
          `to src/${dir}/${name}/index.ts`,
      )
    }
    registry[name] = normalize(declaration as TDeclaration)
  }
  return registry
}

/** Extract the `<name>` segment from a `.../<dir>/<name>/index.{ts,tsx,…}` path. */
function nameFromPath(path: string, dir: string): string | null {
  const match = path.match(new RegExp(`/${dir}/([^/]+)/index\\.[cm]?tsx?$`))
  return match ? (match[1] as string) : null
}
