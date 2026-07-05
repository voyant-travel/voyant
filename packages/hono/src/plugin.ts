import type {
  BootstrapHandler,
  EventFilterDescriptor,
  LinkDefinition,
  Subscriber,
  WorkflowDescriptor,
} from "@voyant-travel/core"

import type { HonoExtension, HonoModule } from "./module.js"

/**
 * Hono-flavoured bundle contribution surface.
 *
 * `@voyant-travel/hono` is the default HTTP transport adapter for Voyant. The
 * preferred `HonoBundle` term describes reusable packages that contribute
 * {@link HonoModule} / {@link HonoExtension} wrappers that can carry HTTP
 * routes. `HonoPlugin` remains as a compatibility alias for the same shape.
 *
 * Registered via `createApp({ plugins: [...] })` — the app factory expands
 * each bundle into the underlying modules, extensions, subscribers, and link
 * definitions before mounting them.
 */
export interface HonoBundle {
  /** Unique bundle identifier (e.g. "payload-cms", "bokun"). */
  name: string
  /** Optional version tag for diagnostics. */
  version?: string
  /** Optional lazy runtime bootstrap executed once per app/isolate. */
  bootstrap?: BootstrapHandler
  /** Hono modules (module + routes) contributed by the plugin. */
  modules?: HonoModule[]
  /** Hono extensions (extension + routes) contributed by the plugin. */
  extensions?: HonoExtension[]
  /** Event subscribers wired to the caller's event bus, when provided. */
  subscribers?: Subscriber[]
  /** Link definitions contributed by the plugin. */
  links?: LinkDefinition[]
  /**
   * Absolute API paths this bundle exposes that are reachable WITHOUT a session
   * (ADR-0008). Unlike a module/extension's `anonymous` (relative to its
   * `/v1/public` mount), bundle routes can mount anywhere — e.g. a payment
   * processor's webhook at `/v1/finance/providers/netopia/callback`, which the
   * processor's servers POST to without a cookie or bearer. Declaring it here
   * keeps the "reachable-without-auth" decision with the plugin that owns the
   * route, instead of in every deployment's `publicPaths`. The framework folds
   * these into the assembled anonymous allow-list.
   */
  anonymous?: string[]
  /**
   * Workflows contributed by the plugin. Mirrors the `Plugin.workflows`
   * field in `@voyant-travel/core` — collected at `createApp()` boot and
   * registered with the configured workflow driver.
   */
  workflows?: readonly WorkflowDescriptor[]
  /**
   * Event filters contributed by the plugin. Mirrors
   * `Plugin.eventFilters` in `@voyant-travel/core`.
   */
  eventFilters?: readonly EventFilterDescriptor[]
}

/** @deprecated Prefer {@link HonoBundle}. */
export type HonoPlugin = HonoBundle

const LAZY_HONO_BUNDLE = Symbol.for("voyant.hono.lazyBundle")

/**
 * Lazy bundle declaration. The bundle's heavy runtime graph is imported only
 * when a declared route matcher is hit, unless `loadOnBootstrap` asks the app
 * to load it during request/headless bootstrap. `name` and `anonymous` remain
 * eager metadata so duplicate checks and auth allow-lists stay fail-closed.
 */
export interface LazyHonoBundle {
  readonly [LAZY_HONO_BUNDLE]: true
  /** Unique bundle identifier matching the loaded bundle's `name`. */
  name: string
  /** Optional version tag for diagnostics. */
  version?: string
  /**
   * Absolute unauthenticated paths contributed by the eventual bundle. Declare
   * webhook/callback paths here so the first matching request can pass auth
   * before the bundle has been imported.
   */
  anonymous?: string[]
  /**
   * Absolute route matchers the eventual bundle may serve. Required for lazy
   * bundles that contribute HTTP routes because Hono routes must be registered
   * before the first request builds the matcher.
   */
  routes?: readonly string[]
  /**
   * Module names whose lazy-loaded routes must receive a transaction-capable DB
   * client. This is eager metadata so the first matching request is routed to
   * `dbTransactional` before the bundle implementation is imported.
   */
  transactionalModules?: readonly string[]
  /**
   * Absolute API path prefixes whose lazy-loaded routes must receive the
   * transaction-capable DB client. Use this when only a subset of the lazy
   * bundle's explicit `routes` require transactions.
   */
  transactionalPaths?: readonly string[]
  /**
   * Load this bundle during app bootstrap instead of waiting for a declared
   * route matcher. Set this for lazy bundles that contribute subscribers,
   * workflow metadata, container services, or bootstraps needed before a
   * bundle-owned route is hit.
   */
  loadOnBootstrap?: boolean
  /** Loads and constructs the real bundle. Memoized by `mountApp`. */
  load: () => Promise<HonoBundle>
}

export type HonoBundleInput = HonoBundle | LazyHonoBundle

/**
 * Identity helper — returns the bundle unchanged, purely for IDE inference.
 */
export function defineHonoBundle<P extends HonoBundle>(bundle: P): P {
  return bundle
}

export function defineLazyHonoBundle<P extends Omit<LazyHonoBundle, typeof LAZY_HONO_BUNDLE>>(
  bundle: P,
): P & LazyHonoBundle {
  return { ...bundle, [LAZY_HONO_BUNDLE]: true } as P & LazyHonoBundle
}

export function isLazyHonoBundle(bundle: HonoBundleInput): bundle is LazyHonoBundle {
  return (bundle as LazyHonoBundle)[LAZY_HONO_BUNDLE] === true
}

/** @deprecated Prefer {@link defineHonoBundle}. */
export const defineHonoPlugin = defineHonoBundle

export interface ExpandedHonoBundles {
  modules: HonoModule[]
  extensions: HonoExtension[]
  subscribers: Subscriber[]
  links: LinkDefinition[]
  /** Absolute anonymous-access paths declared by bundles (ADR-0008). */
  anonymousPaths: string[]
}

/** @deprecated Prefer {@link ExpandedHonoBundles}. */
export type ExpandedHonoPlugins = ExpandedHonoBundles

/**
 * Flatten a list of {@link HonoBundle} values into their constituent pieces.
 *
 * Throws if two bundles declare the same `name`.
 */
export function expandHonoBundles(bundles: ReadonlyArray<HonoBundle>): ExpandedHonoBundles {
  const seen = new Set<string>()
  const modules: HonoModule[] = []
  const extensions: HonoExtension[] = []
  const subscribers: Subscriber[] = []
  const links: LinkDefinition[] = []
  const anonymousPaths: string[] = []

  for (const bundle of bundles) {
    if (seen.has(bundle.name)) {
      throw new Error(`Duplicate bundle name: "${bundle.name}"`)
    }
    seen.add(bundle.name)

    if (bundle.modules) modules.push(...bundle.modules)
    if (bundle.extensions) extensions.push(...bundle.extensions)
    if (bundle.subscribers) subscribers.push(...bundle.subscribers)
    if (bundle.links) links.push(...bundle.links)
    if (bundle.anonymous) anonymousPaths.push(...bundle.anonymous)
  }

  return { modules, extensions, subscribers, links, anonymousPaths }
}

/** @deprecated Prefer {@link expandHonoBundles}. */
export const expandHonoPlugins = expandHonoBundles
