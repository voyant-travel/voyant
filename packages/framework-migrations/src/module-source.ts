/**
 * Load a schema-owning module PACKAGE's pre-built `migrations/` folder as a
 * collector {@link MigrationSource}, resolved by package NAME (voyant#3069).
 *
 * A source-backed deployment discovers each package's migrations via its
 * generated schema-path list ({@link discoverMigrationSources}); a **source-free
 * managed image** has no such list — it only knows the module package NAMES its
 * profile snapshot declares. This resolves a declared module's package root and
 * loads its `migrations/` the same way {@link loadFrameworkBundleSource} loads
 * the framework bundle, so the managed migrate booter can apply
 * `[framework, ...customModules]` deps-first with no drizzle-kit generation.
 *
 * The convention (Option 1 of voyant#3069): a schema-owning module package ships
 * a committed drizzle `migrations/` folder (`meta/_journal.json` + `*.sql`).
 * Modules that own no schema (e.g. payment plugins) ship none, and resolve to
 * `null` here — they need no migrations and are simply skipped.
 */

import { existsSync, readFileSync, statSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import type { MigrationSource } from "./collector.js"
import { loadMigrationFolder } from "./load-folder.js"

export interface LoadModuleBundleSourceOptions {
  /**
   * Apply order across sources (lower first). MUST be greater than the framework
   * bundle's `0` — a module's tables FK into framework tables, so the framework
   * bundle applies first.
   */
  priority: number
  /**
   * Module specifier/file to resolve `packageName` from (a path or `file:` URL).
   * Defaults to this module's location; pass the deployment's own location so
   * the module resolves against the deployment's installed dependency tree.
   */
  resolveFrom?: string | URL
  /**
   * Additional resolution roots tried (in order) BEFORE {@link resolveFrom} when
   * locating the package. A schema-owning package delivered by a sealed product
   * distribution (e.g. the operator-standard BOM) is a TRANSITIVE dependency
   * nested under that distribution's own `node_modules`, so it is not resolvable
   * from the deployment root; pass the distribution directory here so its
   * `migrations/` is found the same way the build-time resolver found it.
   */
  resolutionRoots?: readonly string[]
  /**
   * Ledger source name (recorded in `_voyant_migrations`). Defaults to the
   * package's unscoped name so the same module records under one stable name
   * across source and managed modes. Override only to match an existing ledger.
   */
  name?: string
  /** Resolved migrations folder, bypassing package resolution (mainly for tests). */
  migrationsDir?: string
}

/** The unscoped package name (`@acme/loyalty` → `loyalty`) used as the ledger source name. */
export function moduleSourceName(packageName: string): string {
  return packageName.replace(/^@[^/]+\//, "")
}

/**
 * Walk up from a resolved entry file to the package root — the nearest ancestor
 * whose `package.json` `name` matches `packageName`. Robust to `dist/` nesting
 * and any scope, unlike a node_modules path regex.
 */
function resolvePackageRoot(packageName: string, entryPath: string): string | null {
  let dir = dirname(entryPath)
  for (;;) {
    const packageJsonPath = join(dir, "package.json")
    if (existsSync(packageJsonPath)) {
      try {
        const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { name?: string }
        if (parsed.name === packageName) return dir
      } catch {
        // Unreadable/partial package.json — keep walking.
      }
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/** The directory to start a `node_modules` walk from, given a file/dir path or `file:` URL. */
function toStartDir(resolveFrom: string | URL): string {
  const path =
    resolveFrom instanceof URL ||
    (typeof resolveFrom === "string" && resolveFrom.startsWith("file:"))
      ? fileURLToPath(resolveFrom)
      : resolveFrom
  try {
    return statSync(path).isDirectory() ? path : dirname(path)
  } catch {
    return dirname(path)
  }
}

/**
 * Locate an installed package's root by walking `node_modules` up from
 * `resolveFrom`, matching the `package.json` `name`. Ignores package `exports`
 * conditions, so it resolves ESM-only ("import"-only) packages that
 * `require.resolve` rejects with `ERR_PACKAGE_PATH_NOT_EXPORTED` — the publish
 * shape used across this repo. Only the package root is needed here (to read its
 * committed `migrations/`), so no entry-point resolution is required.
 */
function findInstalledPackageRoot(packageName: string, resolveFrom: string | URL): string | null {
  let dir = toStartDir(resolveFrom)
  for (;;) {
    const packageJsonPath = join(dir, "node_modules", packageName, "package.json")
    if (existsSync(packageJsonPath)) {
      try {
        const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { name?: string }
        if (parsed.name === packageName) return dirname(packageJsonPath)
      } catch {
        // Unreadable/partial package.json — keep walking.
      }
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

function resolveModuleMigrationsDir(packageName: string, resolveFrom: string | URL): string | null {
  let entryPath: string | null = null
  try {
    entryPath = createRequire(resolveFrom).resolve(packageName)
  } catch {
    // ESM-only packages (import-only `exports`) reject the CommonJS `require`
    // condition — fall back to a package-root walk that ignores export conditions.
    entryPath = null
  }
  const root = entryPath
    ? resolvePackageRoot(packageName, entryPath)
    : findInstalledPackageRoot(packageName, resolveFrom)
  return root ? join(root, "migrations") : null
}

/**
 * Resolve a package's `migrations/` folder, trying each declared resolution root
 * (in order) before the default `resolveFrom`. Each root is walked for a nested
 * `node_modules/<packageName>`; the first hit that yields a migrations folder
 * wins. Returns `null` when no root resolves the package.
 */
function resolveModuleMigrationsDirFromRoots(
  packageName: string,
  options: LoadModuleBundleSourceOptions,
): string | null {
  for (const root of options.resolutionRoots ?? []) {
    const migrationsDir = resolveModuleMigrationsDir(packageName, root)
    if (migrationsDir) return migrationsDir
  }
  return resolveModuleMigrationsDir(packageName, options.resolveFrom ?? import.meta.url)
}

/**
 * Load a module package's pre-built migrations as a {@link MigrationSource}, or
 * `null` when the package ships no `migrations/` folder (it owns no schema).
 * Throws only if a present `migrations/` folder is malformed (missing SQL a
 * journal references) — a packaging error, surfaced rather than applied partially.
 */
export async function loadModuleBundleSource(
  packageName: string,
  options: LoadModuleBundleSourceOptions,
): Promise<MigrationSource | null> {
  const migrationsDir =
    options.migrationsDir ?? resolveModuleMigrationsDirFromRoots(packageName, options)
  if (!migrationsDir) return null
  if (!existsSync(join(migrationsDir, "meta", "_journal.json"))) return null

  return {
    name: options.name ?? moduleSourceName(packageName),
    priority: options.priority,
    migrations: await loadMigrationFolder(migrationsDir),
  }
}

export interface CollectDeploymentMigrationSourcesOptions {
  /** Framework bundle folder override (defaults to the shipped bundle). */
  frameworkBundleDir?: string
  /**
   * Custom schema-owning module package names to load AFTER the framework
   * bundle, in deps-first order (framework metadata's `moduleSources`).
   */
  modulePackages?: readonly string[]
  /** Where to resolve module packages from (the deployment's location). */
  resolveFrom?: string | URL
}

/**
 * The ordered migration sources for a deployment: the framework bundle
 * (priority 0) followed by each declared custom schema-owning module's pre-built
 * migrations (priority 1..n, in declaration order). Pass the result straight to
 * `runDeploymentMigrations`. Modules that ship no migrations are skipped.
 */
export async function collectDeploymentMigrationSources(
  options: CollectDeploymentMigrationSourcesOptions = {},
): Promise<MigrationSource[]> {
  // Imported lazily to keep this module usable without eagerly resolving the
  // shipped framework bundle folder when only module sources are wanted.
  const { loadFrameworkBundleSource } = await import("./bundle.js")
  const sources: MigrationSource[] = [await loadFrameworkBundleSource(options.frameworkBundleDir)]

  let priority = 1
  for (const packageName of options.modulePackages ?? []) {
    const source = await loadModuleBundleSource(packageName, {
      priority,
      ...(options.resolveFrom ? { resolveFrom: options.resolveFrom } : {}),
    })
    if (source) {
      sources.push(source)
      priority += 1
    }
  }
  return sources
}
