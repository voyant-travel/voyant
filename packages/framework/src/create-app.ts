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
import type {
  CompositionRegistry,
  ExtensionFactory,
  ModuleFactory,
} from "@voyant-travel/hono/composition"
import { type FrameworkProviders, frameworkComposition } from "./composition-lazy.js"
import { subsetStandardManifest } from "./manifest.js"

/**
 * Standard families whose route loader is deployment-injected AND optional: when
 * the loader isn't provided, `createVoyantApp` auto-excludes the family (no
 * routes, no admin nav) instead of forcing the deployment to stub it or install
 * a data source it doesn't run. Keyed by manifest specifier → the
 * {@link FrameworkProviders} field that mounts it.
 *
 * `@voyant-travel/flights` has no first-party real connector yet — only the demo
 * adapter — so an operator that doesn't sell flights should never need to wire or
 * install one. "Not wired" is treated as "not run" (ADR-0007 subsetting).
 */
const OPTIONAL_FAMILY_LOADERS = {
  "@voyant-travel/flights": "loadFlightAdminRoutes",
} as const satisfies Record<string, keyof FrameworkProviders>

/**
 * The optional standard families whose injected loader is absent from
 * `providers` — auto-excluded so a deployment never has to stub a family (or
 * install its demo/data source) it doesn't run. Exported for tests.
 */
export function optionalFamiliesToExclude(providers: Partial<FrameworkProviders>): string[] {
  return Object.entries(OPTIONAL_FAMILY_LOADERS)
    .filter(([, field]) => providers[field] == null)
    .map(([specifier]) => specifier)
}

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
   * Mount the legacy framework-owned standard registry. Graph-native hosts set
   * this to false and pass their admitted, selected factories explicitly.
   */
  standard?: boolean
  /**
   * REMOVE (ADR-0007): standard module *and/or extension* specifiers to drop from
   * the framework set entirely — for a deployment that simply doesn't run them
   * (e.g. a non-flights operator excluding `@voyant-travel/flights`). Filters the
   * runtime manifest and admin surface. Naming a specifier absent from the
   * standard set is a typo and throws; excluding an `isRequired` module throws;
   * excluding a module another mounted module depends on throws, naming the
   * consumers (drop those too).
   *
   * Excluding a module cascades to the standard extensions it owns: an extension's
   * mount prefix is a path, not a foreign key to a mounted module, so ownership is
   * declared in `FRAMEWORK_EXTENSION_OWNERSHIP` and its augmenting extensions are
   * dropped automatically (voyant#2104) — no need to list them here.
   *
   * Schema is unaffected: the managed migration bundle is monolithic, so an
   * excluded module's tables are still created but left inert (no routes/nav
   * reach them). `voyant db doctor` treats them as expected-absent, not drift.
   *
   * To *replace* a module's capability with a substitute (e.g. HubSpot for CRM)
   * rather than removing it — override-by-capability — is the v2 design and not
   * yet wired (ADR-0007 "Deferred to v2").
   */
  exclude?: readonly string[]
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
  const { providers, modules = {}, extensions = {}, exclude, standard = true, ...rest } = config

  // Auto-exclude optional standard families whose injected loader wasn't provided
  // (e.g. flights on a deployment that doesn't sell them) — merged with the
  // explicit `exclude`, then cascaded to owned extensions by subsetStandardManifest.
  const resolvedExclude = [...(exclude ?? []), ...optionalFamiliesToExclude(providers)]

  const selected = standard
    ? subsetStandardManifest({ exclude: resolvedExclude })
    : { modules: [], extensions: [] }
  const missingFactories = [
    ...selected.modules.filter(
      (specifier) => frameworkComposition.modules[specifier] === undefined,
    ),
    ...selected.extensions.filter(
      (specifier) => frameworkComposition.extensions?.[specifier] === undefined,
    ),
  ]
  if (missingFactories.length > 0) {
    throw new Error(
      `createVoyantApp cannot compose graph-owned standard units: ${missingFactories.join(", ")}. Use the selected deployment graph runtime instead of the legacy standard registry.`,
    )
  }

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
      modules: [...selected.modules, ...Object.keys(modules)],
      extensions: [...selected.extensions, ...Object.keys(extensions)],
    },
    registry,
    capabilities: providers,
  } as CreateAppConfig<TBindings, TProviders>)
}
