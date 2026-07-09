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
 * Subsetting (ADR-0007): the standard set is the DEFAULT, not a fixed profile —
 * built-ins always mount and a deployment subtracts what it doesn't run. Phase 1
 * ships ONE way to pare it down — `exclude`, which REMOVES a module a deployment
 * doesn't run (e.g. flights). It is validated against
 * `FRAMEWORK_CAPABILITY_GRAPH`: dropping a
 * depended-on module, or an `isRequired` one, is a boot error here, never a
 * runtime 500.
 *
 * Capability *replacement* (swap Voyant CRM for HubSpot via override-by-capability
 * + injected ports) is the documented v2 design — see ADR-0007 "Deferred to v2".
 * It is intentionally NOT wired here: there is no `PeopleDirectory` port yet, and
 * `legal`/`storefront` still import `relationships` directly, so an override knob
 * would silently mis-resolve rather than swap. Removal (`exclude`) works fully
 * today; replacement does not, so it isn't exposed.
 */

import { type CreateAppConfig, createApp, type VoyantBindings } from "@voyant-travel/hono"
import {
  type CapabilityGraph,
  type CompositionRegistry,
  type ExtensionFactory,
  findCapabilityGaps,
  type ModuleFactory,
} from "@voyant-travel/hono/composition"
import { type FrameworkProviders, frameworkComposition } from "./composition-lazy.js"
import {
  FRAMEWORK_CAPABILITY_GRAPH,
  FRAMEWORK_EXTENSION_OWNERSHIP,
  FRAMEWORK_RUNTIME_MANIFEST,
} from "./manifest.js"

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
   * REMOVE (ADR-0007): standard module *and/or extension* specifiers to drop from
   * the framework set entirely — for a deployment that simply doesn't run them
   * (e.g. a non-flights operator excluding `@voyant-travel/flights`). Filters the
   * runtime manifest (and, once the schema side lands, drizzle generation, so
   * routes and tables drop together). Naming a specifier absent from the standard
   * set is a typo and throws; excluding an `isRequired` module throws; excluding a
   * module another mounted module depends on throws, naming the consumers (drop
   * those too).
   *
   * Note: an extension's mount prefix (`extension.module`) is a path, not a
   * foreign key to a mounted module, so excluding a module does NOT auto-drop the
   * standard extensions that augment its surface — list those extension
   * specifiers here too. Automatic cascade needs explicit module→extension
   * ownership metadata (a follow-up; see ADR-0007).
   *
   * To *replace* a module's capability with a substitute (e.g. HubSpot for CRM)
   * rather than removing it — override-by-capability — is the v2 design and not
   * yet wired (ADR-0007 "Deferred to v2").
   */
  exclude?: readonly string[]
}

/** Options for {@link subsetStandardManifest}. See {@link CreateVoyantAppConfig}. */
export interface SubsetOptions {
  /** Specifiers to remove entirely (rejected if unknown, `isRequired`, or depended-on). */
  exclude?: readonly string[]
}

/**
 * The standard extensions owned by any of the excluded specifiers — an extension
 * whose declared owner module (see `FRAMEWORK_EXTENSION_OWNERSHIP`) is being
 * removed. Excluding a module must cascade to these, or the removed surface
 * partially leaks: e.g. dropping `bookings` while `finance/bookings-create-extension`
 * (mounting under `/v1/admin/bookings`) stays mounted (voyant#2104). Ownership is
 * declared, not name-matched, so path-mounted extensions cascade correctly.
 */
export function ownedExtensionsForExcludedModules(excluded: Iterable<string>): string[] {
  const excludedSet = excluded instanceof Set ? excluded : new Set(excluded)
  const owned: string[] = []
  for (const extension of FRAMEWORK_RUNTIME_MANIFEST.extensions) {
    const owners = FRAMEWORK_EXTENSION_OWNERSHIP[extension]
    if (owners.some((owner) => excludedSet.has(owner))) owned.push(extension)
  }
  return owned
}

/**
 * Apply `exclude` to the standard set (ADR-0007), returning the module/extension
 * specifiers that should mount. Pure and provider-free, so it is unit-testable and
 * reusable by tooling (`db doctor`). Throws — fail-loud at boot, never a runtime
 * 500 — when `exclude` names a specifier absent from the standard set (a typo),
 * names an `isRequired` module, or leaves a still-mounted module's `requires`
 * unmet (drop the consumers too).
 */
export function subsetStandardManifest({ exclude = [] }: SubsetOptions = {}): {
  modules: string[]
  extensions: string[]
} {
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

    const graph: CapabilityGraph = FRAMEWORK_CAPABILITY_GRAPH
    const required = [...excludeSet].filter((spec) => graph[spec]?.isRequired).sort()
    if (required.length > 0) {
      throw new Error(
        `createVoyantApp: cannot exclude required module(s): ${required.join(", ")}. ` +
          "They are foundational and cannot be removed.",
      )
    }
  }

  // Cascade: dropping a module also drops the standard extensions it owns. They
  // mount under the module's surface, so leaving them would partially leak the
  // removed surface. Ownership is declared (`FRAMEWORK_EXTENSION_OWNERSHIP`), so
  // path-mounted extensions cascade by declaration rather than an unsound
  // name-match (voyant#2104). Idempotent — already-excluded extensions no-op.
  for (const extension of ownedExtensionsForExcludedModules(excludeSet)) {
    excludeSet.add(extension)
  }

  const modules = FRAMEWORK_RUNTIME_MANIFEST.modules.filter((m) => !excludeSet.has(m))
  const extensions = FRAMEWORK_RUNTIME_MANIFEST.extensions.filter((e) => !excludeSet.has(e))

  // The capability graph is validated over what actually mounts: dropping a
  // module a still-mounted module depends on — without also dropping the consumer
  // — fails loudly here rather than as a runtime 500.
  const gaps = findCapabilityGaps(modules, FRAMEWORK_CAPABILITY_GRAPH)
  if (gaps.length > 0) {
    const detail = gaps
      .map((g) => `"${g.capability}" (required by ${g.requiredBy.join(", ")})`)
      .join("; ")
    throw new Error(
      `createVoyantApp: exclude leaves unmet capabilities: ${detail}. ` +
        "Exclude the consumers too (capability replacement is a future release).",
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
  const { providers, modules = {}, extensions = {}, exclude, ...rest } = config

  const { modules: standardModules, extensions: standardExtensions } = subsetStandardManifest({
    exclude,
  })

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
