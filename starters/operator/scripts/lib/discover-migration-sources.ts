/**
 * D.2 migration-source discovery for the deployment runner.
 *
 * The deployment migrates the schema owned by a set of packages (its mounted
 * modules + extensions + additionalSchemas, plus the base `db` package) and its
 * own template-local migrations (`./migrations` — the generated cross-module
 * link tables + any custom deployment modules). Under D.2 each schema-owning
 * package SHIPS its own drizzle `migrations/` folder; the runner collects them,
 * topologically ordered so a package's dependencies apply first.
 *
 * Source of truth is the SAME generated list `drizzle.config.ts` consumes —
 * `drizzle.schemas.generated.ts`, derived from `voyant.config.ts`. Each entry is
 * a schema file path; we map it back to the owning package directory (whose name
 * is the collector source name — matching the cutline manifest in
 * `@voyant-travel/framework-migrations`) and read that package's
 * `voyant.requiresSchemas` for the topological order.
 *
 * Kept dependency-free + filesystem-injectable so it can be unit-tested without
 * a real workspace. See `docs/architecture/migration-collector-d2.md`.
 */
import { existsSync as fsExists, readFileSync as fsRead } from "node:fs"
import { join } from "node:path"

/** The collector source name for the deployment's own `./migrations` folder. */
export const DEPLOYMENT_SOURCE = "deployment"

/** A discovered, ordered migration source: a package folder or the deployment. */
export interface DiscoveredSource {
  /** Collector source name — a package DIR name, or `"deployment"`. */
  name: string
  /** Absolute path to the drizzle migrations folder for this source. */
  migrationsDir: string
  /** Whether that folder actually ships migrations (`meta/_journal.json`). */
  hasMigrations: boolean
}

/** Injectable filesystem surface (defaults to `node:fs`) for testability. */
export interface Fs {
  existsSync(path: string): boolean
  readFileSync(path: string, enc: "utf8"): string
}

const defaultFs: Fs = {
  existsSync: fsExists,
  readFileSync: (p, enc) => fsRead(p, enc),
}

/** Map a generated schema path to its owning package dir, or null for a
 *  template-local (deployment) schema (`./…`). */
export function packageDirOfSchemaPath(schemaPath: string): string | null {
  if (!schemaPath.includes("/packages/")) return null // ./drizzle.links.generated.ts etc.
  const m = schemaPath.match(/\/packages\/([^/]+)\//)
  return m ? (m[1] as string) : null
}

interface PkgMeta {
  dir: string
  /** `@voyant-travel/…` package name (for resolving requiresSchemas edges). */
  pkgName: string
  /** requiresSchemas package names (deps that must migrate first). */
  requires: string[]
  migrationsDir: string
  hasMigrations: boolean
}

function readPkgMeta(packagesRoot: string, dir: string, fs: Fs): PkgMeta {
  const pjPath = join(packagesRoot, dir, "package.json")
  const pj = JSON.parse(fs.readFileSync(pjPath, "utf8")) as {
    name?: string
    voyant?: { requiresSchemas?: string[] }
  }
  const migrationsDir = join(packagesRoot, dir, "migrations")
  return {
    dir,
    pkgName: pj.name ?? `@voyant-travel/${dir}`,
    requires: pj.voyant?.requiresSchemas ?? [],
    migrationsDir,
    hasMigrations: fs.existsSync(join(migrationsDir, "meta", "_journal.json")),
  }
}

/**
 * Discover the ordered migration sources for a deployment.
 *
 * @param schemaPaths the generated schema-file list (`drizzle.schemas.generated.ts`)
 * @param scriptsDir  the runner's directory (`scripts/`), used to resolve the
 *                    `../../packages/<dir>` and `../migrations` relative paths
 *
 * Returns package sources in deps-first topological order, followed by the
 * deployment source (`./migrations`) last — its link tables FK into package
 * tables, so it must apply after every package.
 */
export function discoverMigrationSources(
  schemaPaths: readonly string[],
  scriptsDir: string,
  fs: Fs = defaultFs,
): DiscoveredSource[] {
  const packagesRoot = join(scriptsDir, "..", "..", "..", "packages")
  // De-duplicated owning package dirs, preserving first-seen order.
  const dirs: string[] = []
  let hasDeploymentSchema = false
  for (const p of schemaPaths) {
    const dir = packageDirOfSchemaPath(p)
    if (dir === null) {
      hasDeploymentSchema = true
    } else if (!dirs.includes(dir)) {
      dirs.push(dir)
    }
  }

  const metas = new Map<string, PkgMeta>()
  for (const dir of dirs) metas.set(dir, readPkgMeta(packagesRoot, dir, fs))
  // pkgName -> dir, to resolve requiresSchemas edges to present sources only.
  const dirByPkgName = new Map<string, string>()
  for (const m of metas.values()) dirByPkgName.set(m.pkgName, m.dir)

  // Deps-first topological order over the present dirs (edges = requiresSchemas
  // that resolve to another present dir). Stable: visits in first-seen order.
  const ordered: string[] = []
  const seen = new Set<string>()
  const visit = (dir: string, stack: Set<string>) => {
    if (seen.has(dir)) return
    if (stack.has(dir)) return // cycle guard — break rather than recurse forever
    stack.add(dir)
    const meta = metas.get(dir)
    if (meta) {
      for (const dep of meta.requires) {
        const depDir = dirByPkgName.get(dep)
        if (depDir) visit(depDir, stack)
      }
    }
    stack.delete(dir)
    if (!seen.has(dir)) {
      seen.add(dir)
      ordered.push(dir)
    }
  }
  for (const dir of dirs) visit(dir, new Set())

  const sources: DiscoveredSource[] = ordered.map((dir) => {
    const meta = metas.get(dir) as PkgMeta
    return { name: dir, migrationsDir: meta.migrationsDir, hasMigrations: meta.hasMigrations }
  })

  if (hasDeploymentSchema) {
    const deploymentDir = join(scriptsDir, "..", "migrations")
    sources.push({
      name: DEPLOYMENT_SOURCE,
      migrationsDir: deploymentDir,
      hasMigrations: fs.existsSync(join(deploymentDir, "meta", "_journal.json")),
    })
  }
  return sources
}
