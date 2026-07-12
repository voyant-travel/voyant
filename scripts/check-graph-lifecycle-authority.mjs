import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { inspectGraphLifecycleAuthority } from "./lib/graph-lifecycle-authority.mjs"

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const rootArg = process.argv.indexOf("--root")
const repoRoot = rootArg >= 0 ? path.resolve(process.argv[rootArg + 1]) : defaultRoot
const paths = [
  "packages/core/src/project-facets.ts",
  "packages/framework/src/deployment-graph.ts",
  "packages/framework/src/graph-lifecycle.ts",
  "packages/framework/src/index.ts",
]
const files = new Map(
  await Promise.all(
    paths.map(async (relative) => [
      relative,
      await readFile(path.join(repoRoot, relative), "utf8"),
    ]),
  ),
)
const failures = inspectGraphLifecycleAuthority(files)

if (failures.length > 0) {
  console.error("Graph lifecycle authority check failed:\n")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  "Graph lifecycle authority: OK (upgrade compatibility, uninstall, cleanup, and retention accounted)",
)
