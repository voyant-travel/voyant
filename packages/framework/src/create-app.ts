/**
 * `createVoyantApp` — the framework's config-driven front door (Workstream B
 * convergence).
 *
 * A standard deployment no longer hand-assembles a manifest + registry. It calls
 * this with its injected {@link FrameworkProviders} and any deployment-local
 * module/extension additions; the framework merges them onto the standard set
 * (`FRAMEWORK_RUNTIME_MANIFEST` + `frameworkComposition`) and delegates to the
 * lower-level `createApp` in `@voyant-travel/hono`.
 *
 *     export const app = createVoyantApp<CloudflareBindings, OperatorProviders>({
 *       providers: buildOperatorProviders(),
 *       modules:   deploymentLocalModules,   // e.g. invitations, operator-settings
 *       db, workflows, outbox, publicPaths,  // unchanged VoyantApp config
 *     })
 *
 * This is NOT the rejected "assembly kit": providers stay injected (never baked),
 * and the assembly is the framework-owned standard set — not a bottom-up file dump.
 *
 * Scope (D.1): the standard profile is FIXED. This always mounts the full
 * `FRAMEWORK_RUNTIME_MANIFEST` and only APPENDS the deployment's local
 * `modules`/`extensions`; it does not consume `voyant.config` to remove standard
 * modules. Subsetting the standard set is a later workstream — see `manifest.ts`.
 */

import { type CreateAppConfig, createApp, type VoyantBindings } from "@voyant-travel/hono"
import type {
  CompositionRegistry,
  ExtensionFactory,
  ModuleFactory,
} from "@voyant-travel/hono/composition"
import { type FrameworkProviders, frameworkComposition } from "./composition.js"
import { FRAMEWORK_RUNTIME_MANIFEST } from "./manifest.js"

/**
 * Config for {@link createVoyantApp}: the injected providers + deployment-local
 * additions, plus everything else `createApp` takes (db, auth, workflows,
 * outbox, publicPaths, …) — minus the `manifest`/`registry`/`capabilities` the
 * framework now assembles for you.
 */
export interface CreateVoyantAppConfig<
  TBindings extends VoyantBindings,
  TProviders extends FrameworkProviders,
> extends Omit<CreateAppConfig<TBindings, TProviders>, "manifest" | "registry" | "capabilities"> {
  /** The deployment-injected provider surface (a `FrameworkProviders` superset). */
  providers: TProviders
  /** Deployment-local module factories, appended after the standard set. */
  modules?: Record<string, ModuleFactory<TProviders>>
  /** Deployment-local extension factories, appended after the standard set. */
  extensions?: Record<string, ExtensionFactory<TProviders>>
}

/**
 * Assemble the standard manifest + registry (framework-owned) with the
 * deployment's local additions, then build the app via `@voyant-travel/hono`'s
 * `createApp`. Standard families keep their `FRAMEWORK_RUNTIME_MANIFEST` order;
 * local additions mount after them.
 */
export function createVoyantApp<
  TBindings extends VoyantBindings,
  TProviders extends FrameworkProviders,
>(config: CreateVoyantAppConfig<TBindings, TProviders>) {
  const { providers, modules = {}, extensions = {}, ...rest } = config

  const registry: CompositionRegistry<TProviders> = {
    // The framework factories read only the `FrameworkProviders` slice; a
    // `ModuleFactory<FrameworkProviders>` is assignable to
    // `ModuleFactory<TProviders>` (factory params are contravariant), so the
    // standard set composes against the deployment's wider providers.
    modules: {
      ...(frameworkComposition.modules as Record<string, ModuleFactory<TProviders>>),
      ...modules,
    },
    extensions: {
      ...(frameworkComposition.extensions as Record<string, ExtensionFactory<TProviders>>),
      ...extensions,
    },
  }

  return createApp<TBindings, TProviders>({
    ...rest,
    manifest: {
      modules: [...FRAMEWORK_RUNTIME_MANIFEST.modules, ...Object.keys(modules)],
      extensions: [...FRAMEWORK_RUNTIME_MANIFEST.extensions, ...Object.keys(extensions)],
    },
    registry,
    capabilities: providers,
  } as CreateAppConfig<TBindings, TProviders>)
}
