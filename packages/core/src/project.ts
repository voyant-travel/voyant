/**
 * Import-cheap authoring contracts for package-owned deployment manifests.
 * Executable route, schema, UI, workflow, and provider code is referenced by
 * package export, never imported from this module.
 */

import type {
  VoyantGraphAccessDeclaration,
  VoyantGraphActionDeclaration,
  VoyantGraphAdminDeclaration,
  VoyantGraphConfigDeclaration,
  VoyantGraphLifecycleDeclaration,
  VoyantGraphProviderDeclaration,
  VoyantGraphResourceDeclaration,
  VoyantGraphSecretDeclaration,
  VoyantGraphSetupMigration,
  VoyantGraphToolDeclaration,
  VoyantGraphWebhookDeclaration,
} from "./project-facets.js"

export type * from "./project-facets.js"

export const VOYANT_GRAPH_PROJECT_SCHEMA_VERSION = "voyant.project.v1" as const
export const VOYANT_GRAPH_MODULE_SCHEMA_VERSION = "voyant.module.v1" as const
export const VOYANT_GRAPH_PLUGIN_SCHEMA_VERSION = "voyant.plugin.v1" as const

export type VoyantGraphUnitKind = "module" | "plugin"
export type VoyantGraphRouteSurface = "admin" | "public" | "webhook" | "internal"

export type VoyantGraphJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly VoyantGraphJsonValue[]
  | { readonly [key: string]: VoyantGraphJsonValue }

export type VoyantGraphJsonObject = { readonly [key: string]: VoyantGraphJsonValue }

export interface VoyantGraphCapabilityDeclaration {
  capabilities?: readonly string[]
  ports?: readonly VoyantGraphPortDeclaration[]
}

export interface VoyantGraphPortDeclaration {
  id: string
  optional?: boolean
}

/** A symbolic package export resolved only after package admission. */
export interface VoyantGraphRuntimeReference {
  entry: string
  export?: string
}

export interface VoyantGraphRouteBundle {
  id: string
  surface: VoyantGraphRouteSurface
  mount?: string
  resource?: string
  requiredScopes?: readonly string[]
  anonymous?: boolean | readonly string[]
  transactional?: boolean
  runtime?: VoyantGraphRuntimeReference
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
  setupMigrations?: readonly VoyantGraphSetupMigration[]
  config?: readonly VoyantGraphConfigDeclaration[]
  secrets?: readonly VoyantGraphSecretDeclaration[]
  resources?: readonly VoyantGraphResourceDeclaration[]
  providers?: readonly VoyantGraphProviderDeclaration[]
  access?: VoyantGraphAccessDeclaration
  admin?: VoyantGraphAdminDeclaration
  tools?: readonly VoyantGraphToolDeclaration[]
  webhooks?: readonly VoyantGraphWebhookDeclaration[]
  actions?: readonly VoyantGraphActionDeclaration[]
  lifecycle?: VoyantGraphLifecycleDeclaration
  meta?: VoyantGraphJsonObject
}

export interface DefineVoyantGraphUnitInput extends Omit<VoyantGraphUnitManifest, "schemaVersion"> {
  schemaVersion?: VoyantGraphUnitManifest["schemaVersion"]
}

export interface DefineVoyantGraphProjectSelection {
  resolve: string
  config?: VoyantGraphJsonObject
}

export type DefineVoyantGraphProjectUnitInput =
  | string
  | DefineVoyantGraphProjectSelection
  | VoyantGraphUnitManifest

export type VoyantGraphProjectSelectionProvenance =
  | {
      kind: "package"
      packageName: string
      unitPath?: string
    }
  | {
      kind: "path"
      path: string
    }

/** Serializable author intent retained separately from package-owned facets. */
export interface VoyantGraphProjectSelection {
  id: string
  resolve: string
  packageName: string
  provenance: VoyantGraphProjectSelectionProvenance
  config?: VoyantGraphJsonObject
}

export interface VoyantGraphProjectSelections {
  modules: readonly VoyantGraphProjectSelection[]
  plugins: readonly VoyantGraphProjectSelection[]
}

export type VoyantGraphProjectDeploymentMode = "local" | "managed-cloud" | "self-hosted"

/**
 * Unified application graphs always compile to the Node runtime. Hosting
 * choices such as Voyant Cloud, Docker, Fly, or Railway are CLI target adapters
 * for that Node artifact, not alternate application runtimes.
 */
export interface VoyantGraphProjectDeployment {
  target?: "node"
  mode?: VoyantGraphProjectDeploymentMode
  providers?: Readonly<Record<string, string>>
}

export interface DefineVoyantGraphProjectInput {
  schemaVersion?: typeof VOYANT_GRAPH_PROJECT_SCHEMA_VERSION
  presetLineage?: string
  modules: readonly DefineVoyantGraphProjectUnitInput[]
  plugins?: readonly DefineVoyantGraphProjectUnitInput[]
  deployment?: VoyantGraphProjectDeployment
  meta?: VoyantGraphJsonObject
}

export interface VoyantGraphProject {
  schemaVersion: typeof VOYANT_GRAPH_PROJECT_SCHEMA_VERSION
  presetLineage?: string
  modules: readonly VoyantGraphUnitManifest[]
  plugins: readonly VoyantGraphUnitManifest[]
  selections?: VoyantGraphProjectSelections
  deployment?: VoyantGraphProjectDeployment
  meta?: VoyantGraphJsonObject
}

export function defineModule(input: DefineVoyantGraphUnitInput): VoyantGraphUnitManifest {
  return defineGraphUnit(VOYANT_GRAPH_MODULE_SCHEMA_VERSION, input)
}

export function definePlugin(input: DefineVoyantGraphUnitInput): VoyantGraphUnitManifest {
  return defineGraphUnit(VOYANT_GRAPH_PLUGIN_SCHEMA_VERSION, input)
}

export function defineProject(input: DefineVoyantGraphProjectInput): VoyantGraphProject {
  const schemaVersion = input.schemaVersion ?? VOYANT_GRAPH_PROJECT_SCHEMA_VERSION
  if (schemaVersion !== VOYANT_GRAPH_PROJECT_SCHEMA_VERSION) {
    throw new Error(
      `defineProject: schemaVersion must be "${VOYANT_GRAPH_PROJECT_SCHEMA_VERSION}".`,
    )
  }

  const modules = normalizeProjectUnits(input.modules, "module")
  const plugins = normalizeProjectUnits(input.plugins ?? [], "plugin")
  const hasSelections = modules.selections.length > 0 || plugins.selections.length > 0
  const deployment = normalizeProjectDeployment(input.deployment)

  return {
    schemaVersion,
    ...(input.presetLineage ? { presetLineage: input.presetLineage } : {}),
    modules: modules.units,
    plugins: plugins.units,
    ...(hasSelections
      ? {
          selections: {
            modules: modules.selections,
            plugins: plugins.selections,
          },
        }
      : {}),
    ...(deployment ? { deployment } : {}),
    ...(input.meta ? { meta: input.meta } : {}),
  }
}

function normalizeProjectDeployment(
  input: VoyantGraphProjectDeployment | undefined,
): VoyantGraphProjectDeployment | undefined {
  if (!input) return undefined

  const target = normalizeOptionalString(input.target, "deployment.target")
  if (target !== undefined && target !== "node") {
    throw new Error('defineProject: deployment.target must be "node".')
  }
  if (
    input.mode !== undefined &&
    input.mode !== "local" &&
    input.mode !== "managed-cloud" &&
    input.mode !== "self-hosted"
  ) {
    throw new Error(
      'defineProject: deployment.mode must be "local", "managed-cloud", or "self-hosted".',
    )
  }

  const providers: Record<string, string> = {}
  if (input.providers !== undefined) {
    if (!isPlainObject(input.providers)) {
      throw new Error("defineProject: deployment.providers must be a plain string record.")
    }
    for (const role of Object.keys(input.providers).sort((left, right) =>
      left.localeCompare(right),
    )) {
      if (role.trim().length === 0) {
        throw new Error("defineProject: deployment.providers keys must be non-empty strings.")
      }
      const provider = normalizeOptionalString(
        input.providers[role],
        `deployment.providers.${role}`,
      )
      if (!provider) {
        throw new Error(`defineProject: deployment.providers.${role} must be a non-empty string.`)
      }
      providers[role] = provider
    }
  }

  if (!target && input.mode === undefined && Object.keys(providers).length === 0) return undefined
  return {
    ...(target ? { target } : {}),
    ...(input.mode ? { mode: input.mode } : {}),
    ...(Object.keys(providers).length > 0 ? { providers } : {}),
  }
}

function normalizeOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`defineProject: ${label} must be a non-empty string.`)
  }
  return value.trim()
}

function normalizeProjectUnits(
  inputs: readonly DefineVoyantGraphProjectUnitInput[],
  kind: VoyantGraphUnitKind,
): {
  units: VoyantGraphUnitManifest[]
  selections: VoyantGraphProjectSelection[]
} {
  const units: VoyantGraphUnitManifest[] = []
  const selections: VoyantGraphProjectSelection[] = []

  for (const [index, input] of inputs.entries()) {
    if (typeof input !== "string" && !isProjectSelection(input)) {
      units.push(input)
      continue
    }

    const label = `${kind === "module" ? "modules" : "plugins"}[${index}]`
    if (typeof input !== "string") {
      const unsupportedKeys = Object.keys(input).filter(
        (key) => key !== "resolve" && key !== "config",
      )
      if (unsupportedKeys.length > 0) {
        throw new Error(
          `defineProject: ${label} selection supports only "resolve" and serializable "config"; unsupported key "${unsupportedKeys.sort().join('", "')}".`,
        )
      }
    }
    const selection = normalizeProjectSelection(
      typeof input === "string" ? input : input.resolve,
      typeof input === "string" ? undefined : input.config,
      label,
    )
    units.push(
      defineGraphUnit(
        kind === "module" ? VOYANT_GRAPH_MODULE_SCHEMA_VERSION : VOYANT_GRAPH_PLUGIN_SCHEMA_VERSION,
        { id: selection.id, packageName: selection.packageName },
      ),
    )
    selections.push(selection)
  }

  return { units, selections }
}

function isProjectSelection(
  input: DefineVoyantGraphProjectSelection | VoyantGraphUnitManifest,
): input is DefineVoyantGraphProjectSelection {
  return "resolve" in input
}

function normalizeProjectSelection(
  resolve: string,
  config: VoyantGraphJsonObject | undefined,
  label: string,
): VoyantGraphProjectSelection {
  if (typeof resolve !== "string" || resolve.trim().length === 0) {
    throw new Error(`defineProject: ${label}.resolve must be a non-empty string.`)
  }

  const trimmed = resolve.trim().replaceAll("\\", "/")
  const normalized = isLocalPath(trimmed)
    ? normalizePathSelection(trimmed, label)
    : normalizePackageSelection(trimmed, label)

  return {
    ...normalized,
    ...(config === undefined ? {} : { config: normalizeJsonObject(config, `${label}.config`) }),
  }
}

function normalizePackageSelection(
  resolve: string,
  label: string,
): Omit<VoyantGraphProjectSelection, "config"> {
  const { reference, fragment } = splitSelectionFragment(resolve, label)
  const parts = reference.split("/")
  const scoped = reference.startsWith("@")
  const packageName = scoped ? parts.slice(0, 2).join("/") : (parts[0] ?? "")
  const packageNamePattern = scoped
    ? /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/
    : /^[a-z0-9][a-z0-9._-]*$/
  if ((scoped && parts.length < 2) || !packageNamePattern.test(packageName)) {
    throw new Error(
      `defineProject: ${label}.resolve must start with a canonical package name. Use "./" for a local path.`,
    )
  }

  const subpath = parts.slice(scoped ? 2 : 1).join("/")
  const unitPath = normalizeUnitPath([subpath, fragment].filter(Boolean).join("/"), label)
  const graphPackageId = scoped ? packageName : `npm/${packageName}`
  const id = unitPath ? `${graphPackageId}#${unitPath}` : graphPackageId

  return {
    id,
    resolve: id,
    packageName,
    provenance: {
      kind: "package",
      packageName,
      ...(unitPath ? { unitPath } : {}),
    },
  }
}

function normalizePathSelection(
  resolve: string,
  label: string,
): Omit<VoyantGraphProjectSelection, "config"> {
  const withoutFilePrefix = resolve.startsWith("file:") ? resolve.slice("file:".length) : resolve
  if (withoutFilePrefix.startsWith("/") || /^[a-zA-Z]:\//.test(withoutFilePrefix)) {
    throw new Error(
      `defineProject: ${label}.resolve must be project-relative; absolute local paths are not deterministic.`,
    )
  }

  const { reference, fragment } = splitSelectionFragment(withoutFilePrefix, label)
  const segments: string[] = []
  for (const segment of reference.split("/")) {
    if (segment === "" || segment === ".") continue
    if (segment === "..") {
      if (segments.length === 0) {
        throw new Error(
          `defineProject: ${label}.resolve must not escape the project with ".." segments.`,
        )
      }
      segments.pop()
      continue
    }
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(segment)) {
      throw new Error(
        `defineProject: ${label}.resolve local path segment "${segment}" must use lowercase letters, numbers, dots, underscores, or hyphens.`,
      )
    }
    segments.push(segment)
  }

  if (segments.length === 0) {
    throw new Error(`defineProject: ${label}.resolve must identify a local module or plugin path.`)
  }

  const path = `./${segments.join("/")}`
  const packageName = `local/${segments.join(".")}`
  const unitPath = normalizeUnitPath(fragment, label)
  const id = unitPath ? `${packageName}#${unitPath}` : packageName

  return {
    id,
    resolve: unitPath ? `${path}#${unitPath}` : path,
    packageName,
    provenance: { kind: "path", path },
  }
}

function isLocalPath(resolve: string): boolean {
  return (
    resolve.startsWith("./") ||
    resolve.startsWith("../") ||
    resolve.startsWith("/") ||
    resolve.startsWith("file:") ||
    /^[a-zA-Z]:\//.test(resolve)
  )
}

function splitSelectionFragment(
  resolve: string,
  label: string,
): { reference: string; fragment: string } {
  const separator = resolve.indexOf("#")
  if (separator === -1) return { reference: resolve, fragment: "" }
  if (resolve.indexOf("#", separator + 1) !== -1) {
    throw new Error(`defineProject: ${label}.resolve may contain only one "#" fragment.`)
  }

  const reference = resolve.slice(0, separator)
  const fragment = resolve.slice(separator + 1)
  if (reference.length === 0 || fragment.length === 0) {
    throw new Error(`defineProject: ${label}.resolve contains an empty package/path or fragment.`)
  }
  return { reference, fragment }
}

function normalizeUnitPath(value: string, label: string): string {
  if (!value) return ""
  const segments = value.split("/").filter(Boolean)
  if (segments.some((segment) => !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(segment))) {
    throw new Error(
      `defineProject: ${label}.resolve unit subpaths and fragments must use letters, numbers, dots, underscores, or hyphens.`,
    )
  }
  return segments.join(".")
}

function normalizeJsonObject(input: VoyantGraphJsonObject, label: string): VoyantGraphJsonObject {
  if (!isPlainObject(input)) {
    throw new Error(`defineProject: ${label} must be a plain JSON object.`)
  }
  return normalizeJsonValue(input, label, new Set()) as VoyantGraphJsonObject
}

function normalizeJsonValue(
  input: unknown,
  label: string,
  ancestors: Set<object>,
): VoyantGraphJsonValue {
  if (input === null || typeof input === "string" || typeof input === "boolean") return input
  if (typeof input === "number") {
    if (!Number.isFinite(input)) {
      throw new Error(`defineProject: ${label} must contain only finite JSON numbers.`)
    }
    return Object.is(input, -0) ? 0 : input
  }
  if (typeof input !== "object") {
    throw new Error(`defineProject: ${label} must contain only JSON-serializable values.`)
  }
  if (ancestors.has(input)) {
    throw new Error(`defineProject: ${label} must not contain circular references.`)
  }

  ancestors.add(input)
  try {
    if (Array.isArray(input)) {
      return input.map((value, index) => normalizeJsonValue(value, `${label}[${index}]`, ancestors))
    }
    if (!isPlainObject(input)) {
      throw new Error(`defineProject: ${label} must contain only plain JSON objects.`)
    }

    const normalized: Record<string, VoyantGraphJsonValue> = {}
    for (const key of Object.keys(input).sort((left, right) => left.localeCompare(right))) {
      Object.defineProperty(normalized, key, {
        configurable: true,
        enumerable: true,
        value: normalizeJsonValue(input[key], `${label}.${key}`, ancestors),
        writable: true,
      })
    }
    return normalized
  } finally {
    ancestors.delete(input)
  }
}

function isPlainObject(input: object): input is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(input)
  return prototype === Object.prototype || prototype === null
}

function defineGraphUnit(
  schemaVersion: VoyantGraphUnitManifest["schemaVersion"],
  input: DefineVoyantGraphUnitInput,
): VoyantGraphUnitManifest {
  return {
    ...input,
    schemaVersion: input.schemaVersion ?? schemaVersion,
  }
}
