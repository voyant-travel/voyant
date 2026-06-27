#!/usr/bin/env node
// Verifies the heavy-package dep-paths configs are up to date with the
// workspace's package `exports`. If a package adds/removes/renames an export and
// the maps aren't regenerated, a heavy package silently re-infers that dep's
// source and can OOM (voyant#2114). Run `pnpm generate:heavy-dep-paths`.

import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const HEAVY = ["commerce", "distribution", "identity", "octo"]
const CONFIGS = HEAVY.flatMap((n) => [
  `packages/${n}/tsconfig.build.json`,
  `packages/${n}/tsconfig.typecheck.json`,
])

const before = CONFIGS.map((f) => readFileSync(join(ROOT, f), "utf8"))
execFileSync("node", ["scripts/gen-heavy-package-dep-paths.mjs"], { cwd: ROOT, stdio: "ignore" })
const after = CONFIGS.map((f) => readFileSync(join(ROOT, f), "utf8"))
const stale = CONFIGS.filter((_f, i) => before[i] !== after[i])

for (const [i, f] of CONFIGS.entries()) {
  writeFileSync(join(ROOT, f), before[i])
}

if (stale.length > 0) {
  console.error(
    `Heavy-package dep-paths are stale:\n  ${stale.join("\n  ")}\n` +
      "Run `pnpm generate:heavy-dep-paths` and commit the result.",
  )
  process.exit(1)
}
console.log("heavy-package dep-paths up to date")
