import { execFileSync } from "node:child_process"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path, { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  buildDeploymentArtifactManifest,
  buildDeploymentGraphJson,
  buildManagedNodeRuntimeEntry,
  buildManagedNodeRuntimeEntryArtifact,
} from "../packages/framework/src/deployment-artifacts.ts"
import {
  defineDeploymentFromManagedProfile,
  defineProject,
  defineProjectFromManagedProfile,
  type ResolveDeploymentGraphInput,
  resolveDeploymentGraph,
} from "../packages/framework/src/deployment-graph.ts"
import { getManagedProfileScheduledJobs } from "../packages/framework/src/managed-jobs.ts"
import type { VoyantProjectManifest } from "../packages/framework/src/profile-types.ts"
import {
  OPERATOR_LOCAL_DEPLOYMENT_GRAPH_MANIFEST,
  OPERATOR_SCHEMA_DEPLOYMENT_GRAPH_MANIFEST,
} from "../starters/operator/deployment-graph.local.ts"
import { schema as operatorSchemaPaths } from "../starters/operator/drizzle.schemas.generated.ts"
import { OPERATOR_LOCAL_SCHEDULED_JOBS } from "../starters/operator/src/local-scheduled-jobs.ts"
import {
  buildDeploymentGraphDoctorJson,
  buildDeploymentGraphDoctorReport,
  checkDeploymentGraphGeneratedArtifacts,
  formatDeploymentGraphDoctorDiagnostics,
} from "./lib/deployment-graph-doctor.ts"
import { readPnpmLockfilePackageRecords } from "./lib/deployment-graph-provenance.mjs"

interface CliOptions {
  emit: boolean
  json: boolean
  profilePath: string
  manifestOutputPath: string
  graphOutputPath: string
  entryOutputPath: string
}

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, "..")
const defaultOperatorRoot = join(repoRoot, "starters", "operator")
const command = "pnpm --filter operator graph:emit"

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const graph = await resolveGraph(options.profilePath)
  const graphText = formatGeneratedText(options.graphOutputPath, buildDeploymentGraphJson(graph))
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
  const entryText = formatGeneratedText(
    options.entryOutputPath,
    buildManagedNodeRuntimeEntry({
      graph,
      graphArtifactPath,
      profileSnapshotPath,
      command,
    }),
  )
  const manifest = buildDeploymentArtifactManifest({
    graph,
    graphArtifactPath: relativeToOperator(options.graphOutputPath),
    runtimeEntries: [
      buildManagedNodeRuntimeEntryArtifact({
        graph,
        file: relativeToOperator(options.entryOutputPath),
        profileSnapshot: relativeToOperator(options.profilePath),
      }),
    ],
    migrationSources: operatorMigrationSources(),
  })
  const manifestText = formatGeneratedText(
    options.manifestOutputPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
  )

  if (options.emit) {
    await writeGeneratedFile(options.manifestOutputPath, manifestText)
    await writeGeneratedFile(options.graphOutputPath, graphText)
    await writeGeneratedFile(options.entryOutputPath, entryText)
    const report = buildDeploymentGraphDoctorReport({ graph })
    if (options.json) {
      process.stdout.write(buildDeploymentGraphDoctorJson(report))
      if (!report.ok) process.exit(1)
      return
    }
    if (!report.ok) {
      console.error(
        "Deployment graph generated artifacts were written, but graph diagnostics remain.",
      )
      console.error(formatDeploymentGraphDoctorDiagnostics(report.diagnostics))
      process.exit(1)
    }
    console.log(
      `emit-deployment-graph: wrote ${relativeToRepo(
        options.manifestOutputPath,
      )}, ${relativeToRepo(options.graphOutputPath)}, and ${relativeToRepo(
        options.entryOutputPath,
      )} (${graph.contentHash})`,
    )
    return
  }

  const artifactDiagnostics = await checkDeploymentGraphGeneratedArtifacts(
    [
      {
        path: options.manifestOutputPath,
        expected: manifestText,
        facet: "deployment-artifacts",
        hint: `Run \`${command}\` to refresh generated deployment graph artifacts.`,
      },
      {
        path: options.graphOutputPath,
        expected: graphText,
        facet: "deployment-graph",
        hint: `Run \`${command}\` to refresh generated deployment graph artifacts.`,
      },
      {
        path: options.entryOutputPath,
        expected: entryText,
        facet: "runtime-entry",
        hint: `Run \`${command}\` to refresh generated deployment graph artifacts.`,
      },
    ],
    { repoRoot },
  )
  const report = buildDeploymentGraphDoctorReport({ graph, diagnostics: artifactDiagnostics })

  if (options.json) {
    process.stdout.write(buildDeploymentGraphDoctorJson(report))
    if (!report.ok) process.exit(1)
    return
  }

  if (!report.ok) {
    console.error("Deployment graph doctor failed.")
    if (artifactDiagnostics.length > 0) {
      console.error("Generated deployment graph artifacts are stale or missing.")
    }
    console.error(formatDeploymentGraphDoctorDiagnostics(report.diagnostics))
    if (artifactDiagnostics.length > 0) {
      console.error(`Run \`${command}\` to refresh them.`)
    }
    process.exit(1)
  }

  console.log(
    `emit-deployment-graph: OK (${graph.modules.length} modules, ${graph.plugins.length} plugins, ${graph.contentHash})`,
  )
}

async function resolveGraph(profilePath: string) {
  const project = JSON.parse(await readFile(profilePath, "utf8")) as VoyantProjectManifest
  const discoveredGraph = await resolveOperatorDeploymentGraph(project)
  const packageRecords = readPnpmLockfilePackageRecords({
    repoRoot,
    packageNames: [
      "@voyant-travel/framework",
      "@voyant-travel/framework-migrations",
      ...discoveredGraph.packageRecords.map((record) => record.packageName),
    ],
  })
  return resolveOperatorDeploymentGraph(project, { packageRecords })
}

function resolveOperatorDeploymentGraph(
  project: VoyantProjectManifest,
  options: Omit<ResolveDeploymentGraphInput, "project" | "deployment"> = {},
) {
  const graphProject = defineOperatorGraphProject(project)
  const { project: _managedProject, ...deployment } = defineDeploymentFromManagedProfile(project)
  return resolveDeploymentGraph({
    ...options,
    project: graphProject,
    deployment,
    scheduledJobs: [
      ...(options.scheduledJobs ?? getManagedProfileScheduledJobs(project)),
      ...OPERATOR_LOCAL_SCHEDULED_JOBS,
    ],
    frameworkVersion: options.frameworkVersion ?? project.frameworkVersion,
    target: options.target ?? deployment.target,
    mode: options.mode ?? deployment.mode,
  })
}

function defineOperatorGraphProject(project: VoyantProjectManifest) {
  const managedProject = defineProjectFromManagedProfile(project)
  return defineProject({
    presetLineage: managedProject.presetLineage,
    modules: [
      ...managedProject.modules,
      ...OPERATOR_LOCAL_DEPLOYMENT_GRAPH_MANIFEST.modules,
      ...OPERATOR_SCHEMA_DEPLOYMENT_GRAPH_MANIFEST.modules,
    ],
    plugins: [...managedProject.plugins, ...OPERATOR_LOCAL_DEPLOYMENT_GRAPH_MANIFEST.plugins],
    meta: managedProject.meta,
  })
}

function operatorMigrationSources() {
  return operatorSchemaPaths
    .map((schemaPath) => {
      const match = schemaPath.match(/(?:^|\/)packages\/([^/]+)\//)
      if (!match?.[1]) return undefined
      return {
        packageName: `@voyant-travel/${match[1]}`,
        schema: schemaPath,
      }
    })
    .filter((source): source is { packageName: string; schema: string } => Boolean(source))
}

async function writeGeneratedFile(filePath: string, text: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, text, "utf8")
}

function formatGeneratedText(filePath: string, text: string): string {
  return execFileSync("pnpm", ["exec", "biome", "format", "--stdin-file-path", filePath], {
    cwd: repoRoot,
    encoding: "utf8",
    input: text,
    maxBuffer: 1024 * 1024 * 16,
  })
}

function parseArgs(args: readonly string[]): CliOptions {
  const options: CliOptions = {
    emit: false,
    json: false,
    profilePath: join(defaultOperatorRoot, "managed-profile.json"),
    manifestOutputPath: join(defaultOperatorRoot, "deployment-artifacts.generated.json"),
    graphOutputPath: join(defaultOperatorRoot, "deployment-graph.generated.json"),
    entryOutputPath: join(defaultOperatorRoot, "src", "runtime-entry.generated.ts"),
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--emit") {
      options.emit = true
      continue
    }
    if (arg === "--json") {
      options.json = true
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

function relativeToOperator(filePath: string): string {
  return path.relative(defaultOperatorRoot, filePath).replaceAll(path.sep, "/")
}

function toPosixRelativePath(fromDir: string, toPath: string, pathModule: typeof path): string {
  let relative = pathModule.relative(fromDir, toPath).replaceAll(pathModule.sep, "/")
  if (!relative.startsWith(".")) relative = `./${relative}`
  return relative
}

function printHelp(): void {
  console.log(`Usage: tsx scripts/emit-deployment-graph.ts [--emit]

Resolves the operator managed profile into committed generated graph artifacts.

Options:
  --emit                 write generated artifacts instead of checking staleness
  --json                 print the graph doctor report JSON contract
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
