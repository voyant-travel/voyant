/**
 * Voyant configuration manifest.
 *
 * `voyant.config.ts` is a **manifest**, not a runtime config — it exists to
 * power tooling (CLI generators, registry resolution, `voyant db:sync-links`,
 * deployment scripts). Runtime composition of modules, plugins, and
 * middleware still happens in code via `createApp({ modules, plugins, ... })`.
 *
 * Shape mirrors Medusa's `defineConfig` so users familiar with that
 * ecosystem can transfer their mental model directly.
 */

/**
 * Core runtime settings declared for tooling purposes (connection strings,
 * cache backend, auth provider). All fields are optional because runtime
 * wiring lives in template code and environment bindings.
 */
export interface ProjectConfig {
  /** Database connection descriptor. */
  database?: {
    /** Environment variable name that holds the connection URL. */
    urlEnv?: string
    /** Adapter to use at runtime. */
    adapter?: "edge" | "node" | "serverless"
  }
  /** Cache backend descriptor. */
  cache?: {
    /** Provider name. */
    provider?: "memory" | "postgres" | "redis" | "platform"
  }
  /** Auth provider descriptor. */
  auth?: {
    /** Provider identifier (e.g. "better-auth"). */
    provider?: string
  }
}

/**
 * Settings for `voyant admin generate --routes` — the generated thin route
 * files that bind zero-prop extension route contributions into the host's
 * file-based route tree (packaged-admin RFC §4.2). All fields are optional;
 * defaults match the operator starter's conventions.
 */
export interface AdminRoutesConfig {
  /**
   * Host route-tree directory generated files land in, relative to the
   * config file. Default "src/routes/_workspace".
   */
  dir?: string
  /**
   * Module specifier exporting the API base-URL getter bound into generated
   * loaders. Default "@/lib/env".
   */
  apiUrlModule?: string
  /** Named export of `apiUrlModule` returning the API base URL. Default "getApiUrl". */
  apiUrlExport?: string
  /**
   * Module specifier exporting the SSR cookie-forwarding fetcher bound into
   * generated loaders. Default "@/lib/voyant-fetcher".
   */
  fetcherModule?: string
  /** Named export of `fetcherModule`. Default "operatorFetcher". */
  fetcherExport?: string
}

/**
 * Admin-dashboard manifest entry. Mirrors Medusa's admin section.
 */
export interface AdminConfig {
  /** Whether the admin dashboard is enabled for this project. */
  enabled?: boolean
  /** URL path the dashboard is mounted at (e.g. "/app"). */
  path?: string
  /** Optional URL the admin dashboard should call back to. */
  backendUrl?: string
  /** Generated-route-file settings for `voyant admin generate --routes`. */
  routes?: AdminRoutesConfig
}

/**
 * A module declaration — either a string identifier (referencing a package
 * or workspace-local module) or an inline descriptor with options.
 */
export type ModuleEntry =
  | string
  | {
      /** Module identifier (package name or workspace path). */
      resolve: string
      /** Arbitrary module options consumed by the module factory. */
      options?: Record<string, unknown>
    }

/**
 * A plugin declaration — mirrors {@link ModuleEntry} but references
 * distributable plugin bundles (see `@voyant-travel/core/plugin`).
 */
export type PluginEntry =
  | string
  | {
      /** Plugin identifier (package name). */
      resolve: string
      /** Arbitrary plugin options. */
      options?: Record<string, unknown>
    }

/** Unified Voyant applications execute as resident Node processes. */
export type DeploymentTarget = "node"

/**
 * The top-level voyant.config.ts manifest.
 *
 * @see {@link defineVoyantConfig}
 */
export interface VoyantConfig {
  /** Core runtime settings (database, cache, auth). */
  projectConfig?: ProjectConfig
  /** Admin dashboard configuration. */
  admin?: AdminConfig
  /** Modules composed into the application. */
  modules?: ModuleEntry[]
  /** Plugins registered alongside core modules. */
  plugins?: PluginEntry[]
  /**
   * Hono extensions mounted into the application (e.g. the booking extensions
   * each vertical contributes). Extensions that own tables are seeded into
   * schema discovery alongside `modules`, so an extension's tables can never be
   * silently omitted from a migration — closing the "registered at runtime but
   * forgotten in drizzle.config" trap on the migration side.
   */
  extensions?: ModuleEntry[]
  /**
   * Schema-owning packages that this template migrates but does **not** mount
   * as a Hono module or extension — e.g. plugin-provided schemas (`catalog` via
   * a bridge bundle) or FK-target packages (`accommodations`). Migration tooling
   * seeds schema discovery from `modules` + `extensions` + `additionalSchemas`,
   * so a table can be migrated without pretending its package is a runtime
   * module. Keeps `modules` an honest list of what is actually mounted.
   */
  additionalSchemas?: ModuleEntry[]
  /**
   * Template/app-**local** Drizzle schema entrypoints (file paths relative to
   * the template) that belong to no package — deployment-owned glue such as a
   * `./src/db/schema.ts`. Migration tooling appends these verbatim after the
   * package-derived closure (`modules` + `additionalSchemas`).
   */
  schemas?: string[]
  /** Feature flags for gradual rollout. */
  featureFlags?: Record<string, boolean>
  /** Deployment target hint consumed by tooling. */
  deployment?: DeploymentTarget
}

/**
 * Identity helper that returns the config as-is.
 *
 * Exists purely so authors can write `defineVoyantConfig({ ... })` and get
 * type inference + IDE help without casting. Does not perform runtime
 * validation — malformed manifests will surface at CLI/tooling consumption
 * time via {@link validateVoyantConfig}.
 *
 * @example
 * ```ts
 * // starters/operator/voyant.config.ts
 * import { defineVoyantConfig } from "@voyant-travel/core/config"
 *
 * export default defineVoyantConfig({
 *   modules: ["crm", "bookings", "products", "finance", "suppliers"],
 *   plugins: ["payload-cms", "bokun"],
 *   deployment: "node",
 *   admin: { enabled: true, path: "/app" },
 * })
 * ```
 */
export function defineVoyantConfig<C extends VoyantConfig>(config: C): C {
  return config
}

/**
 * A single validation issue detected in a {@link VoyantConfig} manifest.
 */
export interface ConfigValidationIssue {
  /** Dotted path to the offending field (e.g. `modules[0].resolve`). */
  path: string
  /** Human-readable description. */
  message: string
}

/**
 * Result returned by {@link validateVoyantConfig}.
 */
export interface ConfigValidationResult {
  /** True when no issues were detected. */
  ok: boolean
  /** List of validation issues (empty when `ok` is true). */
  issues: ConfigValidationIssue[]
}

/**
 * Lightweight structural validation for a {@link VoyantConfig} manifest.
 *
 * Checks only shape/identity: field types, non-empty identifiers, no
 * duplicate module/plugin names. It does **not** resolve package names or
 * check that referenced modules exist on disk — that is CLI/tooling
 * territory.
 *
 * Returns a result object rather than throwing so callers can choose how
 * to surface issues (pretty printing, aggregating, etc.).
 */
export function validateVoyantConfig(config: unknown): ConfigValidationResult {
  const issues: ConfigValidationIssue[] = []

  if (config === null || typeof config !== "object") {
    return {
      ok: false,
      issues: [{ path: "", message: "Config must be an object." }],
    }
  }

  const cfg = config as Record<string, unknown>

  if (cfg.modules !== undefined) {
    if (!Array.isArray(cfg.modules)) {
      issues.push({ path: "modules", message: "Expected an array." })
    } else {
      const seen = new Set<string>()
      cfg.modules.forEach((entry, index) => {
        const name = extractEntryName(entry)
        if (!name) {
          issues.push({
            path: `modules[${index}]`,
            message:
              "Module entry must be a non-empty string or an object with a `resolve` string.",
          })
          return
        }
        if (seen.has(name)) {
          issues.push({
            path: `modules[${index}]`,
            message: `Duplicate module "${name}".`,
          })
        }
        seen.add(name)
      })
    }
  }

  if (cfg.plugins !== undefined) {
    if (!Array.isArray(cfg.plugins)) {
      issues.push({ path: "plugins", message: "Expected an array." })
    } else {
      const seen = new Set<string>()
      cfg.plugins.forEach((entry, index) => {
        const name = extractEntryName(entry)
        if (!name) {
          issues.push({
            path: `plugins[${index}]`,
            message:
              "Plugin entry must be a non-empty string or an object with a `resolve` string.",
          })
          return
        }
        if (seen.has(name)) {
          issues.push({
            path: `plugins[${index}]`,
            message: `Duplicate plugin "${name}".`,
          })
        }
        seen.add(name)
      })
    }
  }

  if (cfg.extensions !== undefined) {
    if (!Array.isArray(cfg.extensions)) {
      issues.push({ path: "extensions", message: "Expected an array." })
    } else {
      const seen = new Set<string>()
      cfg.extensions.forEach((entry, index) => {
        const name = extractEntryName(entry)
        if (!name) {
          issues.push({
            path: `extensions[${index}]`,
            message:
              "Extension entry must be a non-empty string or an object with a `resolve` string.",
          })
          return
        }
        if (seen.has(name)) {
          issues.push({ path: `extensions[${index}]`, message: `Duplicate extension "${name}".` })
        }
        seen.add(name)
      })
    }
  }

  if (cfg.additionalSchemas !== undefined) {
    if (!Array.isArray(cfg.additionalSchemas)) {
      issues.push({ path: "additionalSchemas", message: "Expected an array." })
    } else {
      const seen = new Set<string>()
      cfg.additionalSchemas.forEach((entry, index) => {
        const name = extractEntryName(entry)
        if (!name) {
          issues.push({
            path: `additionalSchemas[${index}]`,
            message:
              "additionalSchemas entry must be a non-empty string or an object with a `resolve` string.",
          })
          return
        }
        if (seen.has(name)) {
          issues.push({
            path: `additionalSchemas[${index}]`,
            message: `Duplicate additionalSchemas entry "${name}".`,
          })
        }
        seen.add(name)
      })
    }
  }

  if (cfg.schemas !== undefined) {
    if (!Array.isArray(cfg.schemas)) {
      issues.push({ path: "schemas", message: "Expected an array of file-path strings." })
    } else {
      cfg.schemas.forEach((entry, index) => {
        if (typeof entry !== "string" || entry.trim().length === 0) {
          issues.push({
            path: `schemas[${index}]`,
            message: "schemas entry must be a non-empty file-path string.",
          })
        }
      })
    }
  }

  if (cfg.admin !== undefined) {
    if (cfg.admin === null || typeof cfg.admin !== "object" || Array.isArray(cfg.admin)) {
      issues.push({ path: "admin", message: "Expected an object." })
    } else {
      const admin = cfg.admin as Record<string, unknown>
      if (admin.enabled !== undefined && typeof admin.enabled !== "boolean") {
        issues.push({ path: "admin.enabled", message: "Expected a boolean." })
      }
      if (admin.path !== undefined && typeof admin.path !== "string") {
        issues.push({ path: "admin.path", message: "Expected a string." })
      }
      if (admin.backendUrl !== undefined && typeof admin.backendUrl !== "string") {
        issues.push({ path: "admin.backendUrl", message: "Expected a string." })
      }
      if (admin.routes !== undefined) {
        if (
          admin.routes === null ||
          typeof admin.routes !== "object" ||
          Array.isArray(admin.routes)
        ) {
          issues.push({ path: "admin.routes", message: "Expected an object." })
        } else {
          const routes = admin.routes as Record<string, unknown>
          for (const field of [
            "dir",
            "apiUrlModule",
            "apiUrlExport",
            "fetcherModule",
            "fetcherExport",
          ]) {
            if (routes[field] !== undefined && typeof routes[field] !== "string") {
              issues.push({ path: `admin.routes.${field}`, message: "Expected a string." })
            }
          }
        }
      }
    }
  }

  if (cfg.featureFlags !== undefined) {
    if (
      cfg.featureFlags === null ||
      typeof cfg.featureFlags !== "object" ||
      Array.isArray(cfg.featureFlags)
    ) {
      issues.push({ path: "featureFlags", message: "Expected an object of booleans." })
    } else {
      for (const [key, value] of Object.entries(cfg.featureFlags)) {
        if (typeof value !== "boolean") {
          issues.push({
            path: `featureFlags.${key}`,
            message: "Expected a boolean.",
          })
        }
      }
    }
  }

  if (cfg.deployment !== undefined && cfg.deployment !== "node") {
    issues.push({ path: "deployment", message: 'Expected "node".' })
  }

  return { ok: issues.length === 0, issues }
}

function extractEntryName(entry: unknown): string | null {
  if (typeof entry === "string") {
    return entry.trim().length > 0 ? entry : null
  }
  if (entry !== null && typeof entry === "object" && "resolve" in entry) {
    const resolve = (entry as { resolve: unknown }).resolve
    if (typeof resolve === "string" && resolve.trim().length > 0) {
      return resolve
    }
  }
  return null
}

/**
 * Normalize a {@link ModuleEntry} or {@link PluginEntry} into the canonical
 * `{ resolve, options }` object shape. Accepts string shorthand and inline
 * descriptors alike.
 */
export function resolveEntry<E extends ModuleEntry | PluginEntry>(
  entry: E,
): { resolve: string; options: Record<string, unknown> } {
  if (typeof entry === "string") {
    return { resolve: entry, options: {} }
  }
  return { resolve: entry.resolve, options: entry.options ?? {} }
}
