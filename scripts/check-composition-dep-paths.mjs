#!/usr/bin/env node
// Verifies the composition-point typecheck dep-paths maps are up to date with
// the workspace's package `exports`. If a package adds/removes/renames an export
// and the maps aren't regenerated, the affected dep silently falls back to
// source resolution — re-inflating the typecheck memory the maps exist to bound
// (voyant#2114). Run `pnpm generate:dep-paths` to refresh.

import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const CONFIGS = [
  "packages/framework/tsconfig.typecheck.json",
  "packages/framework/tsconfig.build.json",
]

const before = CONFIGS.map((f) => readFileSync(join(ROOT, f), "utf8"))
execFileSync("node", ["scripts/gen-composition-dep-paths.mjs"], { cwd: ROOT, stdio: "ignore" })
const after = CONFIGS.map((f) => readFileSync(join(ROOT, f), "utf8"))
const stale = CONFIGS.filter((_f, i) => before[i] !== after[i])

// Restore the originals so this check never leaves the tree dirty.
for (const [i, f] of CONFIGS.entries()) {
  writeFileSync(join(ROOT, f), before[i])
}

if (stale.length > 0) {
  console.error(
    `Composition dep-paths are stale:\n  ${stale.join("\n  ")}\n` +
      "Run `pnpm generate:dep-paths` and commit the result.",
  )
  process.exit(1)
}
console.log("composition dep-paths up to date")
