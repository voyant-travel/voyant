import { mkdir, readFile, writeFile } from "node:fs/promises"
import path, { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  buildDeploymentArtifactManifest,
  buildDeploymentGraphJson,
  buildManagedNodeRuntimeEntry,
  buildManagedNodeRuntimeEntryArtifact,
} from "../packages/framework/src/deployment-artifacts.ts"
import { resolveManagedProfileDeploymentGraph } from "../packages/framework/src/deployment-graph.ts"
import { readPnpmLockfilePackageRecords } from "./lib/deployment-graph-provenance.mjs"

interface CliOptions {
  emit: boolean
  profilePath: string
  manifestOutputPath: string
  graphOutputPath: string
  entryOutputPath: string
}

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, "..")
const defaultManagedOperatorRoot = join(repoRoot, "starters", "managed-operator")
const command = "pnpm --filter managed-operator graph:emit"

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const graph = await resolveGraph(options.profilePath)
  const graphText = buildDeploymentGraphJson(graph)
  const graphArtifactPath = toPosixRelativePath(
    dirname(options.entryOutputPath),
    options.graphOutputPath,
    path,
  )
  const profileSnapshotPath = toPosixRelativePath(
    dirname(options.entryOutputPath),
    options.profilePath,
    path,
  )
  const entryText = buildManagedNodeRuntimeEntry({
    graph,
    graphArtifactPath,
    profileSnapshotPath,
    command,
  })
  const manifest = buildDeploymentArtifactManifest({
    graph,
    graphArtifactPath: relativeToManagedOperator(options.graphOutputPath),
    runtimeEntries: [
      buildManagedNodeRuntimeEntryArtifact({
        graph,
        file: relativeToManagedOperator(options.entryOutputPath),
        profileSnapshot: relativeToManagedOperator(options.profilePath),
      }),
    ],
  })
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`

  if (options.emit) {
    await writeGeneratedFile(options.manifestOutputPath, manifestText)
    await writeGeneratedFile(options.graphOutputPath, graphText)
    await writeGeneratedFile(options.entryOutputPath, entryText)
    console.log(
      `emit-deployment-graph: wrote ${relativeToRepo(
        options.manifestOutputPath,
      )}, ${relativeToRepo(options.graphOutputPath)}, and ${relativeToRepo(
        options.entryOutputPath,
      )} (${graph.contentHash})`,
    )
    return
  }

  const failures = await staleGeneratedFiles([
    { path: options.manifestOutputPath, expected: manifestText },
    { path: options.graphOutputPath, expected: graphText },
    { path: options.entryOutputPath, expected: entryText },
  ])

  if (failures.length > 0) {
    console.error("Deployment graph generated artifacts are stale.")
    for (const failure of failures) console.error(`  - ${failure}`)
    console.error(`Run \`${command}\` to refresh them.`)
    process.exit(1)
  }

  console.log(
    `emit-deployment-graph: OK (${graph.modules.length} modules, ${graph.plugins.length} plugins, ${graph.contentHash})`,
  )
}

async function resolveGraph(profilePath: string) {
  const project = JSON.parse(await readFile(profilePath, "utf8"))
  const discoveredGraph = await resolveManagedProfileDeploymentGraph(project)
  const packageRecords = readPnpmLockfilePackageRecords({
    repoRoot,
    packageNames: discoveredGraph.packageRecords.map((record) => record.packageName),
  })
  return resolveManagedProfileDeploymentGraph(project, { packageRecords })
}

async function writeGeneratedFile(filePath: string, text: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, text, "utf8")
}

async function staleGeneratedFiles(
  files: readonly { path: string; expected: string }[],
): Promise<string[]> {
  const failures: string[] = []
  for (const file of files) {
    let actual: string
    try {
      actual = await readFile(file.path, "utf8")
    } catch {
      failures.push(`${relativeToRepo(file.path)} is missing`)
      continue
    }
    if (actual !== file.expected) {
      failures.push(`${relativeToRepo(file.path)} is stale`)
    }
  }
  return failures
}

function parseArgs(args: readonly string[]): CliOptions {
  const options: CliOptions = {
    emit: false,
    profilePath: join(defaultManagedOperatorRoot, "managed-profile.json"),
    manifestOutputPath: join(defaultManagedOperatorRoot, "deployment-artifacts.generated.json"),
    graphOutputPath: join(defaultManagedOperatorRoot, "deployment-graph.generated.json"),
    entryOutputPath: join(defaultManagedOperatorRoot, "src", "runtime-entry.generated.ts"),
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--emit") {
      options.emit = true
      continue
    }
    if (arg === "--profile") {
      options.profilePath = resolvePath(readValue(args, index, arg))
      index += 1
      continue
    }
    if (arg === "--graph-output") {
      options.graphOutputPath = resolvePath(readValue(args, index, arg))
      index += 1
      continue
    }
    if (arg === "--manifest-output") {
      options.manifestOutputPath = resolvePath(readValue(args, index, arg))
      index += 1
      continue
    }
    if (arg === "--entry-output") {
      options.entryOutputPath = resolvePath(readValue(args, index, arg))
      index += 1
      continue
    }
    if (arg === "--help" || arg === "-h") {
      printHelp()
      process.exit(0)
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function readValue(args: readonly string[], index: number, arg: string): string {
  const value = args[index + 1]
  if (!value) throw new Error(`${arg} requires a value`)
  return value
}

function resolvePath(value: string): string {
  return resolve(repoRoot, value)
}

function relativeToRepo(filePath: string): string {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/")
}

function relativeToManagedOperator(filePath: string): string {
  return path.relative(defaultManagedOperatorRoot, filePath).replaceAll(path.sep, "/")
}

function toPosixRelativePath(fromDir: string, toPath: string, pathModule: typeof path): string {
  let relative = pathModule.relative(fromDir, toPath).replaceAll(pathModule.sep, "/")
  if (!relative.startsWith(".")) relative = `./${relative}`
  return relative
}

function printHelp(): void {
  console.log(`Usage: tsx scripts/emit-deployment-graph.ts [--emit]

Resolves the managed-operator profile into committed generated graph artifacts.

Options:
  --emit                 write generated artifacts instead of checking staleness
  --profile <path>       managed profile JSON path
  --manifest-output <path> deployment artifact manifest output path
  --graph-output <path>  resolved graph JSON output path
  --entry-output <path>  runtime entry metadata module output path
`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
