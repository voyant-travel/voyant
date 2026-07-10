import { execFileSync } from "node:child_process"
import { copyFileSync, rmSync } from "node:fs"
import { join } from "node:path"

const generatedGraph = join(".voyant", "deployment-graph.generated.json")
const compatibilityGraph = ".voyant-admin-graph.generated.json"
const check = process.argv.includes("--check")

// @voyant-travel/cli@0.36 resolves package exports relative to the graph file.
// Keep its compatibility input at the project root, then remove it even when
// generation fails. The durable graph remains under .voyant/.
copyFileSync(generatedGraph, compatibilityGraph)
try {
  run(["--out", "src/admin.extensions.generated.ts"])
  run(["--routes", "--out", "src/admin.routes.generated.tsx"])
  run(["--destinations", "--out", "src/admin.destinations.generated.ts"])
} finally {
  rmSync(compatibilityGraph, { force: true })
}

function run(args: string[]): void {
  execFileSync(
    "voyant",
    ["admin", "generate", "--graph", compatibilityGraph, ...args, ...(check ? ["--check"] : [])],
    { stdio: "inherit" },
  )
}
