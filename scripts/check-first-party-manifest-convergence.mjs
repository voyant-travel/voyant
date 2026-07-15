import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  inspectFirstPartyManifestConvergence,
  standardSelectionsFromPolicy,
} from "./lib/first-party-manifest-convergence.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const graphPath = path.join(root, "starters/operator/.voyant/deployment-graph.generated.json")
if (!existsSync(graphPath)) {
  throw new Error(
    "generated Operator graph is missing; run `pnpm --filter operator prepare:verify`",
  )
}

const policySource = read("packages/operator-standard/src/index.ts")
const graph = JSON.parse(readFileSync(graphPath, "utf8"))
const workspacePackages = new Map()
const sources = new Map()

for (const directory of workspaceDirectories(path.join(root, "packages"))) {
  const packageJsonPath = path.join(directory, "package.json")
  if (!existsSync(packageJsonPath)) continue
  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8"))
  if (!manifest.name) continue
  const relative = relativePath(directory)
  workspacePackages.set(manifest.name, { directory: relative, manifest })
  collectSources(directory, sources)
}

const failures = inspectFirstPartyManifestConvergence({
  graph,
  selections: standardSelectionsFromPolicy(policySource),
  workspacePackages,
  sources,
})

if (failures.length > 0) {
  console.error("First-party manifest convergence failed:\n")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `First-party manifest convergence: OK (${graph.modules.length} modules, ${graph.extensions.length} extensions)`,
)

function read(relative) {
  return readFileSync(path.join(root, relative), "utf8")
}

function relativePath(absolute) {
  return path.relative(root, absolute).split(path.sep).join("/")
}

function workspaceDirectories(directory) {
  const result = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || ["dist", "node_modules"].includes(entry.name)) continue
    const child = path.join(directory, entry.name)
    if (existsSync(path.join(child, "package.json"))) result.push(child)
    result.push(...workspaceDirectories(child))
  }
  return result
}

function collectSources(directory, result) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (["dist", "node_modules", "coverage"].includes(entry.name)) continue
    const child = path.join(directory, entry.name)
    if (entry.isDirectory()) collectSources(child, result)
    else if (/\.(?:ts|tsx|json)$/.test(entry.name))
      result.set(relativePath(child), readFileSync(child, "utf8"))
  }
}
