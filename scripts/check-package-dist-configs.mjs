#!/usr/bin/env node
// Verifies the per-package dist-resolution configs (shared map +
// tsconfig.build/typecheck.json) are up to date with the workspace's package
// `exports`. A stale map silently drops a dep back to source resolution and can
// OOM the build (voyant#2114). Run `pnpm generate:dist-configs`.
import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const files = ["packages/typescript-config/dep-paths.json"]
for (const e of readdirSync(join(ROOT, "packages"), { withFileTypes: true })) {
  for (const f of ["tsconfig.build.json", "tsconfig.typecheck.json"]) {
    const p = `packages/${e.name}/${f}`
    if (existsSync(join(ROOT, p))) files.push(p)
  }
}
const before = files.map((f) => readFileSync(join(ROOT, f), "utf8"))
execFileSync("node", ["scripts/gen-package-dist-configs.mjs"], { cwd: ROOT, stdio: "ignore" })
const after = files.map((f) => readFileSync(join(ROOT, f), "utf8"))
const stale = files.filter((_f, i) => before[i] !== after[i])
for (const [i, f] of files.entries()) writeFileSync(join(ROOT, f), before[i])
if (stale.length > 0) {
  console.error(
    `Package dist-configs are stale:\n  ${stale.join("\n  ")}\nRun \`pnpm generate:dist-configs\`.`,
  )
  process.exit(1)
}
console.log("package dist-configs up to date")
