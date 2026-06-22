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
 * Subsetting (ADR-0007): the standard set is the DEFAULT, not a fixed profile,
 * with two ways to pare it down (modelled on Medusa's default-on modules):
 *   - `exclude` REMOVES a module a deployment doesn't run (e.g. flights);
 *   - `overrideCapabilities` REPLACES one — naming a capability token (e.g.
 *     `people-directory`) auto-displaces the standard module that provides it,
 *     so swapping Voyant CRM for HubSpot references the capability, not the
 *     module, and the two can't drift apart.
 * Both are validated against `FRAMEWORK_CAPABILITY_GRAPH`: dropping a depended-on
 * module with no substitute — or excluding an `isRequired` module — is a boot
 * error here, never a runtime 500.
 */

import { type CreateAppConfig, createApp, type VoyantBindings } from "@voyant-travel/hono"
import {
  type CapabilityGraph,
  type CompositionRegistry,
  type ExtensionFactory,
  findCapabilityGaps,
  findCapabilityProviders,
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
   * REMOVE (ADR-0007): standard module/extension specifiers to drop from the
   * framework set entirely — for a deployment that simply doesn't run them (e.g.
   * a non-flights operator excluding `@voyant-travel/flights`). Filters the
   * runtime manifest (and, once the schema side lands, drizzle generation, so
   * routes and tables drop together). Naming a specifier absent from the
   * standard set is a typo and throws; excluding an `isRequired` module throws.
   */
  exclude?: readonly string[]
  /**
   * REPLACE (ADR-0007): capability tokens this deployment takes over with its
   * own implementation (e.g. `["people-directory"]` when a HubSpot adapter
   * replaces Voyant CRM). The standard module that provides each token is
   * **auto-displaced** — you name the capability, not the module, so the two
   * can't fall out of sync (Medusa's override-by-key model). The substitute
   * implementation itself is injected through the typed `providers` container;
   * this only declares which capability the deployment is overriding.
   */
  overrideCapabilities?: readonly string[]
}

/** Options for {@link subsetStandardManifest}. See {@link CreateVoyantAppConfig}. */
export interface SubsetOptions {
  /** Specifiers to remove entirely (rejected if unknown or `isRequired`). */
  exclude?: readonly string[]
  /** Capability tokens overridden by a substitute (auto-displaces the default provider). */
  overrideCapabilities?: readonly string[]
}

/**
 * Apply `exclude` (remove) + `overrideCapabilities` (replace) to the standard
 * set (ADR-0007), returning the module/extension specifiers that should mount.
 * Pure and provider-free, so it is unit-testable and reusable by tooling
 * (`db doctor`). Throws — fail-loud at boot, never a runtime 500 — when:
 *
 *  - `exclude` names a specifier absent from the standard set (a typo);
 *  - `exclude` names an `isRequired` module (override it instead);
 *  - `overrideCapabilities` names a token no standard module provides (a no-op typo);
 *  - the resulting subset leaves a `requires` unmet by any provider or override.
 */
export function subsetStandardManifest({
  exclude = [],
  overrideCapabilities = [],
}: SubsetOptions = {}): { modules: string[]; extensions: string[] } {
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
          "Override their capability with a substitute instead of removing them.",
      )
    }
  }

  // REPLACE: each overridden capability displaces the standard module(s) that
  // provide it — you name the capability, the default provider is removed.
  const displaced = new Set<string>()
  for (const cap of overrideCapabilities) {
    const providers = findCapabilityProviders(
      FRAMEWORK_RUNTIME_MANIFEST.modules,
      FRAMEWORK_CAPABILITY_GRAPH,
      cap,
    )
    if (providers.length === 0) {
      throw new Error(
        `createVoyantApp: overrideCapabilities names "${cap}", which no standard module provides. ` +
          "Check the token, or drop it from overrideCapabilities.",
      )
    }
    for (const spec of providers) displaced.add(spec)
  }

  const drop = (spec: string) => excludeSet.has(spec) || displaced.has(spec)
  const modules = FRAMEWORK_RUNTIME_MANIFEST.modules.filter((m) => !drop(m))
  const extensions = FRAMEWORK_RUNTIME_MANIFEST.extensions.filter((e) => !drop(e))

  // The capability graph is validated over what actually mounts: dropping a
  // module a still-mounted module depends on — with neither a substitute nor the
  // consumer also removed — fails loudly here rather than as a runtime 500.
  const gaps = findCapabilityGaps(modules, FRAMEWORK_CAPABILITY_GRAPH, overrideCapabilities)
  if (gaps.length > 0) {
    const detail = gaps
      .map((g) => `"${g.capability}" (required by ${g.requiredBy.join(", ")})`)
      .join("; ")
    throw new Error(
      `createVoyantApp: subsetting leaves unmet capabilities: ${detail}. ` +
        "Exclude the consumers too, or override the capability with a substitute.",
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
  const {
    providers,
    modules = {},
    extensions = {},
    exclude,
    overrideCapabilities,
    ...rest
  } = config

  const { modules: standardModules, extensions: standardExtensions } = subsetStandardManifest({
    exclude,
    overrideCapabilities,
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
