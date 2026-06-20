/**
 * D.2 slice 1 — scaffold a schema-owning package so it OWNS its own migration
 * history (ADR: docs/architecture/migration-collector-d2.md). Idempotent: run it
 * per package, then `pnpm install` once, then `pnpm -C packages/<pkg> db:generate`.
 *
 * For each package it:
 *   • adds `drizzle-kit` to devDependencies (per-package generation needs it),
 *   • adds a `db:generate` script bound to the package migrations config,
 *   • adds `migrations/*.sql` + `migrations/meta/_journal.json` to `files` so the
 *     folder ships in the package tarball (most packages publish `dist` only),
 *   • writes `drizzle.migrations.config.ts` pointing at the package's own
 *     `voyant.schema` entrypoint (NOT the requiresSchemas closure — drizzle emits
 *     only the tables exported from the listed files; cross-package FKs are
 *     emitted as references-by-name and resolved by earlier-ordered sources).
 *
 * Usage: node scripts/d2/scaffold-package-migrations.mjs <pkg-dir-name>...
 *        (e.g. operator-settings action-ledger workflow-runs)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const DRIZZLE_KIT = "^0.31.10"
const pkgs = process.argv.slice(2)
if (pkgs.length === 0) {
  console.error("usage: node scripts/d2/scaffold-package-migrations.mjs <pkg>...")
  process.exit(2)
}

/** Resolve the `voyant.schema` entrypoint (e.g. "./schema") to a src/ TS path. */
function schemaEntrypoint(pkgJson) {
  const sub = pkgJson.voyant?.schema
  if (!sub) throw new Error("package.json has no `voyant.schema`")
  // "./schema" -> "./src/schema.ts"; "./verification/schema" -> "./src/verification/schema.ts"
  return `./src/${sub.replace(/^\.\//, "")}.ts`
}

const CONFIG = (schemaPath) => `/**
 * D.2 — this package OWNS its own migration history, generated from its own
 * schema and shipped in the package tarball (see \`files\`). A D.2 deployment
 * collects this folder as the package's migration source.
 * ADR: docs/architecture/migration-collector-d2.md.
 *
 * Regenerate: \`pnpm -C packages/<this> db:generate\`.
 */
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "${schemaPath}",
  out: "./migrations",
  dialect: "postgresql",
})
`

for (const name of pkgs) {
  const dir = join("packages", name)
  const pjPath = join(dir, "package.json")
  if (!existsSync(pjPath)) {
    console.error(`  SKIP ${name} — ${pjPath} not found`)
    continue
  }
  const pj = JSON.parse(readFileSync(pjPath, "utf8"))

  pj.scripts ??= {}
  // `--name` only names the first (baseline) migration; later runs auto-name the
  // diff (same behaviour as the framework bundle generator).
  const baselineName = `${name.replace(/-/g, "_")}_baseline`
  pj.scripts["db:generate"] =
    `drizzle-kit generate --config=drizzle.migrations.config.ts --name=${baselineName}`

  pj.devDependencies ??= {}
  if (!pj.devDependencies["drizzle-kit"]) pj.devDependencies["drizzle-kit"] = DRIZZLE_KIT
  // keep devDependencies sorted (biome/convention)
  pj.devDependencies = Object.fromEntries(
    Object.entries(pj.devDependencies).sort(([a], [b]) => a.localeCompare(b)),
  )

  pj.files ??= []
  for (const f of ["migrations/*.sql", "migrations/meta/_journal.json"]) {
    if (!pj.files.includes(f)) pj.files.push(f)
  }

  writeFileSync(pjPath, `${JSON.stringify(pj, null, 2)}\n`)

  const cfgPath = join(dir, "drizzle.migrations.config.ts")
  writeFileSync(cfgPath, CONFIG(schemaEntrypoint(pj)))

  console.log(`  scaffolded ${name} (schema ${schemaEntrypoint(pj)})`)
}

console.log(
  `\nNext: pnpm install && ${pkgs.map((p) => `pnpm -C packages/${p} db:generate`).join(" && ")}`,
)
