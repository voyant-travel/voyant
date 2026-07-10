/**
 * Import-cheap authoring contracts for package-owned deployment manifests.
 * Executable route, schema, UI, workflow, and provider code is referenced by
 * package export, never imported from this module.
 */

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
  meta?: VoyantGraphJsonObject
}

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

  return {
    schemaVersion,
    ...(input.presetLineage ? { presetLineage: input.presetLineage } : {}),
    modules: [...input.modules],
    plugins: [...(input.plugins ?? [])],
    ...(input.meta ? { meta: input.meta } : {}),
  }
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
