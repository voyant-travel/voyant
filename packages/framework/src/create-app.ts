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
 * Subsetting (ADR-0007): the standard set is the DEFAULT, not a fixed profile.
 * A deployment may `exclude` standard modules/extensions (e.g. swap Voyant CRM
 * for HubSpot) and declare the capabilities it satisfies via an injected
 * substitute (`provideCapabilities`). The exclusion is validated against
 * `FRAMEWORK_CAPABILITY_GRAPH`: dropping a module a still-mounted module depends
 * on — without providing a substitute — is a boot error here, not a runtime 500.
 */

import { type CreateAppConfig, createApp, type VoyantBindings } from "@voyant-travel/hono"
import {
  type CompositionRegistry,
  type ExtensionFactory,
  findCapabilityGaps,
  type ModuleFactory,
} from "@voyant-travel/hono/composition"
import { type FrameworkProviders, frameworkComposition } from "./composition.js"
import { FRAMEWORK_CAPABILITY_GRAPH, FRAMEWORK_RUNTIME_MANIFEST } from "./manifest.js"

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
  /**
   * Standard module/extension specifiers to drop from the framework set
   * (ADR-0007). Filters both the runtime manifest and — once the schema side
   * lands — drizzle generation, so routes and tables drop together. Naming a
   * specifier absent from the standard set is a typo and throws.
   */
  exclude?: readonly string[]
  /**
   * Capability tokens this deployment satisfies via an injected substitute
   * (e.g. `["people-directory"]` when a HubSpot `PeopleDirectory` replaces the
   * excluded `@voyant-travel/relationships`). Lets a depended-on standard module
   * be excluded without tripping the capability-gap check.
   */
  provideCapabilities?: readonly string[]
}

/**
 * Apply `exclude` + capability validation to the standard set (ADR-0007),
 * returning the standard module/extension specifiers that should mount. Pure and
 * provider-free so it is unit-testable and reusable by tooling (`db doctor`).
 *
 * Throws when `exclude` names a specifier that isn't in the standard set (a
 * typo), or when the resulting subset leaves a required capability unmet and no
 * substitute is declared in `provideCapabilities`.
 */
export function subsetStandardManifest(
  exclude: readonly string[] = [],
  provideCapabilities: readonly string[] = [],
): { modules: string[]; extensions: string[] } {
  const excludeSet = new Set(exclude)

  if (excludeSet.size > 0) {
    const known = new Set<string>([
      ...FRAMEWORK_RUNTIME_MANIFEST.modules,
      ...FRAMEWORK_RUNTIME_MANIFEST.extensions,
    ])
    const unknown = [...excludeSet].filter((spec) => !known.has(spec)).sort()
    if (unknown.length > 0) {
      throw new Error(
        `createVoyantApp: exclude names ${unknown.length} specifier(s) not in the standard set: ` +
          `${unknown.join(", ")}. Only standard framework modules/extensions can be excluded.`,
      )
    }
  }

  const modules = FRAMEWORK_RUNTIME_MANIFEST.modules.filter((m) => !excludeSet.has(m))
  const extensions = FRAMEWORK_RUNTIME_MANIFEST.extensions.filter((e) => !excludeSet.has(e))

  // The capability graph is validated over what actually mounts: dropping a
  // module a still-mounted module depends on — with no injected substitute —
  // fails loudly here rather than as a runtime 500.
  const gaps = findCapabilityGaps(modules, FRAMEWORK_CAPABILITY_GRAPH, provideCapabilities)
  if (gaps.length > 0) {
    const detail = gaps
      .map((g) => `"${g.capability}" (required by ${g.requiredBy.join(", ")})`)
      .join("; ")
    throw new Error(
      `createVoyantApp: exclude leaves unmet capabilities: ${detail}. ` +
        "Exclude the consumers too, or inject a substitute and list the token in `provideCapabilities`.",
    )
  }

  return { modules, extensions }
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
  const { providers, modules = {}, extensions = {}, exclude, provideCapabilities, ...rest } = config

  const { modules: standardModules, extensions: standardExtensions } = subsetStandardManifest(
    exclude,
    provideCapabilities,
  )

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
      modules: [...standardModules, ...Object.keys(modules)],
      extensions: [...standardExtensions, ...Object.keys(extensions)],
    },
    registry,
    capabilities: providers,
  } as CreateAppConfig<TBindings, TProviders>)
}
