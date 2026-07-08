/**
 * Resolve a managed profile's `plugins` list into runnable bundles.
 *
 * The managed profile contract (`defineVoyantProject`) records plugins as npm
 * specifier strings — e.g. `"@voyant-travel/plugin-stripe"` — plus per-plugin
 * config under `settings[specifier]`. A source-free managed deployment can't
 * hand `createVoyantApp` an inline plugin object the way a starter fork does, so
 * the runtime resolves each specifier at boot: it imports the package, finds its
 * managed-plugin factory, and invokes it with the plugin's settings and the
 * deployment env. The resulting bundles are passed to `createVoyantApp` exactly
 * as a starter's inline `plugins: [...]` would be.
 *
 * ## Managed-plugin entry contract
 *
 * A package participates in managed profiles by exporting a factory named
 * `voyantPlugin` (preferred), `createVoyantPlugin`, or `createPlugin`, or a
 * `default` export that is a factory:
 *
 * ```ts
 * import { definePlugin } from "@voyant-travel/core"
 *
 * export const voyantPlugin: VoyantManagedPluginFactory = ({ settings }) =>
 *   stripePlugin(parseStripeSettings(settings))
 * ```
 *
 * The factory receives {@link VoyantManagedPluginContext} (`settings` from the
 * profile, `env` for secrets/bindings) and returns a bundle. A package may also
 * export an already-built plugin object under one of those names; it is used
 * as-is. Node-first managed runtimes support dynamic `import()`, so no bundling
 * or registry indirection is required.
 */

import type { Plugin } from "@voyant-travel/core"
import type { HonoBundleInput } from "@voyant-travel/hono/plugin"

import type { VoyantProjectJsonValue, VoyantProjectManifest } from "./profile-types.js"

/** A resolved managed plugin — either a Hono bundle or a transport-agnostic core plugin. */
export type ManagedPlugin = HonoBundleInput | Plugin

/** Context handed to a managed-plugin factory at resolution time. */
export interface VoyantManagedPluginContext {
  /** The npm specifier the plugin was resolved from. */
  specifier: string
  /** The plugin's config from the profile `settings[specifier]`, if any. */
  settings: VoyantProjectJsonValue | undefined
  /** The deployment env bag (secrets, connection config, bindings). */
  env: Record<string, unknown>
}

/** A managed-plugin factory: profile settings + env in, a plugin bundle out. */
export type VoyantManagedPluginFactory = (
  context: VoyantManagedPluginContext,
) => ManagedPlugin | Promise<ManagedPlugin>

export interface ResolveManagedPluginsOptions {
  /**
   * Module loader, injectable for tests. Defaults to dynamic `import()`, which a
   * Node-first managed runtime supports for published plugin packages.
   */
  importModule?: (specifier: string) => Promise<Record<string, unknown>>
}

const FACTORY_EXPORT_NAMES = [
  "voyantPlugin",
  "createVoyantPlugin",
  "createPlugin",
  "default",
] as const

/**
 * Resolve every specifier in `project.plugins` to a runnable bundle, in profile
 * order. Throws a specifier-named error when a package exposes no managed-plugin
 * entry or its factory fails — a managed profile must fail loud at boot, never
 * silently drop a configured integration.
 */
export async function resolveManagedPlugins(
  project: Pick<VoyantProjectManifest, "plugins" | "settings">,
  env: Record<string, unknown>,
  options: ResolveManagedPluginsOptions = {},
): Promise<ManagedPlugin[]> {
  const importModule = options.importModule ?? defaultImportModule
  const resolved: ManagedPlugin[] = []
  for (const specifier of project.plugins) {
    let mod: Record<string, unknown>
    try {
      mod = await importModule(specifier)
    } catch (error) {
      throw new Error(`Failed to import managed plugin "${specifier}": ${errorMessage(error)}`)
    }
    const factory = pickPluginFactory(mod, specifier)
    const context: VoyantManagedPluginContext = {
      specifier,
      settings: project.settings[specifier],
      env,
    }
    let bundle: ManagedPlugin
    try {
      bundle = await factory(context)
    } catch (error) {
      throw new Error(`Managed plugin "${specifier}" factory threw: ${errorMessage(error)}`)
    }
    resolved.push(assertPluginShape(bundle, specifier))
  }
  return resolved
}

function pickPluginFactory(
  mod: Record<string, unknown>,
  specifier: string,
): VoyantManagedPluginFactory {
  for (const name of FACTORY_EXPORT_NAMES) {
    const candidate = mod[name]
    if (typeof candidate === "function") {
      return candidate as VoyantManagedPluginFactory
    }
    if (isPluginObject(candidate)) {
      const built = candidate
      return () => built
    }
  }
  throw new Error(
    `Managed plugin "${specifier}" does not export a managed-plugin entry. ` +
      `Export one of: ${FACTORY_EXPORT_NAMES.join(", ")} (a factory or a built plugin).`,
  )
}

function assertPluginShape(bundle: unknown, specifier: string): ManagedPlugin {
  if (!isPluginObject(bundle)) {
    throw new Error(
      `Managed plugin "${specifier}" resolved to a value without a "name" — ` +
        "a plugin factory must return a plugin/bundle object.",
    )
  }
  return bundle as ManagedPlugin
}

function isPluginObject(value: unknown): value is ManagedPlugin {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { name?: unknown }).name === "string"
  )
}

function defaultImportModule(specifier: string): Promise<Record<string, unknown>> {
  return import(specifier) as Promise<Record<string, unknown>>
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
