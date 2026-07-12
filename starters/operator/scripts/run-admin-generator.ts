import { execFileSync } from "node:child_process"
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const generatedGraph = join(".voyant", "deployment-graph.generated.json")
const compatibilityGraph = ".voyant-admin-graph.generated.json"
const check = process.argv.includes("--check")

// Keep the graph input at the project root because package exports resolve
// relative to it. The durable generated graph remains under .voyant/.
copyFileSync(generatedGraph, compatibilityGraph)
try {
  assertNoCompatibilityExtensions("src/admin.extensions.generated.ts")
} finally {
  rmSync(compatibilityGraph, { force: true })
}

function assertNoCompatibilityExtensions(output: string): void {
  const directory = mkdtempSync(join(tmpdir(), "voyant-admin-compatibility-"))
  const generated = join(directory, "admin.extensions.generated.ts")
  try {
    run(["--out", generated], false)
    const source = removeSelectedGraphFactories(readFileSync(generated, "utf8"))
    if (
      source.includes("generatedAdminExtensionFactories") &&
      !/generatedAdminExtensionFactories\s*=\s*\{\s*\}/s.test(source)
    ) {
      throw new Error("A graph-selected admin package remains outside admin.runtime authority")
    }
    if (check && existsSync(output)) {
      throw new Error(`${output} must be deleted; selected-graph admin authority is complete`)
    }
    if (!check) rmSync(output, { force: true })
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
