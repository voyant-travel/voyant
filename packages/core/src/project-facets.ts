import type {
  VoyantGraphFacetEntity,
  VoyantGraphJsonObject,
  VoyantGraphJsonValue,
  VoyantGraphRuntimeReference,
} from "./project.js"

export interface VoyantGraphConfigDeclaration extends VoyantGraphFacetEntity {
  key: string
  validator?: VoyantGraphRuntimeReference
  default?: VoyantGraphJsonValue
  required?: boolean
}

export interface VoyantGraphSecretDeclaration extends VoyantGraphFacetEntity {
  key: string
  validator?: VoyantGraphRuntimeReference
  required?: boolean
  description?: string
  rotation?: "supported" | "replace-only"
}

export interface VoyantGraphResourceDeclaration extends VoyantGraphFacetEntity {
  kind: string
  required?: boolean
  capabilities?: readonly string[]
  config?: VoyantGraphJsonObject
}

export interface VoyantGraphProviderDeclaration extends VoyantGraphFacetEntity {
  port: string
  /** Explicit deployment.providers match. Provider ids and env never select implementations. */
  selection?: {
    role: string
    value: string
  }
  runtime: VoyantGraphRuntimeReference
  config?: VoyantGraphJsonObject
}

export interface VoyantGraphAccessResource extends VoyantGraphFacetEntity {
  resource: string
  actions: readonly string[]
}

export interface VoyantGraphAccessRole extends VoyantGraphFacetEntity {
  grants: readonly string[]
}

export interface VoyantGraphAccessDeclaration {
  resources?: readonly VoyantGraphAccessResource[]
  roles?: readonly VoyantGraphAccessRole[]
}

export interface VoyantGraphMessageReference {
  namespace: string
  key: string
}

export interface VoyantGraphAdminCopy extends VoyantGraphFacetEntity {
  namespace: string
  fallbackLocale: string
  runtime: VoyantGraphRuntimeReference
}

export interface VoyantGraphAdminRoute extends VoyantGraphFacetEntity {
  path: string
  runtime: VoyantGraphRuntimeReference
  requiredScopes?: readonly string[]
  copy?: readonly VoyantGraphMessageReference[]
}

export interface VoyantGraphAdminNavItem extends VoyantGraphFacetEntity {
  routeId: string
  label: VoyantGraphMessageReference
  order?: number
}

export interface VoyantGraphAdminSlot extends VoyantGraphFacetEntity {
  routeId: string
  contract?: VoyantGraphJsonObject
}

export interface VoyantGraphAdminContribution extends VoyantGraphFacetEntity {
  slotId: string
  runtime: VoyantGraphRuntimeReference
  order?: number
  requiredScopes?: readonly string[]
  copy?: readonly VoyantGraphMessageReference[]
}

export interface VoyantGraphAdminDeclaration {
  /** Import-cheap factory for this unit's complete nav/route/page extension. */
  runtime?: VoyantGraphRuntimeReference
  copy?: readonly VoyantGraphAdminCopy[]
  routes?: readonly VoyantGraphAdminRoute[]
  nav?: readonly VoyantGraphAdminNavItem[]
  slots?: readonly VoyantGraphAdminSlot[]
  contributions?: readonly VoyantGraphAdminContribution[]
}

export interface VoyantGraphToolDeclaration extends VoyantGraphFacetEntity {
  name: string
  runtime: VoyantGraphRuntimeReference
  requiredScopes?: readonly string[]
  context?: readonly string[]
  risk?: "low" | "medium" | "high" | "critical"
}

export interface VoyantGraphWebhookDeclaration extends VoyantGraphFacetEntity {
  direction: "inbound" | "outbound"
  apiId?: string
  eventId?: string
  secretIds?: readonly string[]
}

export interface VoyantGraphActionBindings {
  routes?: readonly string[]
  tools?: readonly string[]
  workflows?: readonly string[]
  events?: readonly string[]
  webhooks?: readonly string[]
}

export interface VoyantGraphActionDeclaration extends VoyantGraphFacetEntity {
  capabilityId?: string
  version: string
  kind: "execute" | "read" | "sensitive-read"
  targetType: string
  resource?: string
  action?: string
  requiredScopes?: readonly string[]
  risk: "low" | "medium" | "high" | "critical"
  ledger: "required" | "optional"
  approval?: "never" | "conditional" | "required"
  policy?: string
  reversible?: boolean
  allowedActorTypes?: readonly string[]
  from?: VoyantGraphActionBindings
  copy?: readonly VoyantGraphMessageReference[]
}

export interface VoyantGraphSetupMigration extends VoyantGraphFacetEntity {
  source: string
  runtime: VoyantGraphRuntimeReference
  dependsOn?: readonly string[]
}

export interface VoyantGraphLifecycleDeclaration {
  compatibility?: {
    upgradeFrom?: string
  }
  uninstall?: {
    default: "retain-data"
    purge?: "not-supported" | "explicit"
  }
}
