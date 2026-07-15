import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { inspectFirstPartyToolOutputSchemas } from "./lib/first-party-tool-output-schemas.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const sources = new Map()
collectSources(path.join(root, "packages"), sources)

const failures = inspectFirstPartyToolOutputSchemas(sources)
if (failures.length > 0) {
  console.error("First-party Tool output schema verification failed:\n")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log("First-party Tool output schemas: OK")

function collectSources(directory, result) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (["dist", "node_modules", "coverage"].includes(entry.name)) continue
    const child = path.join(directory, entry.name)
    if (entry.isDirectory()) collectSources(child, result)
    else if (entry.name.endsWith(".ts")) {
      result.set(relativePath(child), readFileSync(child, "utf8"))
    }
  }
}

function relativePath(absolute) {
  return path.relative(root, absolute).split(path.sep).join("/")
}
