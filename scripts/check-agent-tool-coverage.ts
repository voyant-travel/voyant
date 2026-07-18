import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  formatAgentToolCoverageMarkdown,
  inspectAgentToolCoverage,
} from "./lib/agent-tool-coverage.mjs"

void main()

async function main() {
  const rootArg = process.argv.indexOf("--root")
  const repoRoot = rootArg >= 0 ? path.resolve(process.argv[rootArg + 1] ?? "") : process.cwd()
  const report = process.argv.includes("--report")
  const modules = await loadWorkspaceModules(repoRoot)
  const { diagnostics, rows } = inspectAgentToolCoverage(modules, {
    exclusions: new Map([
      [
        "@voyant-travel/mcp",
        {
          rationale:
            "The MCP module is the transport adapter for selected package Tools and does not own domain capabilities.",
        },
      ],
    ]),
  })

  if (diagnostics.length > 0) {
    console.error("Agent Tool coverage check failed:\n")
    for (const diagnostic of diagnostics) console.error(`- ${diagnostic}`)
    process.exitCode = 1
    return
  }

  if (report) {
    process.stdout.write(formatAgentToolCoverageMarkdown(rows))
  } else {
    const toolCount = rows.reduce((total, row) => total + row.tools.length, 0)
    console.log(`Agent Tool coverage: OK (${rows.length} modules, ${toolCount} Tools)`)
  }
}

async function loadWorkspaceModules(root: string) {
  const packagesRoot = path.join(root, "packages")
  const modules = []

  for (const packageDirectory of findPackageDirectories(packagesRoot)) {
    const packageJsonPath = path.join(packageDirectory, "package.json")

    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      name?: string
      exports?: Record<string, unknown>
      voyant?: { kind?: string; manifest?: string }
    }
    const governedSchema = schemaVersionForGraphKind(packageJson.voyant?.kind)
    if (
      !packageJson.name?.startsWith("@voyant-travel/") ||
      !governedSchema ||
      !packageJson.voyant.manifest
    ) {
      continue
    }

    const target = packageExportTarget(packageJson.exports?.[packageJson.voyant.manifest])
    if (!target) {
      throw new Error(
        `${packageJson.name}: ${packageJson.voyant.manifest} has no importable package export target`,
      )
    }
    const loaded = (await import(
      pathToFileURL(path.resolve(packageDirectory, target)).href
    )) as Record<string, unknown>
    const manifests = new Map<string, Record<string, unknown>>()
    for (const value of Object.values(loaded)) {
      if (!isGraphManifest(value)) continue
      if (value.schemaVersion !== governedSchema && !hasTools(value)) continue
      manifests.set(value.id as string, value)
    }
    for (const manifest of manifests.values()) {
      const meta = isRecord(manifest.meta) ? manifest.meta : undefined
      modules.push({
        packageName: packageJson.name,
        unitId: manifest.id,
        tools: Array.isArray(manifest.tools)
          ? manifest.tools.filter(isToolDeclaration).map((tool) => ({ id: tool.id }))
          : [],
        agentTools: meta?.agentTools,
      })
    }
  }

  return modules
}

function findPackageDirectories(root: string): string[] {
  const directories = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "node_modules" || entry.name === "dist") continue
    const directory = path.join(root, entry.name)
    if (existsSync(path.join(directory, "package.json"))) directories.push(directory)
    else directories.push(...findPackageDirectories(directory))
  }
  return directories.sort()
}

function packageExportTarget(value: unknown): string | undefined {
  if (typeof value === "string") return value
  if (!isRecord(value)) return undefined
  for (const condition of ["development", "import", "default", "types", "require"]) {
    const target = packageExportTarget(value[condition])
    if (target) return target
  }
  return undefined
}

function isGraphManifest(value: unknown): value is Record<string, unknown> & { id: string } {
  return (
    isRecord(value) &&
    GRAPH_UNIT_SCHEMA_VERSIONS.has(String(value.schemaVersion)) &&
    typeof value.id === "string"
  )
}

const GRAPH_UNIT_SCHEMA_VERSIONS = new Set([
  "voyant.module.v1",
  "voyant.extension.v1",
  "voyant.plugin.v1",
  "voyant.adapter.v1",
  "voyant.provider.v1",
])

function schemaVersionForGraphKind(kind: unknown): string | undefined {
  if (kind === "module") return "voyant.module.v1"
  if (kind === "extension") return "voyant.extension.v1"
  if (kind === "plugin") return "voyant.plugin.v1"
  if (kind === "adapter") return "voyant.adapter.v1"
  if (kind === "provider") return "voyant.provider.v1"
  return undefined
}

function hasTools(value: Record<string, unknown>) {
  return Array.isArray(value.tools) && value.tools.length > 0
}

function isToolDeclaration(value: unknown): value is { id: string } {
  return isRecord(value) && typeof value.id === "string"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
