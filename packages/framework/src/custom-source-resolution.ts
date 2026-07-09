/**
 * Resolve a managed profile's `customSource` module/extension lists into
 * composition factories.
 *
 * Managed custom source is the source-free path for bring-your-own packages
 * that are modules or extensions in Voyant's runtime vocabulary, rather than
 * plugin distribution bundles. The profile snapshot records npm specifier
 * strings under `customSource.modules` and `customSource.extensions`; this
 * resolver imports each package, finds the managed module/extension entry, and
 * returns a composition registry fragment keyed by the original specifier.
 *
 * The resulting records are passed to `createVoyantApp({ modules, extensions })`
 * so schema-owning custom modules get the same Hono route/admin-extension
 * treatment as deployment-local factories in a starter.
 */

import type { ExtensionFactory, ModuleFactory } from "@voyant-travel/hono/composition"
import type { HonoExtension, HonoModule } from "@voyant-travel/hono/module"

import type { FrameworkProviders } from "./composition-lazy.js"
import type { VoyantProjectManifest } from "./profile-types.js"

export interface ResolveManagedCustomSourceOptions {
  /**
   * Module loader, injectable for tests. Defaults to dynamic `import()`, which a
   * Node-first managed runtime supports for published custom module packages.
   */
  importModule?: (specifier: string) => Promise<Record<string, unknown>>
}

const MODULE_EXPORT_NAMES = [
  "voyantModule",
  "createVoyantModule",
  "createModule",
  "default",
] as const

const EXTENSION_EXPORT_NAMES = [
  "voyantExtension",
  "createVoyantExtension",
  "createExtension",
  "default",
] as const

/**
 * Resolve every specifier in `project.customSource.modules` to a module factory
 * keyed by the specifier. Throws a specifier-named error when a package exposes
 * no managed-module entry; managed profiles must fail loud at boot, never
 * silently drop a schema-owning route bundle.
 */
export async function resolveManagedCustomModules(
  project: Pick<VoyantProjectManifest, "customSource">,
  env: Record<string, unknown>,
  options: ResolveManagedCustomSourceOptions = {},
): Promise<Record<string, ModuleFactory<FrameworkProviders>>> {
  void env
  return resolveManagedCustomEntries<HonoModule, ModuleFactory<FrameworkProviders>>({
    specifiers: project.customSource?.modules ?? [],
    kind: "module",
    entryLabel: "managed-module",
    exportNames: MODULE_EXPORT_NAMES,
    isBareObject: isHonoModule,
    wrapBareObject: (value) => () => value,
    options,
  })
}

/**
 * Resolve every specifier in `project.customSource.extensions` to an extension
 * factory keyed by the specifier. Throws a specifier-named error when a package
 * exposes no managed-extension entry; managed profiles must fail loud at boot,
 * never silently drop admin/public extension routes.
 */
export async function resolveManagedCustomExtensions(
  project: Pick<VoyantProjectManifest, "customSource">,
  env: Record<string, unknown>,
  options: ResolveManagedCustomSourceOptions = {},
): Promise<Record<string, ExtensionFactory<FrameworkProviders>>> {
  void env
  return resolveManagedCustomEntries<HonoExtension, ExtensionFactory<FrameworkProviders>>({
    specifiers: project.customSource?.extensions ?? [],
    kind: "extension",
    entryLabel: "managed-extension",
    exportNames: EXTENSION_EXPORT_NAMES,
    isBareObject: isHonoExtension,
    wrapBareObject: (value) => () => value,
    options,
  })
}

async function resolveManagedCustomEntries<TBareObject, TFactory>(config: {
  specifiers: readonly string[]
  kind: "module" | "extension"
  entryLabel: "managed-module" | "managed-extension"
  exportNames: readonly string[]
  isBareObject: (value: unknown) => value is TBareObject
  wrapBareObject: (value: TBareObject) => TFactory
  options: ResolveManagedCustomSourceOptions
}): Promise<Record<string, TFactory>> {
  const importModule = config.options.importModule ?? defaultImportModule
  const resolved: Record<string, TFactory> = {}
  for (const specifier of config.specifiers) {
    let mod: Record<string, unknown>
    try {
      mod = await importModule(specifier)
    } catch (error) {
      throw new Error(
        `Failed to import custom ${config.kind} "${specifier}": ${errorMessage(error)}`,
      )
    }
    resolved[specifier] = pickManagedCustomEntry(mod, specifier, config)
  }
  return resolved
}

function pickManagedCustomEntry<TBareObject, TFactory>(
  mod: Record<string, unknown>,
  specifier: string,
  config: {
    entryLabel: "managed-module" | "managed-extension"
    exportNames: readonly string[]
    isBareObject: (value: unknown) => value is TBareObject
    wrapBareObject: (value: TBareObject) => TFactory
  },
): TFactory {
  for (const name of config.exportNames) {
    const candidate = mod[name]
    if (typeof candidate === "function") {
      return candidate as TFactory
    }
    if (config.isBareObject(candidate)) {
      return config.wrapBareObject(candidate)
    }
  }
  throw new Error(
    `Custom source "${specifier}" does not export a ${config.entryLabel} entry. ` +
      `Export one of: ${config.exportNames.join(", ")}`,
  )
}

function isHonoModule(value: unknown): value is HonoModule {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { module?: { name?: unknown } }).module?.name === "string"
  )
}

function isHonoExtension(value: unknown): value is HonoExtension {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { extension?: { module?: unknown; name?: unknown } }).extension?.module ===
      "string" &&
    typeof (value as { extension?: { name?: unknown } }).extension?.name === "string"
  )
}

function defaultImportModule(specifier: string): Promise<Record<string, unknown>> {
  return import(specifier) as Promise<Record<string, unknown>>
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
