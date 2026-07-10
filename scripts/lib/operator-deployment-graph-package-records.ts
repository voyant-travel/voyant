import path from "node:path"
import { pathToFileURL } from "node:url"

import * as frameworkProject from "@voyant-travel/framework/project"

import {
  defineDeployment,
  type ResolvedVoyantGraphUnit,
  resolveDeploymentGraph,
  resolveDeploymentGraphWithPackageManifests,
  VOYANT_GRAPH_PACKAGE_SCHEMA_VERSION,
  type VoyantGraphAdmissionPolicy,
  type VoyantGraphDeployment,
  type VoyantGraphPackageRecord,
  type VoyantGraphProject,
  type VoyantGraphProjectSelection,
  type VoyantGraphRuntimeTarget,
  type VoyantGraphUnitManifest,
  type VoyantPackageMetadata,
} from "../../packages/framework/src/deployment-graph.ts"
import type { ManagedScheduledJob } from "../../packages/framework/src/managed-jobs.ts"
import type { VoyantProjectProviders } from "../../packages/framework/src/profile-types.ts"
import {
  inferredNodeRuntimePackageMetadata,
  runtimeReferencePackageNames,
} from "../../packages/framework/src/project-resolver.ts"
import { readPnpmLockfilePackageRecords } from "./deployment-graph-provenance.mjs"
import { loadVoyantPackageManifests } from "./load-voyant-package-manifests.ts"

export interface OperatorAuthoredProject extends VoyantGraphProject {
  deployment: {
    target: VoyantGraphRuntimeTarget
    mode: "local" | "managed-cloud" | "self-hosted"
    providers: VoyantProjectProviders
    migrations?: NonNullable<VoyantGraphProject["deployment"]>["migrations"]
  }
}

export interface ResolvedOperatorProject {
  project: VoyantGraphProject
  deployment: Omit<VoyantGraphDeployment, "project">
}

interface ResolveOperatorDeploymentGraphOptions {
  project: OperatorAuthoredProject
  projectRoot: string
  repoRoot: string
  frameworkVersion: string
  scheduledJobs?: readonly ManagedScheduledJob[]
}

export const OPERATOR_GRAPH_ADMISSION_POLICY = {
  allowedSourceKinds: ["registry", "workspace"],
} as const satisfies VoyantGraphAdmissionPolicy

const OPERATOR_GRAPH_COMPATIBILITY = {
  framework: ">=0.26.0",
  targets: ["node"],
  modes: ["local", "managed-cloud", "self-hosted"],
} as const

export const OPERATOR_GRAPH_PACKAGE_METADATA_OVERRIDES = {
  "@voyant-travel/plugin-netopia": {
    schemaVersion: VOYANT_GRAPH_PACKAGE_SCHEMA_VERSION,
    kind: "plugin",
    compatibleWith: OPERATOR_GRAPH_COMPATIBILITY,
  },
} as const satisfies Record<string, VoyantPackageMetadata>

const OPERATOR_LOCAL_PACKAGE_RECORDS = [
  {
    packageName: "@voyant-travel/operator",
    source: {
      kind: "workspace",
      reference: "starters/operator",
    },
    metadata: {
      schemaVersion: VOYANT_GRAPH_PACKAGE_SCHEMA_VERSION,
      kind: "module",
      compatibleWith: OPERATOR_GRAPH_COMPATIBILITY,
    },
  },
] as const satisfies readonly VoyantGraphPackageRecord[]

export function withOperatorDeploymentLocalPackageRecords(
  records: readonly VoyantGraphPackageRecord[],
): VoyantGraphPackageRecord[] {
  const byPackageName = new Map(records.map((record) => [record.packageName, record]))
  for (const record of OPERATOR_LOCAL_PACKAGE_RECORDS) {
    if (byPackageName.has(record.packageName)) byPackageName.set(record.packageName, record)
  }
  return [...byPackageName.values()].sort((left, right) =>
    left.packageName.localeCompare(right.packageName),
  )
}

export function withOperatorNodePackageCompatibility(
  records: readonly VoyantGraphPackageRecord[],
): VoyantGraphPackageRecord[] {
  return records.map((record) =>
    record.metadata
      ? {
          ...record,
          metadata: {
            ...record.metadata,
            compatibleWith: {
              ...record.metadata.compatibleWith,
              targets: ["node"],
            },
          },
        }
      : record,
  )
}

/** Resolve the one authored operator config, then admit and load package manifests. */
export async function resolveOperatorDeploymentGraph(
  options: ResolveOperatorDeploymentGraphOptions,
) {
  const resolved = await resolveOperatorProject(options.project, options.projectRoot)
  const graphInput = {
    project: resolved.project,
    deployment: resolved.deployment,
    scheduledJobs: options.scheduledJobs,
    frameworkVersion: options.frameworkVersion,
    target: resolved.deployment.target,
    mode: resolved.deployment.mode,
    admission: OPERATOR_GRAPH_ADMISSION_POLICY,
  } as const
  const discoveredGraph = await resolveDeploymentGraph(graphInput)
  const selectedPackageRecords = withOperatorNodePackageCompatibility(
    withOperatorDeploymentLocalPackageRecords(
      readPnpmLockfilePackageRecords({
        repoRoot: options.repoRoot,
        projectRoot: options.projectRoot,
        importerPaths: ["starters/operator"],
        packageNames: [
          "@voyant-travel/framework",
          "@voyant-travel/framework-migrations",
          ...discoveredGraph.packageRecords.map((record) => record.packageName),
        ],
        packageMetadata: OPERATOR_GRAPH_PACKAGE_METADATA_OVERRIDES,
      }),
    ),
  )
  const manifestedGraph = await resolveDeploymentGraphWithPackageManifests({
    ...graphInput,
    packageRecords: selectedPackageRecords,
    loadPackageManifests: (record) =>
      loadVoyantPackageManifests(record, {
        projectRoot: options.projectRoot,
        repoRoot: options.repoRoot,
      }),
  })
  const referencedPackageNames = runtimeReferencePackageNames([
    ...manifestedGraph.modules,
    ...manifestedGraph.extensions,
    ...manifestedGraph.plugins,
  ])
  const packageRecords = withOperatorNodePackageCompatibility(
    withInferredRuntimePackageMetadata(
      withOperatorDeploymentLocalPackageRecords(
        readPnpmLockfilePackageRecords({
          repoRoot: options.repoRoot,
          projectRoot: options.projectRoot,
          importerPaths: ["starters/operator"],
          packageNames: [
            ...manifestedGraph.packageRecords.map((record) => record.packageName),
            ...referencedPackageNames,
          ],
          packageMetadata: OPERATOR_GRAPH_PACKAGE_METADATA_OVERRIDES,
        }),
      ),
      referencedPackageNames,
    ),
  )
  const graph = await resolveDeploymentGraphWithPackageManifests({
    ...graphInput,
    packageRecords,
    loadPackageManifests: (record) =>
      loadVoyantPackageManifests(record, {
        projectRoot: options.projectRoot,
        repoRoot: options.repoRoot,
      }),
  })

  return { ...resolved, graph }
}

function withInferredRuntimePackageMetadata(
  records: readonly VoyantGraphPackageRecord[],
  runtimePackageNames: readonly string[],
): VoyantGraphPackageRecord[] {
  const runtimePackages = new Set(runtimePackageNames)
  return records.map((record) =>
    runtimePackages.has(record.packageName) && !record.metadata
      ? { ...record, metadata: inferredNodeRuntimePackageMetadata() }
      : record,
  )
}

async function resolveOperatorProject(
  project: OperatorAuthoredProject,
  projectRoot: string,
): Promise<ResolvedOperatorProject> {
  const frameworkResolver = (
    frameworkProject as typeof frameworkProject & {
      resolveProject?: (input: {
        project: OperatorAuthoredProject
        projectRoot: string
        configPath: string
      }) => unknown
    }
  ).resolveProject

  if (frameworkResolver) {
    try {
      return normalizeFrameworkResolution(
        await frameworkResolver({
          project,
          projectRoot,
          configPath: path.join(projectRoot, "voyant.config.ts"),
        }),
        project,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!message.includes("local selection") || !message.includes("package.json")) throw error
    }
  }

  // Integration fallback for the project-selection base commit. The framework
  // resolver worker replaces this path once resolveProject is available.
  const resolvedProject = await loadLocalProjectSelections(project, projectRoot)
  return {
    project: resolvedProject,
    deployment: deploymentFromProject(project, resolvedProject),
  }
}

function normalizeFrameworkResolution(
  value: unknown,
  authored: OperatorAuthoredProject,
): ResolvedOperatorProject {
  if (!value || typeof value !== "object") {
    throw new Error("resolveProject must return a resolved project/deployment object")
  }
  const record = value as Record<string, unknown>
  const project = isGraphProject(record.project)
    ? record.project
    : isGraphProject(value)
      ? value
      : isResolvedGraph(record.graph)
        ? projectFromResolvedGraph(record.graph, authored)
        : undefined
  if (!project) throw new Error("resolveProject did not return a resolved project")

  const deploymentValue =
    record.deployment && typeof record.deployment === "object"
      ? (record.deployment as Record<string, unknown>)
      : record
  const mode = deploymentMode(deploymentValue.mode) ?? authored.deployment.mode
  const providers = stringRecord(deploymentValue.providers) ?? authored.deployment.providers

  return {
    project,
    deployment: deploymentFromSettings(project, { mode, providers }),
  }
}

function projectFromResolvedGraph(
  graph: {
    project: { presetLineage?: string }
    modules: readonly ResolvedVoyantGraphUnit[]
    extensions: readonly ResolvedVoyantGraphUnit[]
    plugins: readonly ResolvedVoyantGraphUnit[]
  },
  authored: OperatorAuthoredProject,
): VoyantGraphProject {
  const presetLineage = graph.project.presetLineage ?? authored.presetLineage
  return {
    schemaVersion: "voyant.project.v1",
    ...(presetLineage ? { presetLineage } : {}),
    modules: graph.modules.map((unit) => manifestFromResolvedUnit(unit, "voyant.module.v1")),
    extensions: graph.extensions.map((unit) =>
      manifestFromResolvedUnit(unit, "voyant.extension.v1"),
    ),
    plugins: graph.plugins.map((unit) => manifestFromResolvedUnit(unit, "voyant.plugin.v1")),
    deployment: authored.deployment,
  }
}

function manifestFromResolvedUnit(
  unit: ResolvedVoyantGraphUnit,
  schemaVersion: VoyantGraphUnitManifest["schemaVersion"],
): VoyantGraphUnitManifest {
  return {
    schemaVersion,
    id: unit.id,
    packageName: unit.packageName,
    ...(unit.localId ? { localId: unit.localId } : {}),
    provides: unit.provides,
    requires: unit.requires,
    api: unit.api,
    schema: unit.schema,
    migrations: unit.migrations,
    links: unit.links,
    subscribers: unit.subscribers,
    events: unit.events,
    workflows: unit.workflows,
    ...(unit.setupMigrations ? { setupMigrations: unit.setupMigrations } : {}),
    ...(unit.config ? { config: unit.config } : {}),
    ...(unit.secrets ? { secrets: unit.secrets } : {}),
    ...(unit.resources ? { resources: unit.resources } : {}),
    ...(unit.providers ? { providers: unit.providers } : {}),
    ...(unit.access ? { access: unit.access } : {}),
    ...(unit.admin ? { admin: unit.admin } : {}),
    ...(unit.tools ? { tools: unit.tools } : {}),
    ...(unit.webhooks ? { webhooks: unit.webhooks } : {}),
    ...(unit.actions ? { actions: unit.actions } : {}),
    ...(unit.lifecycle ? { lifecycle: unit.lifecycle } : {}),
  }
}

async function loadLocalProjectSelections(
  project: OperatorAuthoredProject,
  projectRoot: string,
): Promise<VoyantGraphProject> {
  const localModules = await localManifestReplacements(
    project.selections?.modules ?? [],
    projectRoot,
    "voyant.module.v1",
  )
  const localExtensions = await localManifestReplacements(
    project.selections?.extensions ?? [],
    projectRoot,
    "voyant.extension.v1",
  )
  const localPlugins = await localManifestReplacements(
    project.selections?.plugins ?? [],
    projectRoot,
    "voyant.plugin.v1",
  )

  return {
    ...project,
    modules: project.modules.map((unit) => localModules.get(unit.id) ?? unit),
    extensions: project.extensions.map((unit) => localExtensions.get(unit.id) ?? unit),
    plugins: project.plugins.map((unit) => localPlugins.get(unit.id) ?? unit),
    ...(project.selections
      ? {
          selections: {
            modules: resolvedSelections(project.selections.modules, localModules),
            extensions: resolvedSelections(project.selections.extensions, localExtensions),
            plugins: resolvedSelections(project.selections.plugins, localPlugins),
          },
        }
      : {}),
  }
}

async function localManifestReplacements(
  selections: readonly VoyantGraphProjectSelection[],
  projectRoot: string,
  schemaVersion: VoyantGraphUnitManifest["schemaVersion"],
): Promise<Map<string, VoyantGraphUnitManifest>> {
  const replacements = new Map<string, VoyantGraphUnitManifest>()
  for (const selection of selections) {
    if (selection.provenance.kind !== "path") continue
    const manifestPath = path.join(projectRoot, selection.provenance.path, "voyant.ts")
    const namespace = (await import(pathToFileURL(manifestPath).href)) as Record<string, unknown>
    const manifest = Object.values(namespace).find((value): value is VoyantGraphUnitManifest =>
      Boolean(
        value &&
          typeof value === "object" &&
          (value as VoyantGraphUnitManifest).schemaVersion === schemaVersion,
      ),
    )
    if (!manifest) {
      throw new Error(
        `${selection.resolve} must export one ${schemaVersion} manifest from voyant.ts`,
      )
    }
    replacements.set(selection.id, manifest)
  }
  return replacements
}

function resolvedSelections(
  selections: readonly VoyantGraphProjectSelection[],
  replacements: ReadonlyMap<string, VoyantGraphUnitManifest>,
): VoyantGraphProjectSelection[] {
  return selections.map((selection) => {
    const manifest = replacements.get(selection.id)
    return manifest
      ? {
          ...selection,
          id: manifest.id,
          packageName: manifest.packageName ?? selection.packageName,
        }
      : selection
  })
}

function deploymentFromProject(
  authored: OperatorAuthoredProject,
  project: VoyantGraphProject,
): Omit<VoyantGraphDeployment, "project"> {
  return deploymentFromSettings(project, authored.deployment)
}

function deploymentFromSettings(
  project: VoyantGraphProject,
  settings: Pick<OperatorAuthoredProject["deployment"], "mode" | "providers">,
): Omit<VoyantGraphDeployment, "project"> {
  const { project: _project, ...deployment } = defineDeployment({
    project,
    target: "node",
    mode: settings.mode,
    providers: settings.providers,
    ...(project.deployment?.migrations?.length
      ? { migrations: project.deployment.migrations }
      : {}),
  })
  return {
    ...deployment,
  }
}

function isGraphProject(value: unknown): value is VoyantGraphProject {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return (
    record.schemaVersion === "voyant.project.v1" &&
    Array.isArray(record.modules) &&
    Array.isArray(record.extensions) &&
    Array.isArray(record.plugins)
  )
}

function isResolvedGraph(value: unknown): value is {
  project: { presetLineage?: string }
  modules: readonly ResolvedVoyantGraphUnit[]
  extensions: readonly ResolvedVoyantGraphUnit[]
  plugins: readonly ResolvedVoyantGraphUnit[]
} {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return Boolean(
    record.project &&
      Array.isArray(record.modules) &&
      Array.isArray(record.extensions) &&
      Array.isArray(record.plugins),
  )
}

function deploymentMode(value: unknown): OperatorAuthoredProject["deployment"]["mode"] | undefined {
  return value === "local" || value === "managed-cloud" || value === "self-hosted"
    ? value
    : undefined
}

function stringRecord(value: unknown): VoyantProjectProviders | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const entries = Object.entries(value)
  return entries.every((entry): entry is [string, string] => typeof entry[1] === "string")
    ? (Object.fromEntries(entries) as VoyantProjectProviders)
    : undefined
}
