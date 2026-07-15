import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { inspectPhase5ToolsMcpAuthority } from "./lib/phase5-tools-mcp-authority.mjs"

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const rootArg = process.argv.indexOf("--root")
const repoRoot = rootArg >= 0 ? path.resolve(process.argv[rootArg + 1]) : defaultRoot
const roots = [
  "packages/core/src",
  "packages/framework/src",
  "packages/mcp",
  "packages/operator-standard/src",
  "packages/runtime/src",
]
const files = new Map()

for (const root of roots) await collect(path.join(repoRoot, root))

const failures = inspectPhase5ToolsMcpAuthority(files)
if (failures.length > 0) {
  console.error("Phase 5 tools/MCP authority check failed:\n")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Phase 5 tools/MCP authority: OK (${files.size} files inspected)`)

async function collect(directory) {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error?.code === "ENOENT") return
    throw error
  }
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) await collect(absolute)
    else if (!entry.name.includes(".test.") && /\.(?:json|mjs|ts)$/.test(entry.name)) {
      const relative = path.relative(repoRoot, absolute).split(path.sep).join("/")
      files.set(relative, await readFile(absolute, "utf8"))
    }
  }
}
