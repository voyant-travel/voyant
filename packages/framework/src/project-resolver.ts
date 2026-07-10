// agent-quality: file-size exception -- reason: the v1 project resolver keeps package metadata admission, package export safety, local runtime lowering, and the exact CLI artifact contract in one reviewable boundary until the contract stabilizes.
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import type {
  VoyantGraphCapabilityDeclaration,
  VoyantGraphProject,
  VoyantGraphProjectSelection,
  VoyantGraphUnitKind,
  VoyantGraphUnitManifest,
} from "@voyant-travel/core/project"
import { buildProjectRuntimeModule } from "./deployment-artifacts.js"
import {
  deriveDeploymentRequirements,
  type ResolvedVoyantDeploymentGraph,
  resolveDeploymentGraphWithPackageManifests,
  type VoyantGraphPackageMetadata,
  type VoyantGraphPackageRecord,
} from "./deployment-graph.js"

export const VOYANT_MIGRATION_PLAN_SCHEMA_VERSION = "voyant.migration-plan.v1" as const
export const VOYANT_PROJECT_RUNTIME_ENTRY = "runtime/project-runtime.generated.ts" as const

export interface ResolveProjectInput {
  project: unknown
  projectRoot: string
  configPath: string
}

export interface FrameworkGeneratedProjectFile {
  path: string
  contents: string
}

export interface VoyantProjectMigration {
  id: string
  owner: string
  kind: VoyantGraphUnitKind
  packageName: string
  source?: string
}

export interface VoyantProjectMigrationPlan {
  schemaVersion: typeof VOYANT_MIGRATION_PLAN_SCHEMA_VERSION
  contentHash: string
  migrations: readonly VoyantProjectMigration[]
}

export interface ResolvedProjectArtifacts {
  runtimeEntry: string
  files: readonly FrameworkGeneratedProjectFile[]
  migrationPlan: VoyantProjectMigrationPlan
}

export type ResolvedVoyantProjectGraph = Omit<ResolvedVoyantDeploymentGraph, "deployment"> & {
  deployment: Omit<ResolvedVoyantDeploymentGraph["deployment"], "target"> & { target?: never }
}

export interface ResolvedVoyantProject {
  graph: ResolvedVoyantProjectGraph
  artifacts: ResolvedProjectArtifacts
}

interface InspectedPackage {
  directory: string
  record: VoyantGraphPackageRecord
}

interface MaterializedProject {
  project: VoyantGraphProject
  packages: ReadonlyMap<string, InspectedPackage>
}

interface PackageJson {
  name?: unknown
  version?: unknown
  exports?: unknown
  voyant?: unknown
}

/** Resolve a config-authored project through admitted package-owned manifests. */
export async function resolveProject(input: ResolveProjectInput): Promise<ResolvedVoyantProject> {
  const project = requireProject(input.project)
  if (project.deployment?.target !== undefined && project.deployment.target !== "node") {
    throw new Error(
      `resolveProject: unified application deployment target must be node, got ${String(project.deployment.target)}.`,
    )
  }
  const projectRoot = path.resolve(requireNonEmptyString(input.projectRoot, "projectRoot"))
  const configPath = path.resolve(requireNonEmptyString(input.configPath, "configPath"))
  assertPathInside(projectRoot, configPath, "configPath")

  const materialized = await materializeProjectSelections(project, projectRoot)
  const providers = { ...(project.deployment?.providers ?? {}) }
  const mode = project.deployment?.mode
  const graph = requireTargetNeutralGraph(
    await resolveDeploymentGraphWithPackageManifests({
      project: materialized.project,
      deployment: {
        providers,
        ...(mode ? { mode } : {}),
        requirements: deriveDeploymentRequirements(providers),
      },
      packageRecords: [...materialized.packages.values()].map(({ record }) => record),
      frameworkVersion: await readFrameworkVersion(),
      loadPackageManifests: (record) => loadAdmittedPackageManifests(record, materialized.packages),
    }),
  )

  const runtimeEntry = VOYANT_PROJECT_RUNTIME_ENTRY
  const files: FrameworkGeneratedProjectFile[] = [
    {
      path: runtimeEntry,
      contents: buildProjectRuntimeModule({
        graph,
        command: "voyant project resolve",
        runtimeEntryOverrides: await buildLocalRuntimeEntryOverrides(
          graph,
          materialized.packages,
          projectRoot,
          runtimeEntry,
        ),
      }),
    },
  ]

  return {
    graph,
    artifacts: {
      runtimeEntry,
      files: files.sort((left, right) => left.path.localeCompare(right.path)),
      migrationPlan: buildMigrationPlan(graph),
    },
  }
}

function requireTargetNeutralGraph(
  graph: ResolvedVoyantDeploymentGraph,
): ResolvedVoyantProjectGraph {
  if (graph.deployment.target !== undefined) {
    throw new Error(
      `resolveProject: resolved graph must not contain deployment.target, got ${graph.deployment.target}.`,
    )
  }
  const { target: _target, ...deployment } = graph.deployment
  return { ...graph, deployment }
}

async function materializeProjectSelections(
  project: VoyantGraphProject,
  projectRoot: string,
): Promise<MaterializedProject> {
  const packages = new Map<string, InspectedPackage>()
  const selections = project.selections
  if (!selections) return { project, packages }

  const modules = await materializeUnits(
    project.modules,
    selections.modules,
    "module",
    projectRoot,
    packages,
  )
  const plugins = await materializeUnits(
    project.plugins,
    selections.plugins,
    "plugin",
    projectRoot,
    packages,
  )

  return {
    packages,
    project: {
      ...project,
      modules: modules.units,
      plugins: plugins.units,
      selections: {
        modules: modules.selections,
        plugins: plugins.selections,
      },
    },
  }
}

async function materializeUnits(
  units: readonly VoyantGraphUnitManifest[],
  selections: readonly VoyantGraphProjectSelection[],
  kind: VoyantGraphUnitKind,
  projectRoot: string,
  packages: Map<string, InspectedPackage>,
): Promise<{
  units: VoyantGraphUnitManifest[]
  selections: VoyantGraphProjectSelection[]
}> {
  const selectionsById = new Map(selections.map((selection) => [selection.id, selection]))
  const materializedUnits: VoyantGraphUnitManifest[] = []
  const materializedSelections: VoyantGraphProjectSelection[] = []

  for (const unit of units) {
    const selection = selectionsById.get(unit.id)
    if (!selection) {
      materializedUnits.push(unit)
      continue
    }

    const inspected = await inspectSelectedPackage(selection, kind, projectRoot)
    const selectedId = graphIdForSelection(inspected.record.packageName, selection.id)
    const materializedSelection: VoyantGraphProjectSelection = {
      ...selection,
      id: selectedId,
      packageName: inspected.record.packageName,
    }
    materializedUnits.push({ ...unit, id: selectedId, packageName: inspected.record.packageName })
    materializedSelections.push(materializedSelection)

    const previous = packages.get(inspected.record.packageName)
    if (previous && previous.directory !== inspected.directory) {
      throw new Error(
        `resolveProject: package ${inspected.record.packageName} resolves from more than one selected location.`,
      )
    }
    packages.set(inspected.record.packageName, inspected)
    selectionsById.delete(unit.id)
  }

  if (selectionsById.size > 0) {
    throw new Error(
      `resolveProject: stale ${kind} selection(s) have no project unit: ${[...selectionsById.keys()]
        .sort()
        .join(", ")}.`,
    )
  }
  return { units: materializedUnits, selections: materializedSelections }
}

async function inspectSelectedPackage(
  selection: VoyantGraphProjectSelection,
  kind: VoyantGraphUnitKind,
  projectRoot: string,
): Promise<InspectedPackage> {
  const localPath = selection.provenance.kind === "path" ? selection.provenance.path : undefined
  const directory = localPath
    ? resolveLocalPackageDirectory(projectRoot, localPath)
    : resolveInstalledPackageDirectory(selection.packageName, projectRoot)
  const packageJson = await readPackageJson(directory)
  const packageName = requirePackageName(packageJson, directory)
  if (!localPath && packageName !== selection.packageName) {
    throw new Error(
      `resolveProject: selection ${selection.resolve} resolved package ${packageName}, expected ${selection.packageName}.`,
    )
  }

  const metadata = requirePackageMetadata(packageJson.voyant, packageName)
  if (metadata.kind !== kind && metadata.kind !== "module") {
    throw new Error(
      `resolveProject: ${packageName} metadata kind ${metadata.kind} cannot provide a selected ${kind}.`,
    )
  }
  assertManifestExport(packageJson.exports, metadata.manifest, packageName)

  return {
    directory,
    record: {
      packageName,
      ...(typeof packageJson.version === "string" ? { version: packageJson.version } : {}),
      source: localPath
        ? { kind: "file", reference: localPath }
        : { kind: "registry", reference: selection.packageName },
      metadata,
    },
  }
}

async function loadAdmittedPackageManifests(
  record: VoyantGraphPackageRecord,
  packages: ReadonlyMap<string, InspectedPackage>,
): Promise<readonly VoyantGraphUnitManifest[]> {
  const inspected = packages.get(record.packageName)
  if (!inspected) {
    throw new Error(`Package ${record.packageName} was not inspected before admission.`)
  }
  const packageJson = await readPackageJson(inspected.directory)
  const target = resolveManifestExportTarget(
    inspected.directory,
    packageJson.exports,
    record.metadata?.manifest,
    record.packageName,
  )
  const namespace = (await import(pathToFileURL(target).href)) as Record<string, unknown>
  const manifests = new Map<string, VoyantGraphUnitManifest>()
  for (const value of Object.values(namespace)) {
    if (!isGraphUnitManifest(value)) continue
    manifests.set(value.id, value)
  }
  return [...manifests.values()].sort((left, right) => left.id.localeCompare(right.id))
}

async function buildLocalRuntimeEntryOverrides(
  graph: ResolvedVoyantDeploymentGraph,
  packages: ReadonlyMap<string, InspectedPackage>,
  projectRoot: string,
  runtimeEntry: string,
): Promise<Record<string, string>> {
  const overrides: Record<string, string> = {}
  const runtimeDirectory = path.dirname(path.join(projectRoot, ".voyant", runtimeEntry))

  for (const unit of [...graph.modules, ...graph.plugins]) {
    const inspected = packages.get(unit.packageName)
    if (inspected?.record.source.kind !== "file") continue
    const packageJson = await readPackageJson(inspected.directory)
    for (const route of unit.api) {
      if (!route.runtime) continue
      const packageEntry = lowerOwnerRuntimeEntry(unit.packageName, route.runtime.entry)
      const exportKey =
        packageEntry === unit.packageName
          ? "."
          : `./${packageEntry.slice(unit.packageName.length + 1)}`
      const target = resolvePackageExportTarget(
        inspected.directory,
        packageJson.exports,
        exportKey,
        unit.packageName,
      )
      const relative = path.relative(runtimeDirectory, target).replaceAll("\\", "/")
      overrides[packageEntry] = relative.startsWith(".") ? relative : `./${relative}`
    }
  }
  return overrides
}

function lowerOwnerRuntimeEntry(packageName: string, entry: string): string {
  if (!entry.startsWith(".")) return entry
  if (entry === "." || entry === "./") return packageName
  return `${packageName}/${entry.slice(2)}`
}

function buildMigrationPlan(graph: ResolvedVoyantDeploymentGraph): VoyantProjectMigrationPlan {
  const migrations = [...graph.modules, ...graph.plugins]
    .flatMap((unit) =>
      unit.migrations.map((migration) => ({
        id: migration.id,
        owner: unit.id,
        kind: unit.kind,
        packageName: unit.packageName,
        ...(migration.source ? { source: migration.source } : {}),
      })),
    )
    .sort((left, right) => left.owner.localeCompare(right.owner) || left.id.localeCompare(right.id))
  return {
    schemaVersion: VOYANT_MIGRATION_PLAN_SCHEMA_VERSION,
    contentHash: graph.contentHash,
    migrations,
  }
}

function graphIdForSelection(packageName: string, authoredId: string): string {
  const separator = authoredId.indexOf("#")
  const unitPath = separator === -1 ? "" : authoredId.slice(separator + 1)
  const packageId = packageName.startsWith("@") ? packageName : `npm/${packageName}`
  return unitPath ? `${packageId}#${unitPath}` : packageId
}

function resolveLocalPackageDirectory(projectRoot: string, relativePath: string): string {
  const directory = path.resolve(projectRoot, relativePath)
  assertPathInside(projectRoot, directory, `local selection ${relativePath}`)
  if (!existsSync(path.join(directory, "package.json"))) {
    throw new Error(
      `resolveProject: local selection ${relativePath} must contain package.json with a ./voyant export.`,
    )
  }
  return directory
}

function resolveInstalledPackageDirectory(packageName: string, projectRoot: string): string {
  const startPaths = [projectRoot, path.dirname(fileURLToPath(import.meta.url))]
  for (const start of startPaths) {
    const walked = findNodeModulesPackage(start, packageName)
    if (walked) return walked
  }

  for (const from of [path.join(projectRoot, "package.json"), import.meta.url]) {
    try {
      const entry = createRequire(from).resolve(packageName)
      const root = findOwningPackageDirectory(path.dirname(entry), packageName)
      if (root) return root
    } catch {
      // Import-only packages are found by the node_modules walk above.
    }
  }
  throw new Error(`resolveProject: selected package ${packageName} is not installed.`)
}

function findNodeModulesPackage(start: string, packageName: string): string | undefined {
  let current = path.resolve(start)
  for (;;) {
    const candidate = path.join(current, "node_modules", packageName)
    if (existsSync(path.join(candidate, "package.json"))) return candidate
    const parent = path.dirname(current)
    if (parent === current) return undefined
    current = parent
  }
}

function findOwningPackageDirectory(start: string, packageName: string): string | undefined {
  let current = start
  for (;;) {
    const packageJsonPath = path.join(current, "package.json")
    if (existsSync(packageJsonPath)) {
      try {
        const parsed = JSON.parse(createRequire(import.meta.url)(packageJsonPath)) as PackageJson
        if (parsed.name === packageName) return current
      } catch {
        // Continue towards the filesystem root.
      }
    }
    const parent = path.dirname(current)
    if (parent === current) return undefined
    current = parent
  }
}

async function readPackageJson(directory: string): Promise<PackageJson> {
  const packageJsonPath = path.join(directory, "package.json")
  try {
    return JSON.parse(await readFile(packageJsonPath, "utf8")) as PackageJson
  } catch (error) {
    throw new Error(
      `resolveProject: could not read ${packageJsonPath}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function requirePackageName(packageJson: PackageJson, directory: string): string {
  if (typeof packageJson.name !== "string" || !isPackageName(packageJson.name)) {
    throw new Error(
      `resolveProject: ${directory}/package.json must declare a canonical package name.`,
    )
  }
  return packageJson.name
}

function requirePackageMetadata(value: unknown, packageName: string): VoyantGraphPackageMetadata {
  if (!isRecord(value) || value.schemaVersion !== "voyant.package.v1") {
    throw new Error(
      `resolveProject: ${packageName} must declare package.json#voyant schemaVersion voyant.package.v1.`,
    )
  }
  if (
    value.kind !== "module" &&
    value.kind !== "plugin" &&
    value.kind !== "framework" &&
    value.kind !== "library"
  ) {
    throw new Error(`resolveProject: ${packageName} package.json#voyant.kind is invalid.`)
  }
  if (value.manifest !== "./voyant") {
    throw new Error(
      `resolveProject: ${packageName} package.json#voyant.manifest must be "./voyant".`,
    )
  }
  const compatibleWith = parseCompatibleWith(value.compatibleWith, packageName)
  const requires = parseCapabilityDeclaration(value.requires, packageName)
  return {
    schemaVersion: "voyant.package.v1",
    kind: value.kind,
    manifest: "./voyant",
    ...(compatibleWith ? { compatibleWith } : {}),
    ...(requires ? { requires } : {}),
  }
}

function parseCompatibleWith(
  value: unknown,
  packageName: string,
): VoyantGraphPackageMetadata["compatibleWith"] {
  if (value === undefined) return undefined
  if (!isRecord(value)) {
    throw new Error(`resolveProject: ${packageName} package compatibility must be an object.`)
  }
  const framework = value.framework
  const targets = value.targets
  const modes = value.modes
  if (framework !== undefined && typeof framework !== "string") {
    throw new Error(`resolveProject: ${packageName} compatibleWith.framework must be a string.`)
  }
  if (targets !== undefined && !isStringArray(targets)) {
    throw new Error(`resolveProject: ${packageName} compatibleWith.targets must be a string array.`)
  }
  if (
    modes !== undefined &&
    (!isStringArray(modes) ||
      modes.some((mode) => mode !== "local" && mode !== "managed-cloud" && mode !== "self-hosted"))
  ) {
    throw new Error(`resolveProject: ${packageName} compatibleWith.modes is invalid.`)
  }
  return {
    ...(framework ? { framework } : {}),
    ...(targets ? { targets } : {}),
    ...(modes ? { modes: modes as Array<"local" | "managed-cloud" | "self-hosted"> } : {}),
  }
}

function parseCapabilityDeclaration(
  value: unknown,
  packageName: string,
): VoyantGraphCapabilityDeclaration | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) {
    throw new Error(`resolveProject: ${packageName} package requirements must be an object.`)
  }
  if (value.capabilities !== undefined && !isStringArray(value.capabilities)) {
    throw new Error(`resolveProject: ${packageName} required capabilities must be a string array.`)
  }
  if (
    value.ports !== undefined &&
    (!Array.isArray(value.ports) ||
      value.ports.some(
        (port) =>
          !isRecord(port) ||
          typeof port.id !== "string" ||
          (port.optional !== undefined && typeof port.optional !== "boolean"),
      ))
  ) {
    throw new Error(`resolveProject: ${packageName} required ports are invalid.`)
  }
  return value as VoyantGraphCapabilityDeclaration
}

function assertManifestExport(exports: unknown, manifest: string | undefined, packageName: string) {
  const targets = isRecord(exports) ? packageExportTargets(exports[manifest ?? ""]) : undefined
  if (!targets || targets.length === 0) {
    throw new Error(`resolveProject: ${packageName} does not export ${manifest ?? "./voyant"}.`)
  }
}

function resolveManifestExportTarget(
  packageDirectory: string,
  exports: unknown,
  manifest: string | undefined,
  packageName: string,
): string {
  const targets = isRecord(exports) ? packageExportTargets(exports[manifest ?? ""]) : undefined
  if (!targets || targets.length === 0) {
    throw new Error(`resolveProject: ${packageName} does not export ${manifest ?? "./voyant"}.`)
  }

  let invalid: Error | undefined
  for (const target of targets) {
    try {
      if (!target.startsWith("./")) {
        throw new Error(`${packageName} ./voyant export target must start with ./`)
      }
      const resolved = path.resolve(packageDirectory, target)
      assertPathInside(packageDirectory, resolved, `${packageName} ./voyant export`)
      return resolved
    } catch (error) {
      invalid = error instanceof Error ? error : new Error(String(error))
    }
  }
  throw invalid ?? new Error(`resolveProject: ${packageName} has no valid ./voyant export target.`)
}

function resolvePackageExportTarget(
  packageDirectory: string,
  exports: unknown,
  exportKey: string,
  packageName: string,
): string {
  const targets = isRecord(exports) ? packageExportTargets(exports[exportKey]) : undefined
  if (!targets || targets.length === 0) {
    throw new Error(`resolveProject: ${packageName} does not export ${exportKey}.`)
  }
  for (const target of targets) {
    if (!target.startsWith("./")) continue
    const resolved = path.resolve(packageDirectory, target)
    assertPathInside(packageDirectory, resolved, `${packageName} ${exportKey} export`)
    return resolved
  }
  throw new Error(`resolveProject: ${packageName} has no valid ${exportKey} export target.`)
}

function packageExportTargets(value: unknown): string[] | undefined {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) {
    return value.flatMap((candidate) => packageExportTargets(candidate) ?? [])
  }
  if (value === null) return []
  if (!isRecord(value)) return undefined
  for (const condition of ["node", "import", "default"]) {
    if (!Object.hasOwn(value, condition)) continue
    return packageExportTargets(value[condition])
  }
  return undefined
}

function requireProject(value: unknown): VoyantGraphProject {
  if (!isVoyantGraphProject(value)) {
    throw new Error(
      "resolveProject: project must be the voyant.project.v1 result returned by defineProject(...).",
    )
  }
  return value
}

function isVoyantGraphProject(value: unknown): value is VoyantGraphProject {
  if (
    !isRecord(value) ||
    value.schemaVersion !== "voyant.project.v1" ||
    !Array.isArray(value.modules) ||
    !value.modules.every(isGraphUnitManifest) ||
    !Array.isArray(value.plugins) ||
    !value.plugins.every(isGraphUnitManifest)
  ) {
    return false
  }
  if (value.selections === undefined) return true
  if (!isRecord(value.selections)) return false
  return (
    Array.isArray(value.selections.modules) &&
    value.selections.modules.every(isProjectSelection) &&
    Array.isArray(value.selections.plugins) &&
    value.selections.plugins.every(isProjectSelection)
  )
}

function isProjectSelection(value: unknown): value is VoyantGraphProjectSelection {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.resolve === "string" &&
    typeof value.packageName === "string" &&
    isRecord(value.provenance) &&
    (value.provenance.kind === "package" || value.provenance.kind === "path")
  )
}

function isGraphUnitManifest(value: unknown): value is VoyantGraphUnitManifest {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.schemaVersion === "voyant.module.v1" || value.schemaVersion === "voyant.plugin.v1")
  )
}

function isPackageName(value: string): boolean {
  return (
    /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/.test(value) ||
    /^[a-z0-9][a-z0-9._-]*$/.test(value)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`resolveProject: ${label} must be a non-empty string.`)
  }
  return value
}

function assertPathInside(root: string, candidate: string, label: string): void {
  const relative = path.relative(path.resolve(root), path.resolve(candidate))
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) return
  throw new Error(`resolveProject: ${label} must stay inside ${root}.`)
}

async function readFrameworkVersion(): Promise<string | undefined> {
  const directory = findOwningPackageDirectory(
    path.dirname(fileURLToPath(import.meta.url)),
    "@voyant-travel/framework",
  )
  if (!directory) return undefined
  const packageJson = await readPackageJson(directory)
  return typeof packageJson.version === "string" ? packageJson.version : undefined
}
