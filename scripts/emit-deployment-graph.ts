import { execFileSync } from "node:child_process"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path, { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import {
  buildDeploymentArtifactManifest,
  buildDeploymentGraphJson,
  buildGraphRuntimeModule,
  buildManagedNodeRuntimeEntry,
  buildManagedNodeRuntimeEntryArtifact,
} from "../packages/framework/src/deployment-artifacts.ts"
import type { ResolvedVoyantDeploymentGraph } from "../packages/framework/src/deployment-graph.ts"
import type { ResolvedProjectArtifacts } from "../packages/framework/src/project-resolver.ts"
import { getManagedProfileScheduledJobs } from "../packages/framework/src/managed-jobs.ts"
import type { VoyantProjectManifest } from "../packages/framework/src/profile-types.ts"
import { schema as operatorSchemaPaths } from "../starters/operator/drizzle.schemas.generated.ts"
import { OPERATOR_LOCAL_SCHEDULED_JOBS } from "../starters/operator/src/local-scheduled-jobs.ts"
import {
  buildDeploymentGraphDoctorJson,
  buildDeploymentGraphDoctorReport,
  checkDeploymentGraphGeneratedArtifacts,
  formatDeploymentGraphDoctorDiagnostics,
} from "./lib/deployment-graph-doctor.ts"
import {
  type OperatorAuthoredProject,
  resolveOperatorDeploymentGraph,
} from "./lib/operator-deployment-graph-package-records.ts"

interface CliOptions {
  emit: boolean
  json: boolean
  configPath: string
  profileOutputPath: string
  manifestOutputPath: string
  graphOutputPath: string
  entryOutputPath: string
  runtimeOutputPath: string
}

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, "..")
const defaultOperatorRoot = join(repoRoot, "starters", "operator")
const command = "pnpm --filter operator graph:emit"

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const { graph, profile, projectArtifacts } = await resolveGraph(options.configPath)
  const graphText = formatGeneratedText(options.graphOutputPath, buildDeploymentGraphJson(graph))
  const graphArtifactPath = toPosixRelativePath(
    dirname(options.entryOutputPath),
    options.graphOutputPath,
  )
  const profileSnapshotPath = toPosixRelativePath(
    dirname(options.entryOutputPath),
    options.profileOutputPath,
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
  const runtimeText = formatGeneratedText(
    options.runtimeOutputPath,
    buildGraphRuntimeModule({
      graph,
      command,
      runtimeEntryOverrides: projectRuntimeEntryOverrides(
        graph,
        defaultOperatorRoot,
        options.runtimeOutputPath,
      ),
    }),
  )
  const manifestDirectory = dirname(options.manifestOutputPath)
  const manifest = buildDeploymentArtifactManifest({
    graph,
    graphArtifactPath: toPosixRelativePath(manifestDirectory, options.graphOutputPath),
    runtimeEntries: [
      buildManagedNodeRuntimeEntryArtifact({
        graph,
        file: toPosixRelativePath(manifestDirectory, options.entryOutputPath),
        profileSnapshot: toPosixRelativePath(manifestDirectory, options.profileOutputPath),
      }),
    ],
    migrationSources: operatorMigrationSources(graph),
  })
  const profileText = formatGeneratedText(
    options.profileOutputPath,
    `${JSON.stringify(profile, null, 2)}\n`,
  )
  const manifestText = formatGeneratedText(
    options.manifestOutputPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
  )

  const artifacts = [
    { path: options.profileOutputPath, expected: profileText, facet: "managed-profile" },
    {
      path: options.manifestOutputPath,
      expected: manifestText,
      facet: "deployment-artifacts",
    },
    { path: options.graphOutputPath, expected: graphText, facet: "deployment-graph" },
    { path: options.entryOutputPath, expected: entryText, facet: "runtime-entry" },
    { path: options.runtimeOutputPath, expected: runtimeText, facet: "graph-runtime" },
    ...projectConventionArtifacts(projectArtifacts).map((artifact) => ({
      path: join(defaultOperatorRoot, ".voyant", artifact.path),
      expected: formatGeneratedText(
        join(defaultOperatorRoot, ".voyant", artifact.path),
        artifact.contents,
      ),
      facet: "project-convention",
    })),
  ]

  if (options.emit) {
    for (const artifact of artifacts) await writeGeneratedFile(artifact.path, artifact.expected)
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
      `emit-deployment-graph: wrote ${artifacts
        .map((artifact) => relativeToRepo(artifact.path))
        .join(", ")} (${graph.contentHash})`,
    )
    return
  }

  const artifactDiagnostics = await checkDeploymentGraphGeneratedArtifacts(
    artifacts.map((artifact) => ({
      ...artifact,
      hint: `Run \`${command}\` to refresh generated deployment graph artifacts.`,
    })),
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
    if (artifactDiagnostics.length > 0) console.error(`Run \`${command}\` to refresh them.`)
    process.exit(1)
  }

  console.log(
    `emit-deployment-graph: OK (${graph.modules.length} modules, ${graph.plugins.length} plugins, ${graph.contentHash})`,
  )
}

async function resolveGraph(configPath: string) {
  const project = await loadOperatorConfig(configPath)
  const frameworkVersion = await readFrameworkVersion()
  const profile = compatibilityManagedProfile(project, frameworkVersion)
  const resolved = await resolveOperatorDeploymentGraph({
    project,
    projectRoot: defaultOperatorRoot,
    repoRoot,
    frameworkVersion,
    scheduledJobs: [...getManagedProfileScheduledJobs(profile), ...OPERATOR_LOCAL_SCHEDULED_JOBS],
  })
  return { graph: resolved.graph, profile, projectArtifacts: resolved.artifacts }
}

function projectConventionArtifacts(artifacts: ResolvedProjectArtifacts) {
  return artifacts.files.filter(
    (file) => file.path !== artifacts.runtimeEntry && file.path !== artifacts.migrationRunner,
  )
}

async function loadOperatorConfig(configPath: string): Promise<OperatorAuthoredProject> {
  const namespace = (await import(`${pathToFileURL(configPath).href}?t=${Date.now()}`)) as {
    default?: unknown
  }
  if (!namespace.default || typeof namespace.default !== "object") {
    throw new Error(`${relativeToRepo(configPath)} must default-export defineProject(...)`)
  }
  return namespace.default as OperatorAuthoredProject
}

async function readFrameworkVersion(): Promise<string> {
  const packageJson = JSON.parse(
    await readFile(join(repoRoot, "packages", "framework", "package.json"), "utf8"),
  ) as { version?: string }
  if (!packageJson.version) throw new Error("packages/framework/package.json has no version")
  return packageJson.version
}

function compatibilityManagedProfile(
  project: OperatorAuthoredProject,
  frameworkVersion: string,
): VoyantProjectManifest {
  return {
    schemaVersion: "voyant.managed-profile.v1",
    profile: "operator",
    frameworkVersion,
    mode: project.deployment.mode,
    modules: [],
    plugins: [],
    settings: {},
    providers: project.deployment.providers,
    admin: { enabled: true, path: "/app" },
  }
}

function operatorMigrationSources(graph: ResolvedVoyantDeploymentGraph) {
  const units = [...graph.modules, ...graph.plugins]
  const packageOwnedMigrationSources = new Set(
    units
      .filter((unit) => unit.schema.length > 0 && unit.migrations.length > 0)
      .map((unit) => unit.packageName),
  )
  const manifestPackages = new Set(
    graph.packageRecords
      .filter((record) => record.metadata?.manifest)
      .map((record) => record.packageName),
  )

  const sources: Array<{ packageName: string; schema: string }> = []
  for (const schemaPath of operatorSchemaPaths) {
    const match = schemaPath.match(/(?:^|\/)packages\/([^/]+)\//)
    if (!match?.[1]) continue
    sources.push({ packageName: `@voyant-travel/${match[1]}`, schema: schemaPath })
  }
  return sources.filter(
    (source) =>
      !manifestPackages.has(source.packageName) ||
      packageOwnedMigrationSources.has(source.packageName),
  )
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
  const generatedRoot = join(defaultOperatorRoot, ".voyant")
  const options: CliOptions = {
    emit: false,
    json: false,
    configPath: join(defaultOperatorRoot, "voyant.config.ts"),
    profileOutputPath: join(generatedRoot, "managed-profile.json"),
    manifestOutputPath: join(generatedRoot, "deployment-artifacts.generated.json"),
    graphOutputPath: join(generatedRoot, "deployment-graph.generated.json"),
    entryOutputPath: join(generatedRoot, "runtime-entry.generated.ts"),
    runtimeOutputPath: join(generatedRoot, "runtime", "graph-runtime.generated.ts"),
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
    const outputOption = outputOptionFor(arg)
    if (outputOption) {
      options[outputOption] = resolvePath(readValue(args, index, arg))
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

function outputOptionFor(
  arg: string,
):
  | keyof Pick<
      CliOptions,
      | "configPath"
      | "profileOutputPath"
      | "manifestOutputPath"
      | "graphOutputPath"
      | "entryOutputPath"
      | "runtimeOutputPath"
    >
  | null {
  if (arg === "--config") return "configPath"
  if (arg === "--profile-output") return "profileOutputPath"
  if (arg === "--manifest-output") return "manifestOutputPath"
  if (arg === "--graph-output") return "graphOutputPath"
  if (arg === "--entry-output") return "entryOutputPath"
  if (arg === "--runtime-output") return "runtimeOutputPath"
  return null
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

function toPosixRelativePath(fromDir: string, toPath: string): string {
  let relative = path.relative(fromDir, toPath).replaceAll(path.sep, "/")
  if (!relative.startsWith(".")) relative = `./${relative}`
  return relative
}

function projectRuntimeEntryOverrides(
  graph: ResolvedVoyantDeploymentGraph,
  projectRoot: string,
  runtimeOutputPath: string,
): Record<string, string> {
  const projectPackages = new Set(
    graph.packageRecords
      .filter((record) => record.source.kind === "file" && record.source.reference === ".")
      .map((record) => record.packageName),
  )
  const overrides: Record<string, string> = {}
  for (const unit of [...graph.modules, ...graph.extensions, ...graph.plugins]) {
    if (!projectPackages.has(unit.packageName)) continue
    for (const runtime of unitRuntimeReferences(unit)) {
      if (!runtime.entry.startsWith("./")) continue
      const target = resolve(projectRoot, runtime.entry)
      const relativeTarget = path.relative(projectRoot, target)
      if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
        throw new Error(`Project runtime entry ${runtime.entry} escapes ${projectRoot}`)
      }
      let relativeImport = path.relative(dirname(runtimeOutputPath), target).replaceAll(path.sep, "/")
      if (!relativeImport.startsWith(".")) relativeImport = `./${relativeImport}`
      overrides[`${unit.packageName}/${runtime.entry.slice(2)}`] = relativeImport
    }
  }
  return overrides
}

function unitRuntimeReferences(
  unit: ResolvedVoyantDeploymentGraph["modules"][number],
): Array<{ entry: string }> {
  return [
    unit.runtime,
    ...unit.api.map((route) => route.runtime),
    ...(unit.config ?? []).map((entry) => entry.validator),
    ...(unit.secrets ?? []).map((entry) => entry.validator),
    ...(unit.providers ?? []).map((entry) => entry.runtime),
    ...(unit.admin?.copy ?? []).map((entry) => entry.runtime),
    ...(unit.admin?.routes ?? []).map((entry) => entry.runtime),
    ...(unit.admin?.contributions ?? []).map((entry) => entry.runtime),
    ...(unit.tools ?? []).map((entry) => entry.runtime),
    ...(unit.setupMigrations ?? []).map((entry) => entry.runtime),
    ...unit.workflows.map((entry) => entry.runtime),
    ...unit.subscribers.map((entry) => entry.runtime),
  ].filter((entry): entry is { entry: string } => Boolean(entry))
}

function printHelp(): void {
  console.log(`Usage: tsx scripts/emit-deployment-graph.ts [--emit]

Resolves starters/operator/voyant.config.ts into disposable .voyant artifacts.

Options:
  --emit                    write generated artifacts instead of checking staleness
  --json                    print the graph doctor report JSON contract
  --config <path>           authored project config input
  --profile-output <path>   compatibility profile output path
  --manifest-output <path>  deployment artifact manifest output path
  --graph-output <path>     resolved graph JSON output path
  --entry-output <path>     runtime entry metadata module output path
  --runtime-output <path>   selected graph runtime loader module output path
`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
