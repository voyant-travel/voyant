// agent-quality: file-size exception -- reason: first v1 deployment-graph cut keeps schema versions, diagnostics, resolver, managed-profile bridge, and author harness co-located until generated runtime lowering defines stable split points.
import {
  getManagedProfileScheduledJobs,
  getStandardProfileEventFiltersForModule,
  getStandardProfileWorkflowManifestForModule,
  type ManagedEventFilterEntry,
  type ManagedScheduledJob,
  type ManagedWorkflowManifestEntry,
  SCHEDULED_JOB_ROUTE,
} from "./managed-jobs.js"
import {
  FRAMEWORK_CAPABILITY_GRAPH,
  FRAMEWORK_RUNTIME_MANIFEST,
  subsetStandardManifest,
} from "./manifest.js"
import {
  getVoyantProjectProviders,
  PROVIDER_ROLES,
  toCreateVoyantAppProfileConfig,
  type VoyantProfileEnvRequirement,
  type VoyantProfileResourceRequirement,
  type VoyantProjectDeploymentMode,
  type VoyantProjectManifest,
  type VoyantProjectProviderRole,
} from "./profile.js"
import { resourceRequirementsForProvider } from "./profile-requirements.js"
import { moduleIdFromSpecifier } from "./profile-types.js"

export const VOYANT_GRAPH_PROJECT_SCHEMA_VERSION = "voyant.project.v1" as const
export const VOYANT_GRAPH_DEPLOYMENT_SCHEMA_VERSION = "voyant.deployment.v1" as const
export const VOYANT_GRAPH_MODULE_SCHEMA_VERSION = "voyant.module.v1" as const
export const VOYANT_GRAPH_PLUGIN_SCHEMA_VERSION = "voyant.plugin.v1" as const
export const VOYANT_GRAPH_PACKAGE_SCHEMA_VERSION = "voyant.package.v1" as const
export const VOYANT_RESOLVED_GRAPH_SCHEMA_VERSION = "voyant.resolved-graph.v1" as const

export type VoyantGraphUnitKind = "module" | "plugin"
export type VoyantGraphPackageKind = VoyantGraphUnitKind | "framework" | "library"
export type VoyantGraphDiagnosticSeverity = "info" | "warning" | "error"
export type VoyantGraphRouteSurface = "admin" | "public" | "webhook" | "internal"
export type VoyantGraphPackageSourceKind = "registry" | "workspace" | "file" | "git" | "unknown"

export const VOYANT_GRAPH_RESERVED_FACETS = [
  "admin",
  "slots",
  "copy",
  "openapi",
  "tools",
  "mcp",
  "permissions",
  "rbac",
  "scopes",
  "actions",
  "audit",
  "i18n",
  "config",
  "secrets",
  "emits",
  "outboundWebhooks",
  "lifecycle",
  "runtime",
] as const

export const VOYANT_GRAPH_DIAGNOSTIC_CODE_REGISTRY = {
  VOYANT_GRAPH_ARTIFACT_MISSING: "A generated deployment graph artifact is missing.",
  VOYANT_GRAPH_ARTIFACT_STALE: "A generated deployment graph artifact is stale.",
  VOYANT_GRAPH_DUPLICATE_ENTITY_ID: "Two v1 graph entities resolved to the same stable entity id.",
  VOYANT_GRAPH_DUPLICATE_ID: "Two selected graph units resolved to the same graph id.",
  VOYANT_GRAPH_INVALID_CAPABILITY_TOKEN:
    "A provides/requires capability token does not match v1 namespace rules.",
  VOYANT_GRAPH_INVALID_ENTITY_ID: "A v1 facet entity is missing a stable id or uses an invalid id.",
  VOYANT_GRAPH_INVALID_ID: "A graph unit id is missing or is not a canonical package graph id.",
  VOYANT_GRAPH_INVALID_ROUTE_BUNDLE:
    "An API route bundle declaration does not match the v1 route metadata contract.",
  VOYANT_GRAPH_INVALID_SCHEMA_VERSION: "A graph declaration uses an unsupported schema version.",
  VOYANT_GRAPH_INVALID_SCOPE:
    "An API route bundle required scope does not match v1 resource:action syntax.",
  VOYANT_GRAPH_MISSING_CAPABILITY:
    "A selected graph unit requires a capability that no selected graph unit provides.",
  VOYANT_GRAPH_MISSING_PORT:
    "A selected graph unit requires a typed port that no selected graph unit provides.",
  VOYANT_GRAPH_PACKAGE_INCOMPATIBLE:
    "A package metadata record is incompatible with the selected target or deployment mode.",
  VOYANT_GRAPH_PACKAGE_SOURCE_UNADMITTED:
    "A package source kind is not admitted by the configured graph admission policy.",
  VOYANT_GRAPH_UNKNOWN_FACET: "A module or plugin manifest contains an unknown top-level facet.",
  VOYANT_GRAPH_UNSUPPORTED_FACET:
    "A module or plugin manifest uses a reserved facet that this toolchain does not support yet.",
} as const

export type VoyantGraphDiagnosticCode = keyof typeof VOYANT_GRAPH_DIAGNOSTIC_CODE_REGISTRY

export interface VoyantGraphSourceLocation {
  file?: string
  line?: number
  column?: number
}

export interface VoyantGraphDiagnostic {
  code: VoyantGraphDiagnosticCode
  severity: VoyantGraphDiagnosticSeverity
  source?: string
  facet?: string
  location?: VoyantGraphSourceLocation
  message: string
  hint?: string
}

export interface VoyantGraphCapabilityDeclaration {
  capabilities?: readonly string[]
  ports?: readonly VoyantGraphPortDeclaration[]
}

export interface VoyantGraphPortDeclaration {
  id: string
  optional?: boolean
}

export interface VoyantGraphRouteBundle {
  id: string
  surface: VoyantGraphRouteSurface
  mount?: string
  resource?: string
  requiredScopes?: readonly string[]
  anonymous?: boolean | readonly string[]
}

export interface VoyantGraphFacetEntity {
  id: string
  source?: string
}

export interface VoyantGraphEvent extends VoyantGraphFacetEntity {
  eventType?: string
}

export interface VoyantGraphSubscriber extends VoyantGraphFacetEntity {
  eventType?: string
  eventFilterId?: string
  workflowId?: string
  filter?: VoyantGraphJsonObject
}

export interface VoyantGraphWorkflow extends VoyantGraphFacetEntity {
  config?: VoyantGraphJsonObject
  schedules?: readonly VoyantGraphWorkflowSchedule[]
}

export interface VoyantGraphWorkflowSchedule extends VoyantGraphFacetEntity {
  workflowId?: string
  cron?: string
  every?: string | number
  at?: string
  timezone?: string
  input?: VoyantGraphJsonValue
  enabled?: boolean
  overlap?: "skip" | "queue" | "allow"
  environments?: readonly ("production" | "preview" | "development")[]
  name?: string
}

export interface VoyantGraphScheduledJob {
  id: string
  cron: string
  description: string
  route: string
  module: string
  workflowId?: string
  input?: VoyantGraphJsonValue
}

export interface VoyantGraphUnitManifest {
  schemaVersion:
    | typeof VOYANT_GRAPH_MODULE_SCHEMA_VERSION
    | typeof VOYANT_GRAPH_PLUGIN_SCHEMA_VERSION
  id: string
  localId?: string
  packageName?: string
  provides?: VoyantGraphCapabilityDeclaration
  requires?: VoyantGraphCapabilityDeclaration
  api?: readonly VoyantGraphRouteBundle[]
  schema?: readonly VoyantGraphFacetEntity[]
  migrations?: readonly VoyantGraphFacetEntity[]
  links?: readonly VoyantGraphFacetEntity[]
  subscribers?: readonly VoyantGraphSubscriber[]
  events?: readonly VoyantGraphEvent[]
  workflows?: readonly VoyantGraphWorkflow[]
  meta?: VoyantGraphJsonObject
}

export type VoyantGraphJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly VoyantGraphJsonValue[]
  | { readonly [key: string]: VoyantGraphJsonValue }

export type VoyantGraphJsonObject = { readonly [key: string]: VoyantGraphJsonValue }

export interface DefineVoyantGraphUnitInput extends Omit<VoyantGraphUnitManifest, "schemaVersion"> {
  schemaVersion?: VoyantGraphUnitManifest["schemaVersion"]
}

export interface DefineVoyantGraphProjectInput {
  schemaVersion?: typeof VOYANT_GRAPH_PROJECT_SCHEMA_VERSION
  presetLineage?: string
  modules: readonly VoyantGraphUnitManifest[]
  plugins?: readonly VoyantGraphUnitManifest[]
  meta?: VoyantGraphJsonObject
}

export interface VoyantGraphProject {
  schemaVersion: typeof VOYANT_GRAPH_PROJECT_SCHEMA_VERSION
  presetLineage?: string
  modules: readonly VoyantGraphUnitManifest[]
  plugins: readonly VoyantGraphUnitManifest[]
  meta?: VoyantGraphJsonObject
}

export interface DefineVoyantGraphDeploymentInput {
  schemaVersion?: typeof VOYANT_GRAPH_DEPLOYMENT_SCHEMA_VERSION
  project: VoyantGraphProject
  target: string
  providers?: Partial<Record<VoyantProjectProviderRole | string, string>>
  mode?: VoyantProjectDeploymentMode
  requirements?: VoyantGraphDeploymentRequirements
  meta?: VoyantGraphJsonObject
}

export interface VoyantGraphDeploymentRequirements {
  resources: readonly VoyantProfileResourceRequirement[]
}

export interface VoyantGraphDeployment {
  schemaVersion: typeof VOYANT_GRAPH_DEPLOYMENT_SCHEMA_VERSION
  project: VoyantGraphProject
  target: string
  providers: Partial<Record<VoyantProjectProviderRole | string, string>>
  mode?: VoyantProjectDeploymentMode
  requirements: VoyantGraphDeploymentRequirements
  meta?: VoyantGraphJsonObject
}

export interface VoyantGraphPackageMetadata {
  schemaVersion: typeof VOYANT_GRAPH_PACKAGE_SCHEMA_VERSION
  kind: VoyantGraphPackageKind
  compatibleWith?: {
    framework?: string
    targets?: readonly string[]
    modes?: readonly VoyantProjectDeploymentMode[]
  }
  requires?: VoyantGraphCapabilityDeclaration
}

export interface VoyantGraphPackageRecord {
  packageName: string
  version?: string
  source: {
    kind: VoyantGraphPackageSourceKind
    reference?: string
    integrity?: string
  }
  metadata?: VoyantGraphPackageMetadata
}

export type VoyantPackageMetadata = VoyantGraphPackageMetadata

export interface VoyantGraphAdmissionPolicy {
  allowedSourceKinds?: readonly VoyantGraphPackageSourceKind[]
}

export interface ResolveDeploymentGraphInput {
  project: VoyantGraphProject
  deployment?: Omit<VoyantGraphDeployment, "project">
  packageRecords?: readonly VoyantGraphPackageRecord[]
  scheduledJobs?: readonly (ManagedScheduledJob | VoyantGraphScheduledJob)[]
  frameworkVersion?: string
  target?: string
  mode?: VoyantProjectDeploymentMode
  admission?: VoyantGraphAdmissionPolicy
}

export interface CreateTestDeploymentInput {
  modules: readonly VoyantGraphUnitManifest[]
  plugins?: readonly VoyantGraphUnitManifest[]
  target?: string
  mode?: VoyantProjectDeploymentMode
  packageRecords?: readonly VoyantGraphPackageRecord[]
}

export interface ResolvedVoyantGraphUnit {
  id: string
  kind: VoyantGraphUnitKind
  packageName: string
  localId?: string
  order: number
  provides: {
    capabilities: readonly string[]
    ports: readonly VoyantGraphPortDeclaration[]
  }
  requires: {
    capabilities: readonly string[]
    ports: readonly VoyantGraphPortDeclaration[]
  }
  api: readonly VoyantGraphRouteBundle[]
  schema: readonly VoyantGraphFacetEntity[]
  migrations: readonly VoyantGraphFacetEntity[]
  links: readonly VoyantGraphFacetEntity[]
  subscribers: readonly VoyantGraphSubscriber[]
  events: readonly VoyantGraphEvent[]
  workflows: readonly VoyantGraphWorkflow[]
}

export interface ResolvedVoyantDeploymentGraph {
  schemaVersion: typeof VOYANT_RESOLVED_GRAPH_SCHEMA_VERSION
  contentHash: string
  project: {
    presetLineage?: string
  }
  deployment: {
    target?: string
    mode?: VoyantProjectDeploymentMode
    providers: Partial<Record<VoyantProjectProviderRole | string, string>>
  }
  requirements: VoyantGraphDeploymentRequirements
  modules: readonly ResolvedVoyantGraphUnit[]
  plugins: readonly ResolvedVoyantGraphUnit[]
  capabilities: {
    provided: readonly string[]
    required: readonly string[]
  }
  packageRecords: readonly VoyantGraphPackageRecord[]
  provisioning: {
    scheduledJobs: readonly VoyantGraphScheduledJob[]
  }
  diagnostics: readonly VoyantGraphDiagnostic[]
}

export interface TestDeployment {
  graph: ResolvedVoyantDeploymentGraph
  doctor: {
    diagnostics: readonly VoyantGraphDiagnostic[]
    expectClean: () => void
  }
  migrations: {
    expectDeclared: (id: string) => void
    expectReplayParity: () => void
  }
  routes: {
    list: () => string[]
    expectMounted: (path: string) => void
  }
}

interface ParsedVersion {
  major: number
  minor: number
  patch: number
}

const SUPPORTED_GRAPH_UNIT_KEYS = new Set([
  "schemaVersion",
  "id",
  "localId",
  "packageName",
  "provides",
  "requires",
  "api",
  "schema",
  "migrations",
  "links",
  "subscribers",
  "events",
  "workflows",
  "meta",
])

const RESERVED_GRAPH_UNIT_KEYS = new Set<string>(VOYANT_GRAPH_RESERVED_FACETS)
const CAPABILITY_TOKEN_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/
const PORT_ID_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/
const GRAPH_ID_PATTERN =
  /^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*)(?:#[a-zA-Z0-9][a-zA-Z0-9._-]*)?$/
const ROUTE_RESOURCE_PATTERN = /^[a-z][a-z0-9-]*(?:[.-][a-z][a-z0-9-]*)*$/
const ROUTE_SCOPE_PATTERN =
  /^[a-z][a-z0-9-]*(?:[.-][a-z][a-z0-9-]*)*:[a-z][a-z0-9-]*(?:-[a-z][a-z0-9-]*)*$/
const STANDARD_CAPABILITY_PREFIXES = new Set([
  "action-ledger",
  "booking",
  "bookings",
  "catalog",
  "commerce",
  "distribution",
  "finance",
  "identity",
  "inventory",
  "legal",
  "operations",
  "quotes",
  "relationships",
  "storefront",
  "trips",
])

export function defineModule(input: DefineVoyantGraphUnitInput): VoyantGraphUnitManifest {
  return defineGraphUnit(VOYANT_GRAPH_MODULE_SCHEMA_VERSION, input)
}

export function definePlugin(input: DefineVoyantGraphUnitInput): VoyantGraphUnitManifest {
  return defineGraphUnit(VOYANT_GRAPH_PLUGIN_SCHEMA_VERSION, input)
}

export function defineProject(input: DefineVoyantGraphProjectInput): VoyantGraphProject {
  const project = {
    schemaVersion: input.schemaVersion ?? VOYANT_GRAPH_PROJECT_SCHEMA_VERSION,
    ...(input.presetLineage ? { presetLineage: input.presetLineage } : {}),
    modules: [...input.modules],
    plugins: [...(input.plugins ?? [])],
    ...(input.meta ? { meta: input.meta } : {}),
  } satisfies VoyantGraphProject

  if (project.schemaVersion !== VOYANT_GRAPH_PROJECT_SCHEMA_VERSION) {
    throw new Error(
      `defineProject: schemaVersion must be "${VOYANT_GRAPH_PROJECT_SCHEMA_VERSION}".`,
    )
  }
  return project
}

export function defineDeployment(input: DefineVoyantGraphDeploymentInput): VoyantGraphDeployment {
  const deployment = {
    schemaVersion: input.schemaVersion ?? VOYANT_GRAPH_DEPLOYMENT_SCHEMA_VERSION,
    project: input.project,
    target: input.target,
    providers: { ...(input.providers ?? {}) },
    ...(input.mode ? { mode: input.mode } : {}),
    requirements: normalizeDeploymentRequirements(
      input.requirements ?? deriveDeploymentRequirements(input.providers),
    ),
    ...(input.meta ? { meta: input.meta } : {}),
  } satisfies VoyantGraphDeployment

  if (deployment.schemaVersion !== VOYANT_GRAPH_DEPLOYMENT_SCHEMA_VERSION) {
    throw new Error(
      `defineDeployment: schemaVersion must be "${VOYANT_GRAPH_DEPLOYMENT_SCHEMA_VERSION}".`,
    )
  }
  return deployment
}

export function deriveDeploymentRequirements(
  providers: Partial<Record<VoyantProjectProviderRole | string, string>> = {},
): VoyantGraphDeploymentRequirements {
  return normalizeDeploymentRequirements({
    resources: PROVIDER_ROLES.flatMap((role) => {
      const provider = providers[role]
      return typeof provider === "string" && provider.trim().length > 0
        ? resourceRequirementsForProvider(role, provider)
        : []
    }),
  })
}

export function validateGraphUnitManifest(
  input: unknown,
  kind?: VoyantGraphUnitKind,
): VoyantGraphDiagnostic[] {
  if (!isRecord(input)) {
    return [
      diagnostic({
        code: "VOYANT_GRAPH_INVALID_SCHEMA_VERSION",
        message: "Graph unit manifest must be an object.",
      }),
    ]
  }

  const source = typeof input.id === "string" ? input.id : undefined
  const diagnostics: VoyantGraphDiagnostic[] = []
  const expectedSchema =
    kind === "plugin" ? VOYANT_GRAPH_PLUGIN_SCHEMA_VERSION : VOYANT_GRAPH_MODULE_SCHEMA_VERSION

  if (
    input.schemaVersion !== VOYANT_GRAPH_MODULE_SCHEMA_VERSION &&
    input.schemaVersion !== VOYANT_GRAPH_PLUGIN_SCHEMA_VERSION
  ) {
    diagnostics.push(
      diagnostic({
        code: "VOYANT_GRAPH_INVALID_SCHEMA_VERSION",
        source,
        facet: "schemaVersion",
        message: `schemaVersion must be "${VOYANT_GRAPH_MODULE_SCHEMA_VERSION}" or "${VOYANT_GRAPH_PLUGIN_SCHEMA_VERSION}".`,
      }),
    )
  } else if (kind && input.schemaVersion !== expectedSchema) {
    diagnostics.push(
      diagnostic({
        code: "VOYANT_GRAPH_INVALID_SCHEMA_VERSION",
        source,
        facet: "schemaVersion",
        message: `${kind} manifests must use schemaVersion "${expectedSchema}".`,
      }),
    )
  }

  for (const key of Object.keys(input).sort()) {
    if (SUPPORTED_GRAPH_UNIT_KEYS.has(key)) continue
    diagnostics.push(
      diagnostic({
        code: RESERVED_GRAPH_UNIT_KEYS.has(key)
          ? "VOYANT_GRAPH_UNSUPPORTED_FACET"
          : "VOYANT_GRAPH_UNKNOWN_FACET",
        source,
        facet: key,
        message: RESERVED_GRAPH_UNIT_KEYS.has(key)
          ? `Facet "${key}" is reserved for a later graph version and is not supported by this toolchain.`
          : `Unknown graph manifest facet "${key}".`,
        hint: RESERVED_GRAPH_UNIT_KEYS.has(key)
          ? "Remove the facet until the running Voyant toolchain supports it."
          : 'Move package-owned opaque data under "meta", or use a supported v1 facet.',
      }),
    )
  }

  if (typeof input.id !== "string" || !isCanonicalGraphId(input.id)) {
    diagnostics.push(
      diagnostic({
        code: "VOYANT_GRAPH_INVALID_ID",
        source,
        facet: "id",
        message: "Graph unit id must be a canonical package id with an optional package fragment.",
        hint: 'Use a package id such as "@acme/voyant-loyalty" or "@acme/voyant-suite#loyalty".',
      }),
    )
  }

  const packageName =
    typeof input.packageName === "string"
      ? input.packageName
      : typeof input.id === "string"
        ? packageNameFromGraphId(input.id)
        : undefined
  diagnostics.push(
    ...validateCapabilityDeclaration(input.provides, "provides", source, packageName),
  )
  diagnostics.push(
    ...validateCapabilityDeclaration(input.requires, "requires", source, packageName),
  )
  diagnostics.push(...validateRouteBundles(input.api, source))
  diagnostics.push(...validateFacetEntities(input.schema, "schema", source))
  diagnostics.push(...validateFacetEntities(input.migrations, "migrations", source))
  diagnostics.push(...validateFacetEntities(input.links, "links", source))
  diagnostics.push(...validateFacetEntities(input.subscribers, "subscribers", source))
  diagnostics.push(...validateFacetEntities(input.events, "events", source))
  diagnostics.push(...validateWorkflows(input.workflows, source))

  return sortDiagnostics(diagnostics)
}

export async function resolveDeploymentGraph(
  input: ResolveDeploymentGraphInput,
): Promise<ResolvedVoyantDeploymentGraph> {
  const target = input.target ?? input.deployment?.target
  const mode = input.mode ?? input.deployment?.mode
  const providers = { ...(input.deployment?.providers ?? {}) }
  const requirements = normalizeDeploymentRequirements(input.deployment?.requirements)
  const selectedModules = sortResolvedUnits(
    input.project.modules.map((unit) => resolveUnit(unit, "module")),
  )
  const selectedPlugins = sortResolvedUnits(
    input.project.plugins.map((unit) => resolveUnit(unit, "plugin")),
  )
  const selectedUnits = [...selectedModules, ...selectedPlugins]

  const packageRecords = mergePackageRecords(selectedUnits, input.packageRecords ?? [])
  const scheduledJobs = normalizeScheduledJobs([
    ...deriveWorkflowScheduledJobs(selectedUnits),
    ...(input.scheduledJobs ?? []),
  ])
  const diagnostics = sortDiagnostics([
    ...selectedUnits.flatMap((unit) => validateGraphUnitManifest(unit.original, unit.kind)),
    ...validateDuplicateGraphIds(selectedUnits),
    ...validateCapabilityClosure(selectedUnits),
    ...validatePortClosure(selectedUnits),
    ...validateDuplicateEntityIds(selectedUnits),
    ...validatePackageAdmission(packageRecords, {
      frameworkVersion: input.frameworkVersion,
      target,
      mode,
      admission: input.admission,
    }),
  ])

  const modules = selectedModules.map(({ original: _original, ...unit }) => unit)
  const plugins = selectedPlugins.map(({ original: _original, ...unit }) => unit)
  const graphWithoutHash: Omit<ResolvedVoyantDeploymentGraph, "contentHash"> = {
    schemaVersion: VOYANT_RESOLVED_GRAPH_SCHEMA_VERSION,
    project: {
      ...(input.project.presetLineage ? { presetLineage: input.project.presetLineage } : {}),
    },
    deployment: {
      ...(target ? { target } : {}),
      ...(mode ? { mode } : {}),
      providers,
    },
    requirements,
    modules,
    plugins,
    capabilities: {
      provided: sortedUnique(selectedUnits.flatMap((unit) => unit.provides.capabilities)),
      required: sortedUnique(selectedUnits.flatMap((unit) => unit.requires.capabilities)),
    },
    packageRecords,
    provisioning: {
      scheduledJobs,
    },
    diagnostics,
  }

  return {
    ...graphWithoutHash,
    contentHash: `sha256:${await sha256(graphWithoutHash)}`,
  }
}

export function defineProjectFromManagedProfile(
  project: VoyantProjectManifest,
): VoyantGraphProject {
  const bridge = toCreateVoyantAppProfileConfig(project)
  return defineProject({
    presetLineage: `${project.profile}-standard`,
    modules: [
      ...generateFrameworkModuleManifests(bridge.manifest.modules),
      ...generateCustomSourceModuleManifests(project.customSource?.modules),
    ],
    plugins: [
      ...generateFrameworkPluginManifests(bridge.manifest.extensions),
      ...generateCustomSourcePluginManifests(project.customSource?.extensions),
      ...project.plugins.map((specifier) =>
        definePlugin({
          id: graphIdFromSpecifier(specifier),
          packageName: packageNameFromSpecifier(specifier),
          localId: moduleIdFromSpecifier(specifier),
        }),
      ),
    ],
    meta: {
      compatibilityProfile: project.profile,
      managedProfileSchemaVersion: project.schemaVersion,
      frameworkVersion: project.frameworkVersion,
    },
  })
}

export function defineDeploymentFromManagedProfile(
  project: VoyantProjectManifest,
): VoyantGraphDeployment {
  const providers = getVoyantProjectProviders(project)
  return defineDeployment({
    project: defineProjectFromManagedProfile(project),
    target: project.mode === "managed-cloud" ? "voyant-cloud" : "node",
    mode: project.mode,
    providers: { ...providers },
    meta: {
      compatibilityProfile: project.profile,
      frameworkVersion: project.frameworkVersion,
    },
  })
}

export async function resolveManagedProfileDeploymentGraph(
  project: VoyantProjectManifest,
  options: Omit<ResolveDeploymentGraphInput, "project" | "deployment"> = {},
): Promise<ResolvedVoyantDeploymentGraph> {
  const deployment = defineDeploymentFromManagedProfile(project)
  return resolveDeploymentGraph({
    ...options,
    project: deployment.project,
    deployment,
    packageRecords:
      options.packageRecords ??
      generateWorkspacePackageRecords(deployment.project, project.frameworkVersion),
    scheduledJobs: options.scheduledJobs ?? getManagedProfileScheduledJobs(project),
    frameworkVersion: options.frameworkVersion ?? project.frameworkVersion,
    target: options.target ?? deployment.target,
    mode: options.mode ?? deployment.mode,
  })
}

export async function createTestDeployment(
  input: CreateTestDeploymentInput,
): Promise<TestDeployment> {
  const project = defineProject({
    modules: input.modules,
    plugins: input.plugins ?? [],
  })
  const graph = await resolveDeploymentGraph({
    project,
    target: input.target ?? "node",
    mode: input.mode ?? "self-hosted",
    packageRecords: input.packageRecords,
  })

  return {
    graph,
    doctor: {
      diagnostics: graph.diagnostics,
      expectClean: () => {
        assert(
          graph.diagnostics.length === 0,
          `Expected deployment graph to be clean, got diagnostics:\n${formatDiagnostics(
            graph.diagnostics,
          )}`,
        )
      },
    },
    migrations: {
      expectDeclared: (id: string) => {
        const ids = graph.modules
          .flatMap((unit) => unit.migrations)
          .concat(graph.plugins.flatMap((unit) => unit.migrations))
          .map((migration) => migration.id)
        assert(ids.includes(id), `Expected deployment graph to include migration "${id}".`)
      },
      expectReplayParity: () => {
        const migrationIds = graph.modules
          .flatMap((unit) => unit.migrations)
          .concat(graph.plugins.flatMap((unit) => unit.migrations))
          .map((migration) => migration.id)
        const uniqueIds = new Set(migrationIds)
        assert(
          uniqueIds.size === migrationIds.length,
          "Expected deployment graph migrations to have unique stable ids.",
        )
      },
    },
    routes: {
      list: () => routePaths(graph),
      expectMounted: (path: string) => {
        const mounted = routePaths(graph)
        assert(
          mounted.includes(path),
          `Expected route "${path}" to be mounted. Mounted routes: ${mounted.join(", ") || "(none)"}`,
        )
      },
    },
  }
}

export function generateFrameworkModuleManifests(
  specifiers: readonly string[] = subsetStandardManifest().modules,
): VoyantGraphUnitManifest[] {
  return specifiers.map((specifier) => {
    const id = graphIdFromSpecifier(specifier)
    const capabilities = (
      FRAMEWORK_CAPABILITY_GRAPH as Record<
        string,
        { provides?: readonly string[]; requires?: readonly string[] }
      >
    )[specifier]
    return defineModule({
      id,
      packageName: packageNameFromSpecifier(specifier),
      localId: moduleIdFromSpecifier(specifier),
      provides: normalizeCapabilities(capabilities?.provides),
      requires: normalizeCapabilities(capabilities?.requires),
      api: [
        {
          id: childGraphEntityId(id, "api"),
          surface: "admin",
          mount: specifier,
        },
      ],
      workflows: lowerManagedWorkflowFacets(specifier),
      events: lowerManagedEventFacets(id, specifier),
      subscribers: lowerManagedEventFilterFacets(id, specifier),
    })
  })
}

export function generateFrameworkPluginManifests(
  specifiers: readonly string[] = subsetStandardManifest().extensions,
): VoyantGraphUnitManifest[] {
  const moduleIds = new Set(FRAMEWORK_RUNTIME_MANIFEST.modules.map(graphIdFromSpecifier))
  return specifiers.map((specifier) => {
    const baseId = graphIdFromSpecifier(specifier)
    const id = moduleIds.has(baseId) ? childGraphEntityId(baseId, "extension") : baseId
    return definePlugin({
      id,
      packageName: packageNameFromSpecifier(specifier),
      localId: moduleIdFromSpecifier(specifier),
      api: [
        {
          id: childGraphEntityId(id, "api"),
          surface: "admin",
          mount: specifier,
        },
      ],
    })
  })
}

export function generateCustomSourceModuleManifests(
  specifiers: readonly string[] = [],
): VoyantGraphUnitManifest[] {
  return validCustomSourceSpecifiers(specifiers).map((specifier) =>
    defineModule({
      id: graphIdFromSpecifier(specifier),
      packageName: packageNameFromSpecifier(specifier),
      localId: moduleIdFromSpecifier(specifier),
      meta: { source: "managed-custom-source" },
    }),
  )
}

export function generateCustomSourcePluginManifests(
  specifiers: readonly string[] = [],
): VoyantGraphUnitManifest[] {
  return validCustomSourceSpecifiers(specifiers).map((specifier) =>
    definePlugin({
      id: graphIdFromSpecifier(specifier),
      packageName: packageNameFromSpecifier(specifier),
      localId: moduleIdFromSpecifier(specifier),
      meta: { source: "managed-custom-source" },
    }),
  )
}

export function graphIdFromSpecifier(specifier: string): string {
  const { packageName, subpath } = splitPackageSpecifier(specifier)
  if (!subpath) return packageName
  return `${packageName}#${subpath.replaceAll("/", ".")}`
}

export function packageNameFromSpecifier(specifier: string): string {
  return SPECIFIER_PACKAGE_OWNERS[specifier] ?? splitPackageSpecifier(specifier).packageName
}

export function childGraphEntityId(parentId: string, childId: string): string {
  return parentId.includes("#") ? `${parentId}.${childId}` : `${parentId}#${childId}`
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

function toGraphJsonObject(value: unknown): VoyantGraphJsonObject | undefined {
  if (!isRecord(value)) return undefined
  return JSON.parse(JSON.stringify(value)) as VoyantGraphJsonObject
}

function toGraphJsonValue(value: unknown): VoyantGraphJsonValue | undefined {
  if (value === undefined || typeof value === "function") return undefined
  const text = JSON.stringify(value)
  if (text === undefined) return undefined
  return JSON.parse(text) as VoyantGraphJsonValue
}

export async function sha256(value: unknown): Promise<string> {
  const text = canonicalJson(value)
  const bytes = new TextEncoder().encode(text)
  const digest = await getCrypto().subtle.digest("SHA-256", bytes)
  return bytesToHex(new Uint8Array(digest))
}

function normalizeDeploymentRequirements(
  requirements: VoyantGraphDeploymentRequirements | undefined,
): VoyantGraphDeploymentRequirements {
  return {
    resources: [...(requirements?.resources ?? [])]
      .map(normalizeResourceRequirement)
      .sort(compareResourceRequirements),
  }
}

function normalizeResourceRequirement(
  requirement: VoyantProfileResourceRequirement,
): VoyantProfileResourceRequirement {
  return {
    resourceKey: requirement.resourceKey,
    roles: [...requirement.roles].sort(),
    provider: requirement.provider,
    required: requirement.required,
    env: [...requirement.env].sort(compareEnvRequirements).map((env) => ({
      name: env.name,
      ...(env.aliases?.length ? { aliases: [...env.aliases].sort() } : {}),
      ...(env.format ? { format: env.format } : {}),
      kind: env.kind,
      required: env.required,
      description: env.description,
    })),
    ...(requirement.notes ? { notes: requirement.notes } : {}),
  }
}

function normalizeScheduledJobs(
  jobs: readonly (ManagedScheduledJob | VoyantGraphScheduledJob)[],
): VoyantGraphScheduledJob[] {
  return jobs
    .map((job) => ({
      id: job.id,
      cron: job.cron,
      description: job.description,
      route: job.route,
      module: job.module,
      ...("workflowId" in job && job.workflowId ? { workflowId: job.workflowId } : {}),
      ...("input" in job && job.input !== undefined ? { input: job.input } : {}),
    }))
    .sort((left, right) => left.id.localeCompare(right.id))
}

function deriveWorkflowScheduledJobs(
  units: readonly (ResolvedVoyantGraphUnit & { original: VoyantGraphUnitManifest })[],
): VoyantGraphScheduledJob[] {
  return units.flatMap((unit) =>
    unit.workflows.flatMap((workflow) =>
      (workflow.schedules ?? []).flatMap((schedule) => {
        if (schedule.enabled === false || !schedule.cron) return []
        return [
          {
            id: schedule.id,
            cron: schedule.cron,
            description: `Triggers workflow ${workflow.id} from graph schedule ${schedule.id}.`,
            route: SCHEDULED_JOB_ROUTE,
            module: unit.localId ?? unit.id,
            workflowId: workflow.id,
            ...(schedule.input !== undefined ? { input: schedule.input } : {}),
          },
        ]
      }),
    ),
  )
}

function compareEnvRequirements(
  left: VoyantProfileEnvRequirement,
  right: VoyantProfileEnvRequirement,
): number {
  return (
    left.name.localeCompare(right.name) ||
    left.kind.localeCompare(right.kind) ||
    Number(left.required) - Number(right.required) ||
    (left.aliases ?? []).join(",").localeCompare((right.aliases ?? []).join(",")) ||
    (left.format ?? "").localeCompare(right.format ?? "") ||
    left.description.localeCompare(right.description)
  )
}

function compareResourceRequirements(
  left: VoyantProfileResourceRequirement,
  right: VoyantProfileResourceRequirement,
): number {
  return (
    left.resourceKey.localeCompare(right.resourceKey) ||
    left.provider.localeCompare(right.provider) ||
    Number(left.required) - Number(right.required) ||
    left.roles.join(",").localeCompare(right.roles.join(","))
  )
}

function defineGraphUnit(
  schemaVersion: VoyantGraphUnitManifest["schemaVersion"],
  input: DefineVoyantGraphUnitInput,
): VoyantGraphUnitManifest {
  const unit = {
    ...input,
    schemaVersion: input.schemaVersion ?? schemaVersion,
  } satisfies VoyantGraphUnitManifest
  const kind = schemaVersion === VOYANT_GRAPH_PLUGIN_SCHEMA_VERSION ? "plugin" : "module"
  const diagnostics = validateGraphUnitManifest(unit, kind)
  const errors = diagnostics.filter((entry) => entry.severity === "error")
  if (errors.length > 0) {
    throw new Error(
      `${kind === "plugin" ? "definePlugin" : "defineModule"}: ${errors
        .map((entry) => `${entry.code}: ${entry.message}`)
        .join("; ")}`,
    )
  }
  return unit
}

function resolveUnit(
  unit: VoyantGraphUnitManifest,
  kind: VoyantGraphUnitKind,
): ResolvedVoyantGraphUnit & { original: VoyantGraphUnitManifest } {
  const packageName = unit.packageName ?? packageNameFromGraphId(unit.id)
  return {
    original: unit,
    id: unit.id,
    kind,
    packageName,
    ...(unit.localId ? { localId: unit.localId } : {}),
    order: 0,
    provides: {
      capabilities: sortedUnique(unit.provides?.capabilities ?? []),
      ports: sortPorts(unit.provides?.ports ?? []),
    },
    requires: {
      capabilities: sortedUnique(unit.requires?.capabilities ?? []),
      ports: sortPorts(unit.requires?.ports ?? []),
    },
    api: sortFacetEntities(unit.api ?? []) as VoyantGraphRouteBundle[],
    schema: sortFacetEntities(unit.schema ?? []),
    migrations: sortFacetEntities(unit.migrations ?? []),
    links: sortFacetEntities(unit.links ?? []),
    subscribers: sortFacetEntities(unit.subscribers ?? []) as VoyantGraphSubscriber[],
    events: sortFacetEntities(unit.events ?? []) as VoyantGraphEvent[],
    workflows: sortWorkflows(normalizeWorkflowScheduleFacets(unit.id, unit.workflows ?? [])),
  }
}

function sortResolvedUnits<
  T extends ResolvedVoyantGraphUnit & { original: VoyantGraphUnitManifest },
>(units: readonly T[]): T[] {
  return [...units]
    .sort(
      (left, right) =>
        left.id.localeCompare(right.id) ||
        left.kind.localeCompare(right.kind) ||
        left.packageName.localeCompare(right.packageName),
    )
    .map((unit, index) => ({ ...unit, order: index }))
}

function lowerManagedWorkflowFacets(moduleSpecifier: string): VoyantGraphWorkflow[] {
  return getStandardProfileWorkflowManifestForModule(moduleSpecifier).map((workflow) =>
    lowerManagedWorkflowFacet(workflow),
  )
}

function lowerManagedWorkflowFacet(workflow: ManagedWorkflowManifestEntry): VoyantGraphWorkflow {
  const config = toGraphJsonObject(workflow.config)
  return {
    id: workflow.id,
    ...(config ? { config } : {}),
  }
}

function normalizeWorkflowScheduleFacets(
  unitId: string,
  workflows: readonly VoyantGraphWorkflow[],
): VoyantGraphWorkflow[] {
  return workflows.map((workflow) => {
    const declared = workflow.schedules ?? []
    const lowered =
      isRecord(workflow.config) && workflow.config.schedule !== undefined
        ? lowerWorkflowScheduleFacets(unitId, workflow.id, workflow.config.schedule)
        : []
    return lowered.length > 0 ? { ...workflow, schedules: [...declared, ...lowered] } : workflow
  })
}

function lowerWorkflowScheduleFacets(
  unitId: string,
  workflowId: string,
  value: unknown,
): VoyantGraphWorkflowSchedule[] {
  const schedules = Array.isArray(value) ? value : [value]
  return schedules.flatMap((schedule, index) => {
    const lowered = lowerWorkflowScheduleFacet(unitId, workflowId, schedule, index)
    return lowered ? [lowered] : []
  })
}

function lowerWorkflowScheduleFacet(
  unitId: string,
  workflowId: string,
  value: unknown,
  index: number,
): VoyantGraphWorkflowSchedule | undefined {
  if (!isRecord(value)) return undefined
  const input = typeof value.input === "function" ? undefined : toGraphJsonValue(value.input)
  const environments = normalizeScheduleEnvironments(value.environments)
  return {
    id: childGraphEntityId(unitId, `schedule.${workflowId}.${scheduleEntityKey(value, index)}`),
    workflowId,
    ...(typeof value.cron === "string" ? { cron: value.cron } : {}),
    ...(typeof value.every === "string" || typeof value.every === "number"
      ? { every: value.every }
      : {}),
    ...(typeof value.at === "string"
      ? { at: value.at }
      : value.at instanceof Date
        ? { at: value.at.toISOString() }
        : {}),
    ...(typeof value.timezone === "string" ? { timezone: value.timezone } : {}),
    ...(input !== undefined ? { input } : {}),
    ...(typeof value.enabled === "boolean" ? { enabled: value.enabled } : {}),
    ...(value.overlap === "skip" || value.overlap === "queue" || value.overlap === "allow"
      ? { overlap: value.overlap }
      : {}),
    ...(environments.length > 0 ? { environments } : {}),
    ...(typeof value.name === "string" ? { name: value.name } : {}),
  }
}

function scheduleEntityKey(value: Record<string, unknown>, index: number): string {
  if (typeof value.name === "string" && isGraphEntityIdSegment(value.name)) return value.name
  return `schedule-${index + 1}`
}

function normalizeScheduleEnvironments(
  value: unknown,
): Array<"production" | "preview" | "development"> {
  if (!Array.isArray(value)) return []
  return value.filter(
    (entry): entry is "production" | "preview" | "development" =>
      entry === "production" || entry === "preview" || entry === "development",
  )
}

function lowerManagedEventFacets(unitId: string, moduleSpecifier: string): VoyantGraphEvent[] {
  const eventTypes = sortedUnique(
    getStandardProfileEventFiltersForModule(moduleSpecifier).map((filter) => filter.eventType),
  )
  return eventTypes.map((eventType) => ({
    id: childGraphEntityId(unitId, `event.${eventType}`),
    eventType,
  }))
}

function lowerManagedEventFilterFacets(
  unitId: string,
  moduleSpecifier: string,
): VoyantGraphSubscriber[] {
  return getStandardProfileEventFiltersForModule(moduleSpecifier).map((filter) =>
    lowerManagedEventFilterFacet(unitId, filter),
  )
}

function lowerManagedEventFilterFacet(
  unitId: string,
  filter: ManagedEventFilterEntry,
): VoyantGraphSubscriber {
  const manifest = toGraphJsonObject(filter.manifest)
  const workflowId = manifest?.targetWorkflowId
  return {
    id: childGraphEntityId(unitId, `subscriber.${filter.id}`),
    eventType: filter.eventType,
    eventFilterId: filter.id,
    ...(typeof workflowId === "string" ? { workflowId } : {}),
    ...(manifest ? { filter: manifest } : {}),
  }
}

function validateCapabilityDeclaration(
  value: unknown,
  facet: "provides" | "requires",
  source: string | undefined,
  packageName: string | undefined,
): VoyantGraphDiagnostic[] {
  if (!isRecord(value)) return []
  const capabilities = value.capabilities
  const diagnostics: VoyantGraphDiagnostic[] = []
  if (Array.isArray(capabilities)) {
    for (const token of capabilities) {
      if (typeof token !== "string" || !CAPABILITY_TOKEN_PATTERN.test(token)) {
        diagnostics.push(
          diagnostic({
            code: "VOYANT_GRAPH_INVALID_CAPABILITY_TOKEN",
            source,
            facet: `${facet}.capabilities`,
            message: `Capability token "${String(token)}" must use dot-case namespace segments.`,
            hint: 'Use a token such as "identity.people" or "acme.loyalty.points".',
          }),
        )
        continue
      }

      if (!isFirstPartyPackage(packageName) && usesReservedCapabilityNamespace(token)) {
        diagnostics.push(
          diagnostic({
            code: "VOYANT_GRAPH_INVALID_CAPABILITY_TOKEN",
            source,
            facet: `${facet}.capabilities`,
            message: `Capability token "${token}" uses a Voyant-reserved namespace.`,
            hint: 'Third-party packages should prefix capabilities with a namespace they control, such as "acme.loyalty.points".',
          }),
        )
      }
    }
  }

  const ports = value.ports
  if (ports === undefined) return diagnostics
  if (!Array.isArray(ports)) {
    diagnostics.push(
      diagnostic({
        code: "VOYANT_GRAPH_INVALID_ENTITY_ID",
        source,
        facet: `${facet}.ports`,
        message: "Port declarations must be an array with stable dot-case ids.",
      }),
    )
    return diagnostics
  }
  for (let index = 0; index < ports.length; index += 1) {
    const port = ports[index]
    if (!isRecord(port) || typeof port.id !== "string" || !PORT_ID_PATTERN.test(port.id)) {
      diagnostics.push(
        diagnostic({
          code: "VOYANT_GRAPH_INVALID_ENTITY_ID",
          source,
          facet: `${facet}.ports[${index}]`,
          message: "Port declarations must include a stable dot-case id.",
        }),
      )
      continue
    }
    if (port.optional !== undefined && typeof port.optional !== "boolean") {
      diagnostics.push(
        diagnostic({
          code: "VOYANT_GRAPH_INVALID_ENTITY_ID",
          source,
          facet: `${facet}.ports[${index}].optional`,
          message: "Port declaration optional must be a boolean when provided.",
        }),
      )
    }
  }
  return diagnostics
}

function validateFacetEntities(
  value: unknown,
  facet: string,
  source: string | undefined,
): VoyantGraphDiagnostic[] {
  if (value == null) return []
  if (!Array.isArray(value)) {
    return [
      diagnostic({
        code: "VOYANT_GRAPH_INVALID_ENTITY_ID",
        source,
        facet,
        message: `Facet "${facet}" must be an array of entities with stable id fields.`,
      }),
    ]
  }

  return value.flatMap((entry, index) => validateEntityId(entry, `${facet}[${index}]`, source))
}

function validateRouteBundles(value: unknown, source: string | undefined): VoyantGraphDiagnostic[] {
  const diagnostics = validateFacetEntities(value, "api", source)
  if (value == null || !Array.isArray(value)) return diagnostics

  for (let index = 0; index < value.length; index += 1) {
    const route = value[index]
    const facet = `api[${index}]`
    if (!isRecord(route)) continue

    if (!isRouteSurface(route.surface)) {
      diagnostics.push(
        diagnostic({
          code: "VOYANT_GRAPH_INVALID_ROUTE_BUNDLE",
          source,
          facet: `${facet}.surface`,
          message: `Route bundle "${route.id ?? index}" must declare surface as admin, public, webhook, or internal.`,
        }),
      )
    }

    if (
      route.mount !== undefined &&
      (typeof route.mount !== "string" || route.mount.length === 0)
    ) {
      diagnostics.push(
        diagnostic({
          code: "VOYANT_GRAPH_INVALID_ROUTE_BUNDLE",
          source,
          facet: `${facet}.mount`,
          message: `Route bundle "${route.id ?? index}" mount must be a non-empty string when present.`,
        }),
      )
    }

    if (
      route.resource !== undefined &&
      (typeof route.resource !== "string" || !ROUTE_RESOURCE_PATTERN.test(route.resource))
    ) {
      diagnostics.push(
        diagnostic({
          code: "VOYANT_GRAPH_INVALID_ROUTE_BUNDLE",
          source,
          facet: `${facet}.resource`,
          message: `Route bundle "${route.id ?? index}" resource must use dot/hyphen namespace syntax.`,
        }),
      )
    }

    if (route.requiredScopes !== undefined) {
      if (!Array.isArray(route.requiredScopes)) {
        diagnostics.push(
          diagnostic({
            code: "VOYANT_GRAPH_INVALID_ROUTE_BUNDLE",
            source,
            facet: `${facet}.requiredScopes`,
            message: `Route bundle "${route.id ?? index}" requiredScopes must be an array of resource:action strings.`,
          }),
        )
      } else {
        for (let scopeIndex = 0; scopeIndex < route.requiredScopes.length; scopeIndex += 1) {
          const scope = route.requiredScopes[scopeIndex]
          if (typeof scope === "string" && ROUTE_SCOPE_PATTERN.test(scope)) continue
          diagnostics.push(
            diagnostic({
              code: "VOYANT_GRAPH_INVALID_SCOPE",
              source,
              facet: `${facet}.requiredScopes[${scopeIndex}]`,
              message: `Route bundle "${route.id ?? index}" required scope "${String(
                scope,
              )}" must use resource:action syntax.`,
            }),
          )
        }
      }
    }

    if (
      route.anonymous !== undefined &&
      typeof route.anonymous !== "boolean" &&
      !isStringArray(route.anonymous)
    ) {
      diagnostics.push(
        diagnostic({
          code: "VOYANT_GRAPH_INVALID_ROUTE_BUNDLE",
          source,
          facet: `${facet}.anonymous`,
          message: `Route bundle "${route.id ?? index}" anonymous metadata must be a boolean or string array.`,
        }),
      )
    }
  }

  return diagnostics
}

function isRouteSurface(value: unknown): value is VoyantGraphRouteSurface {
  return value === "admin" || value === "public" || value === "webhook" || value === "internal"
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
}

function validateWorkflows(value: unknown, source: string | undefined): VoyantGraphDiagnostic[] {
  const diagnostics = validateFacetEntities(value, "workflows", source)
  if (!Array.isArray(value)) return diagnostics
  for (let workflowIndex = 0; workflowIndex < value.length; workflowIndex++) {
    const workflow = value[workflowIndex]
    if (!isRecord(workflow) || !Array.isArray(workflow.schedules)) continue
    for (let scheduleIndex = 0; scheduleIndex < workflow.schedules.length; scheduleIndex++) {
      diagnostics.push(
        ...validateEntityId(
          workflow.schedules[scheduleIndex],
          `workflows[${workflowIndex}].schedules[${scheduleIndex}]`,
          source,
        ),
      )
    }
  }
  return diagnostics
}

function validateEntityId(
  value: unknown,
  facet: string,
  source: string | undefined,
): VoyantGraphDiagnostic[] {
  if (!isRecord(value) || typeof value.id !== "string" || value.id.trim().length === 0) {
    return [
      diagnostic({
        code: "VOYANT_GRAPH_INVALID_ENTITY_ID",
        source,
        facet,
        message: `Graph entity at "${facet}" must include a stable string id.`,
      }),
    ]
  }
  return []
}

function validateDuplicateGraphIds(
  units: readonly (ResolvedVoyantGraphUnit & { original: VoyantGraphUnitManifest })[],
): VoyantGraphDiagnostic[] {
  const byId = new Map<string, string[]>()
  for (const unit of units) {
    const ids = byId.get(unit.id) ?? []
    ids.push(unit.kind)
    byId.set(unit.id, ids)
  }
  return [...byId.entries()]
    .filter(([, kinds]) => kinds.length > 1)
    .map(([id]) =>
      diagnostic({
        code: "VOYANT_GRAPH_DUPLICATE_ID",
        source: id,
        facet: "id",
        message: `Graph id "${id}" is selected more than once. V1 allows one instance per graph id.`,
      }),
    )
}

function validateCapabilityClosure(
  units: readonly (ResolvedVoyantGraphUnit & { original: VoyantGraphUnitManifest })[],
): VoyantGraphDiagnostic[] {
  const providers = new Set(units.flatMap((unit) => unit.provides.capabilities))
  const diagnostics: VoyantGraphDiagnostic[] = []
  for (const unit of units) {
    for (const capability of unit.requires.capabilities) {
      if (providers.has(capability)) continue
      diagnostics.push(
        diagnostic({
          code: "VOYANT_GRAPH_MISSING_CAPABILITY",
          source: unit.id,
          facet: "requires.capabilities",
          message: `Required capability ${capability} is not provided by the selected graph.`,
          hint: "Select a module or plugin that provides the required capability.",
        }),
      )
    }
  }
  return diagnostics
}

function validatePortClosure(
  units: readonly (ResolvedVoyantGraphUnit & { original: VoyantGraphUnitManifest })[],
): VoyantGraphDiagnostic[] {
  const providers = new Set(units.flatMap((unit) => unit.provides.ports.map((port) => port.id)))
  const diagnostics: VoyantGraphDiagnostic[] = []
  for (const unit of units) {
    for (const port of unit.requires.ports) {
      if (port.optional || providers.has(port.id)) continue
      diagnostics.push(
        diagnostic({
          code: "VOYANT_GRAPH_MISSING_PORT",
          source: unit.id,
          facet: "requires.ports",
          message: `Required port ${port.id} is not provided by the selected graph.`,
          hint: "Select a module or plugin that provides the required port.",
        }),
      )
    }
  }
  return diagnostics
}

function validateDuplicateEntityIds(
  units: readonly (ResolvedVoyantGraphUnit & { original: VoyantGraphUnitManifest })[],
): VoyantGraphDiagnostic[] {
  const owners = new Map<string, string[]>()
  for (const unit of units) {
    for (const id of unitEntityIds(unit)) {
      const seen = owners.get(id) ?? []
      seen.push(unit.id)
      owners.set(id, seen)
    }
  }

  return [...owners.entries()]
    .filter(([, unitIds]) => unitIds.length > 1)
    .map(([id, unitIds]) =>
      diagnostic({
        code: "VOYANT_GRAPH_DUPLICATE_ENTITY_ID",
        source: sortedUnique(unitIds).join(", "),
        message: `Graph entity id "${id}" is declared more than once.`,
      }),
    )
}

function validatePackageAdmission(
  packageRecords: readonly VoyantGraphPackageRecord[],
  context: {
    frameworkVersion?: string
    target?: string
    mode?: VoyantProjectDeploymentMode
    admission?: VoyantGraphAdmissionPolicy
  },
): VoyantGraphDiagnostic[] {
  const diagnostics: VoyantGraphDiagnostic[] = []
  const allowedSources = context.admission?.allowedSourceKinds
    ? new Set(context.admission.allowedSourceKinds)
    : undefined

  for (const record of packageRecords) {
    if (allowedSources && !allowedSources.has(record.source.kind)) {
      diagnostics.push(
        diagnostic({
          code: "VOYANT_GRAPH_PACKAGE_SOURCE_UNADMITTED",
          source: record.packageName,
          facet: "package.source",
          message: `Package "${record.packageName}" is sourced from "${record.source.kind}", which is not admitted by policy.`,
        }),
      )
    }

    const compatibleWith = record.metadata?.compatibleWith
    if (
      context.frameworkVersion &&
      compatibleWith?.framework &&
      !isFrameworkVersionCompatible(context.frameworkVersion, compatibleWith.framework)
    ) {
      diagnostics.push(
        diagnostic({
          code: "VOYANT_GRAPH_PACKAGE_INCOMPATIBLE",
          source: record.packageName,
          facet: "package.compatibleWith.framework",
          message: `Package "${record.packageName}" is not compatible with framework version "${context.frameworkVersion}".`,
        }),
      )
    }
    if (
      context.target &&
      compatibleWith?.targets &&
      !compatibleWith.targets.includes(context.target)
    ) {
      diagnostics.push(
        diagnostic({
          code: "VOYANT_GRAPH_PACKAGE_INCOMPATIBLE",
          source: record.packageName,
          facet: "package.compatibleWith.targets",
          message: `Package "${record.packageName}" is not compatible with target "${context.target}".`,
        }),
      )
    }
    if (context.mode && compatibleWith?.modes && !compatibleWith.modes.includes(context.mode)) {
      diagnostics.push(
        diagnostic({
          code: "VOYANT_GRAPH_PACKAGE_INCOMPATIBLE",
          source: record.packageName,
          facet: "package.compatibleWith.modes",
          message: `Package "${record.packageName}" is not compatible with deployment mode "${context.mode}".`,
        }),
      )
    }
  }
  return diagnostics
}

function isFrameworkVersionCompatible(version: string, range: string): boolean {
  const parsedVersion = parseVersion(version)
  if (!parsedVersion) return version === range
  const clauses = range
    .split("||")
    .map((clause) => clause.trim())
    .filter(Boolean)
  for (const clause of clauses) {
    const tokens = clause.split(/\s+/).filter(Boolean)
    if (tokens.every((token) => satisfiesVersionConstraint(parsedVersion, token))) return true
  }
  return false
}

function satisfiesVersionConstraint(version: ParsedVersion, token: string): boolean {
  const normalized = token.trim()
  if (normalized === "*" || normalized.toLowerCase() === "x") return true
  if (normalized.startsWith("^")) return satisfiesCaret(version, normalized.slice(1))
  if (normalized.startsWith("~")) return satisfiesTilde(version, normalized.slice(1))

  for (const operator of [">=", "<=", ">", "<"] as const) {
    if (!normalized.startsWith(operator)) continue
    const target = parseVersion(normalized.slice(operator.length))
    if (!target) return false
    const comparison = compareVersions(version, target)
    if (operator === ">=") return comparison >= 0
    if (operator === "<=") return comparison <= 0
    if (operator === ">") return comparison > 0
    return comparison < 0
  }

  const targetText = normalized.startsWith("=") ? normalized.slice(1) : normalized
  if (isWildcardVersion(targetText)) return satisfiesWildcard(version, targetText)

  const target = parseVersion(targetText)
  if (!target) return false
  return compareVersions(version, target) === 0
}

function satisfiesCaret(version: ParsedVersion, targetText: string): boolean {
  const target = parseVersion(targetText)
  if (!target || compareVersions(version, target) < 0) return false
  if (target.major > 0) {
    return compareVersions(version, { major: target.major + 1, minor: 0, patch: 0 }) < 0
  }
  if (target.minor > 0) {
    return compareVersions(version, { major: 0, minor: target.minor + 1, patch: 0 }) < 0
  }
  return compareVersions(version, { major: 0, minor: 0, patch: target.patch + 1 }) < 0
}

function satisfiesTilde(version: ParsedVersion, targetText: string): boolean {
  const target = parseVersion(targetText)
  if (!target) return false
  return (
    compareVersions(version, target) >= 0 &&
    compareVersions(version, { major: target.major, minor: target.minor + 1, patch: 0 }) < 0
  )
}

function isWildcardVersion(value: string): boolean {
  return /^(?:\d+|x|\*)(?:\.(?:\d+|x|\*)){0,2}$/i.test(value)
}

function satisfiesWildcard(version: ParsedVersion, targetText: string): boolean {
  const [major, minor, patch] = targetText.split(".")
  if (!matchesVersionPart(version.major, major)) return false
  if (minor == null) return true
  if (!matchesVersionPart(version.minor, minor)) return false
  if (patch == null) return true
  return matchesVersionPart(version.patch, patch)
}

function matchesVersionPart(actual: number, expected: string | undefined): boolean {
  return expected == null || expected === "*" || expected.toLowerCase() === "x"
    ? true
    : actual === Number(expected)
}

function parseVersion(value: string): ParsedVersion | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(value.trim())
  if (!match) return null
  return {
    major: Number(match[1] ?? 0),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0),
  }
}

function compareVersions(left: ParsedVersion, right: ParsedVersion): number {
  if (left.major !== right.major) return left.major - right.major
  if (left.minor !== right.minor) return left.minor - right.minor
  return left.patch - right.patch
}

function unitEntityIds(unit: ResolvedVoyantGraphUnit): string[] {
  return [
    ...unit.api.map((entry) => entry.id),
    ...unit.schema.map((entry) => entry.id),
    ...unit.migrations.map((entry) => entry.id),
    ...unit.links.map((entry) => entry.id),
    ...unit.subscribers.map((entry) => entry.id),
    ...unit.events.map((entry) => entry.id),
    ...unit.workflows.flatMap((entry) => [
      entry.id,
      ...(entry.schedules ?? []).map((schedule) => schedule.id),
    ]),
  ]
}

function mergePackageRecords(
  units: readonly (ResolvedVoyantGraphUnit & { original: VoyantGraphUnitManifest })[],
  input: readonly VoyantGraphPackageRecord[],
): VoyantGraphPackageRecord[] {
  const records = new Map<string, VoyantGraphPackageRecord>()
  for (const unit of units) {
    records.set(unit.packageName, {
      packageName: unit.packageName,
      source: { kind: "unknown" },
    })
  }
  for (const record of input) {
    records.set(record.packageName, normalizePackageRecord(record))
  }
  return [...records.values()].sort((a, b) => a.packageName.localeCompare(b.packageName))
}

function generateWorkspacePackageRecords(
  project: VoyantGraphProject,
  frameworkVersion: string,
): VoyantGraphPackageRecord[] {
  const names = sortedUnique([
    "@voyant-travel/framework",
    "@voyant-travel/framework-migrations",
    ...project.modules.map((unit) => unit.packageName ?? packageNameFromGraphId(unit.id)),
    ...project.plugins.map((unit) => unit.packageName ?? packageNameFromGraphId(unit.id)),
  ])
  return names.map((packageName) => ({
    packageName,
    ...(packageName === "@voyant-travel/framework" ? { version: frameworkVersion } : {}),
    source: { kind: "unknown" },
  }))
}

function normalizePackageRecord(record: VoyantGraphPackageRecord): VoyantGraphPackageRecord {
  return {
    packageName: record.packageName,
    ...(record.version ? { version: record.version } : {}),
    source: {
      kind: record.source.kind,
      ...(record.source.reference ? { reference: record.source.reference } : {}),
      ...(record.source.integrity ? { integrity: record.source.integrity } : {}),
    },
    ...(record.metadata ? { metadata: record.metadata } : {}),
  }
}

function routePaths(graph: ResolvedVoyantDeploymentGraph): string[] {
  return [...graph.modules, ...graph.plugins]
    .flatMap((unit) =>
      unit.api.map((route) => {
        if (route.mount?.startsWith("/")) return route.mount
        const segment = unit.localId ?? unit.id.split("#").at(-1) ?? unit.id
        if (route.surface === "admin") return `/v1/admin/${segment}`
        if (route.surface === "public") return `/v1/public/${segment}`
        if (route.surface === "webhook") return `/v1/${segment}`
        return route.mount ?? route.id
      }),
    )
    .sort()
}

function formatDiagnostics(diagnostics: readonly VoyantGraphDiagnostic[]): string {
  return diagnostics
    .map((entry) => `- ${entry.code}: ${entry.message}${entry.source ? ` (${entry.source})` : ""}`)
    .join("\n")
}

function sortWorkflows(workflows: readonly VoyantGraphWorkflow[]): VoyantGraphWorkflow[] {
  return [...workflows]
    .map((workflow) => ({
      ...workflow,
      ...(workflow.schedules
        ? { schedules: sortFacetEntities(workflow.schedules) as VoyantGraphWorkflowSchedule[] }
        : {}),
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

function sortFacetEntities<T extends { id: string }>(entities: readonly T[]): T[] {
  return [...entities].sort((a, b) => a.id.localeCompare(b.id))
}

function sortPorts(ports: readonly VoyantGraphPortDeclaration[]): VoyantGraphPortDeclaration[] {
  return [...ports].sort((a, b) => a.id.localeCompare(b.id))
}

function normalizeCapabilities(
  capabilities: readonly string[] | undefined,
): VoyantGraphCapabilityDeclaration | undefined {
  return capabilities && capabilities.length > 0 ? { capabilities } : undefined
}

function validCustomSourceSpecifiers(specifiers: readonly string[]): string[] {
  return sortedUnique(
    specifiers.map((specifier) => specifier.trim()).filter((specifier) => specifier.length > 0),
  )
}

function splitPackageSpecifier(specifier: string): { packageName: string; subpath?: string } {
  const trimmed = specifier.trim()
  if (trimmed.startsWith("operator/")) {
    return {
      packageName: "@voyant-travel/operator",
      subpath: trimmed.slice("operator/".length),
    }
  }

  const parts = trimmed.split("/")
  if (trimmed.startsWith("@")) {
    const packageName = parts.slice(0, 2).join("/")
    const subpath = parts.slice(2).join("/")
    return { packageName, ...(subpath ? { subpath } : {}) }
  }

  const [packageName, ...subpathParts] = parts
  return {
    packageName: packageName ?? trimmed,
    ...(subpathParts.length > 0 ? { subpath: subpathParts.join("/") } : {}),
  }
}

const SPECIFIER_PACKAGE_OWNERS: Record<string, string> = {
  "@voyant-travel/public-document-delivery": "@voyant-travel/hono",
}

function packageNameFromGraphId(id: string): string {
  return id.split("#")[0] ?? id
}

function isCanonicalGraphId(id: string): boolean {
  return GRAPH_ID_PATTERN.test(id)
}

function isGraphEntityIdSegment(value: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value)
}

function usesReservedCapabilityNamespace(token: string): boolean {
  const [prefix] = token.split(".")
  return prefix === "voyant" || STANDARD_CAPABILITY_PREFIXES.has(prefix ?? "")
}

function isFirstPartyPackage(packageName: string | undefined): boolean {
  return packageName?.startsWith("@voyant-travel/") ?? false
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b))
}

function sortDiagnostics(diagnostics: readonly VoyantGraphDiagnostic[]): VoyantGraphDiagnostic[] {
  return [...diagnostics].sort(
    (a, b) =>
      a.code.localeCompare(b.code) ||
      (a.source ?? "").localeCompare(b.source ?? "") ||
      (a.facet ?? "").localeCompare(b.facet ?? "") ||
      a.message.localeCompare(b.message),
  )
}

function diagnostic(
  input: Omit<VoyantGraphDiagnostic, "severity"> & {
    severity?: VoyantGraphDiagnosticSeverity
  },
): VoyantGraphDiagnostic {
  return {
    severity: input.severity ?? "error",
    ...input,
  }
}

function canonicalize(value: unknown): unknown {
  if (value === undefined) return null
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map(canonicalize)

  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[key] = canonicalize((value as Record<string, unknown>)[key])
  }
  return sorted
}

function getCrypto(): Crypto {
  const crypto = globalThis.crypto
  if (!crypto?.subtle) {
    throw new Error(
      "@voyant-travel/framework/deployment-graph: globalThis.crypto.subtle is required for graph hashing.",
    )
  }
  return crypto
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ""
  for (let i = 0; i < bytes.length; i++) {
    out += (bytes[i] ?? 0).toString(16).padStart(2, "0")
  }
  return out
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
