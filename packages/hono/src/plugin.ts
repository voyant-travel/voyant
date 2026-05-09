import type {
  BootstrapHandler,
  EventFilterDescriptor,
  LinkDefinition,
  Subscriber,
  WorkflowDescriptor,
} from "@voyantjs/core"

import type { HonoExtension, HonoModule } from "./module.js"

/**
 * Hono-flavoured bundle contribution surface.
 *
 * `@voyantjs/hono` is the default HTTP transport adapter for Voyant. The
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
   * Workflows contributed by the plugin. Mirrors the `Plugin.workflows`
   * field in `@voyantjs/core` — collected at `createApp()` boot and
   * registered with the configured workflow driver.
   */
  workflows?: readonly WorkflowDescriptor[]
  /**
   * Event filters contributed by the plugin. Mirrors
   * `Plugin.eventFilters` in `@voyantjs/core`.
   */
  eventFilters?: readonly EventFilterDescriptor[]
}

/** @deprecated Prefer {@link HonoBundle}. */
export type HonoPlugin = HonoBundle

/**
 * Identity helper — returns the bundle unchanged, purely for IDE inference.
 */
export function defineHonoBundle<P extends HonoBundle>(bundle: P): P {
  return bundle
}

/** @deprecated Prefer {@link defineHonoBundle}. */
export const defineHonoPlugin = defineHonoBundle

export interface ExpandedHonoBundles {
  modules: HonoModule[]
  extensions: HonoExtension[]
  subscribers: Subscriber[]
  links: LinkDefinition[]
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

  for (const bundle of bundles) {
    if (seen.has(bundle.name)) {
      throw new Error(`Duplicate bundle name: "${bundle.name}"`)
    }
    seen.add(bundle.name)

    if (bundle.modules) modules.push(...bundle.modules)
    if (bundle.extensions) extensions.push(...bundle.extensions)
    if (bundle.subscribers) subscribers.push(...bundle.subscribers)
    if (bundle.links) links.push(...bundle.links)
  }

  return { modules, extensions, subscribers, links }
}

/** @deprecated Prefer {@link expandHonoBundles}. */
export const expandHonoPlugins = expandHonoBundles
