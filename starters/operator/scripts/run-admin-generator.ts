import { execFileSync } from "node:child_process"
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const generatedGraph = join(".voyant", "deployment-graph.generated.json")
const compatibilityGraph = ".voyant-admin-graph.generated.json"
const check = process.argv.includes("--check")

// @voyant-travel/cli@0.36 resolves package exports relative to the graph file.
// Keep its compatibility input at the project root, then remove it even when
// generation fails. The durable graph remains under .voyant/.
copyFileSync(generatedGraph, compatibilityGraph)
try {
  generateCompatibilityExtensions("src/admin.extensions.generated.ts")
  run(["--routes", "--out", "src/admin.routes.generated.tsx"])
  run(["--destinations", "--out", "src/admin.destinations.generated.ts"])
} finally {
  rmSync(compatibilityGraph, { force: true })
}

function generateCompatibilityExtensions(output: string): void {
  const directory = mkdtempSync(join(tmpdir(), "voyant-admin-compatibility-"))
  const generated = join(directory, "admin.extensions.generated.ts")
  try {
    run(["--out", generated], false)
    const source = removeSelectedGraphFactories(readFileSync(generated, "utf8"))
    if (check) {
      if (readFileSync(output, "utf8") !== source) {
        throw new Error(`${output} is out of date — run \`pnpm run admin:generate\``)
      }
      return
    }
    writeFileSync(output, source)
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
}

function removeSelectedGraphFactories(source: string): string {
  const graph = JSON.parse(readFileSync(generatedGraph, "utf8")) as {
    modules?: Array<{ admin?: { runtime?: { entry?: string } } }>
    extensions?: Array<{ admin?: { runtime?: { entry?: string } } }>
    plugins?: Array<{ admin?: { runtime?: { entry?: string } } }>
  }
  const runtimeEntries = new Set(
    [...(graph.modules ?? []), ...(graph.extensions ?? []), ...(graph.plugins ?? [])].flatMap(
      (unit) => (unit.admin?.runtime?.entry ? [unit.admin.runtime.entry] : []),
    ),
  )
  const removedSymbols = new Set<string>()
  const lines = source.split("\n").filter((line) => {
    const match = line.match(/^import \{ (\w+) \} from "([^"]+)"$/)
    if (!match || !runtimeEntries.has(match[2] ?? "")) return true
    removedSymbols.add(match[1] ?? "")
    return false
  })
  return lines
    .filter((line) => ![...removedSymbols].some((symbol) => line.endsWith(`: ${symbol},`)))
    .join("\n")
}

function run(args: string[], withCheck = true): void {
  execFileSync(
    "voyant",
    [
      "admin",
      "generate",
      "--graph",
      compatibilityGraph,
      ...args,
      ...(check && withCheck ? ["--check"] : []),
    ],
    { stdio: "inherit" },
  )
}
