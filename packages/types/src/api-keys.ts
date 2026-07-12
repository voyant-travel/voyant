// agent-quality: file-size exception -- owner: types; existing module stays co-located until a dedicated split preserves behavior and tests.
import { z } from "zod"

/**
 * Audiences a grant can represent. Mirrors the `Actor`/`Visibility` unions in
 * `@voyant-travel/core` / `@voyant-travel/catalog-contracts`, duplicated here so
 * the low-level `types` package stays dependency-free. Carried on the key grant
 * and resolved into the catalog `ResolverScope` at request time (never inferred
 * from the scope set).
 */
export const API_KEY_AUDIENCES = ["staff", "customer", "partner", "supplier"] as const

export type ApiKeyAudience = (typeof API_KEY_AUDIENCES)[number]

export type ApiKeyPermissions = Record<string, string[]>
export type ApiKeyPermissionString =
  | "*"
  | "*:*"
  | `${string}:*`
  | `*:${string}`
  | `${string}:${string}`

export interface ApiKeyPermissionDescriptor {
  resource: string
  action: string
  label: string
  description: string
}

export interface ApiKeyPermissionGroup {
  resource: string
  label: string
  description: string
  permissions: ApiKeyPermissionDescriptor[]
}

export interface AccessCatalogAction {
  action: string
  label: string
  description: string
  wildcard?: "allow" | "explicit"
}

export interface AccessCatalogResource {
  id: string
  unitId: string
  resource: string
  label: string
  description: string
  wildcard: "allow" | "explicit-resource"
  actions: readonly AccessCatalogAction[]
  legacyActions?: readonly string[]
}

export interface AccessCatalogPreset {
  id: string
  kind: "api-token" | "api-token-grant" | "staff"
  label: string
  description: string
  grants: readonly string[]
  audience?: ApiKeyAudience
}

export interface AccessCatalog {
  resources: readonly AccessCatalogResource[]
  presets: readonly AccessCatalogPreset[]
}
/** Resource and action descriptors are supplied by the selected deployment graph. */

export function accessCatalogPermissionGroups(catalog: AccessCatalog): ApiKeyPermissionGroup[] {
  return catalog.resources.map((resource) => ({
    resource: resource.resource,
    label: resource.label,
    description: resource.description,
    permissions: resource.actions.map((action) => ({
      resource: resource.resource,
      action: action.action,
      label: action.label,
      description: action.description,
    })),
  }))
}

/** Thrown by `assertKnownPermissions` when a permission names an unknown resource or action. */
export class UnknownApiKeyPermissionError extends Error {
  constructor(
    message: string,
    public readonly resource?: string,
    public readonly action?: string,
  ) {
    super(message)
    this.name = "UnknownApiKeyPermissionError"
  }
}

/**
 * Validate that every permission names a known resource + action (or a `*`
 * wildcard). Used at key-mint time so a typo'd scope is rejected instead of
 * silently accepted (and then never matching anything). Throws
 * `UnknownApiKeyPermissionError` on the first unknown token.
 */
export function assertKnownPermissions(
  permissions: string | ApiKeyPermissions | null | undefined,
  catalog: AccessCatalog,
): void {
  const normalized = normalizeApiKeyPermissions(permissions)
  const resources = new Map(catalog.resources.map((resource) => [resource.resource, resource]))
  const knownActions = new Set(
    catalog.resources.flatMap((resource) => [
      ...resource.actions.map((action) => action.action),
      ...(resource.legacyActions ?? []),
    ]),
  )
  for (const [resource, actions] of Object.entries(normalized)) {
    const descriptor = resources.get(resource)
    if (resource !== "*" && !descriptor) {
      throw new UnknownApiKeyPermissionError(
        `Unknown API key resource "${resource}". Known resources: ${[...resources.keys()].join(", ")}.`,
        resource,
      )
    }
    for (const action of actions) {
      const actionIsKnown =
        action === "*" ||
        (resource === "*"
          ? knownActions.has(action)
          : descriptor?.actions.some((candidate) => candidate.action === action) === true ||
            descriptor?.legacyActions?.includes(action) === true)
      if (!actionIsKnown) {
        throw new UnknownApiKeyPermissionError(
          `Unknown API key action "${action}" for resource "${resource}".`,
          resource,
          action,
        )
      }
    }
  }
}

/** Non-throwing variant of {@link assertKnownPermissions}. */
export function areKnownPermissions(
  permissions: string | ApiKeyPermissions | null | undefined,
  catalog: AccessCatalog,
): boolean {
  try {
    assertKnownPermissions(permissions, catalog)
    return true
  } catch {
    return false
  }
}

const permissionNamePattern = /^(\*|[a-z][a-z0-9-]*)$/
const permissionStringPattern = /^(\*|[a-z][a-z0-9-]*):(\*|[a-z][a-z0-9-]*)$/

export const apiKeyPermissionStringSchema = z
  .string()
  .trim()
  .refine(
    (value): value is ApiKeyPermissionString =>
      value === "*" || value === "*:*" || permissionStringPattern.test(value),
    {
      message: "Permission must be '*' or use the resource:action format.",
    },
  )

export const apiKeyPermissionsSchema = z
  .record(z.string(), z.array(z.string()))
  .transform((permissions) => normalizeApiKeyPermissions(permissions))

function parsePermissionsJson(permissions: string): ApiKeyPermissions {
  try {
    const parsed = JSON.parse(permissions) as unknown
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {}
    return normalizeApiKeyPermissions(parsed as ApiKeyPermissions)
  } catch {
    return {}
  }
}

export function normalizeApiKeyPermissions(
  permissions: string | ApiKeyPermissions | null | undefined,
): ApiKeyPermissions {
  if (!permissions) return {}
  if (typeof permissions === "string") return parsePermissionsJson(permissions)

  const normalized: ApiKeyPermissions = {}
  for (const [resourceInput, actionsInput] of Object.entries(permissions)) {
    const resource = resourceInput.trim().toLowerCase()
    if (!permissionNamePattern.test(resource) || !Array.isArray(actionsInput)) continue

    const actions = Array.from(
      new Set(
        actionsInput
          .map((action) => action.trim().toLowerCase())
          .filter((action) => permissionNamePattern.test(action)),
      ),
    ).sort()

    if (actions.length > 0) {
      normalized[resource] = actions
    }
  }
  return normalized
}

export function permissionStringsToPermissions(permissions: readonly string[]): ApiKeyPermissions {
  const next: ApiKeyPermissions = {}

  for (const permissionInput of permissions) {
    const permission = permissionInput.trim().toLowerCase()
    if (permission === "*" || permission === "*:*") {
      next["*"] = ["*"]
      continue
    }
    if (!permissionStringPattern.test(permission)) continue

    const [resource, action] = permission.split(":")
    if (!resource || !action) continue
    next[resource] = Array.from(new Set([...(next[resource] ?? []), action])).sort()
  }

  return normalizeApiKeyPermissions(next)
}

export function permissionsToStrings(
  permissions: string | ApiKeyPermissions | null | undefined,
): ApiKeyPermissionString[] {
  const normalized = normalizeApiKeyPermissions(permissions)
  const strings: ApiKeyPermissionString[] = []

  for (const [resource, actions] of Object.entries(normalized)) {
    if (resource === "*" && actions.includes("*")) {
      strings.push("*")
      continue
    }

    for (const action of actions) {
      strings.push(`${resource}:${action}` as ApiKeyPermissionString)
    }
  }

  return Array.from(new Set(strings)).sort()
}

export function hasApiKeyPermission(
  permissions: string | ApiKeyPermissions | null | undefined,
  resource: string,
  action: string,
  catalog?: AccessCatalog,
): boolean {
  const normalized = normalizeApiKeyPermissions(permissions)
  const resourceKey = resource.trim().toLowerCase()
  const actionKey = action.trim().toLowerCase()

  const descriptor = catalog?.resources.find((resource) => resource.resource === resourceKey)
  const actionDescriptor = descriptor?.actions.find((candidate) => candidate.action === actionKey)

  if (actionDescriptor?.wildcard === "explicit") {
    return normalized[resourceKey]?.includes(actionKey) === true
  }

  // PII-sensitive resources are never satisfied by the `*` resource wildcard;
  // only an explicit grant on the resource itself counts.
  if (descriptor?.wildcard === "explicit-resource") {
    return (
      normalized[resourceKey]?.includes("*") === true ||
      normalized[resourceKey]?.includes(actionKey) === true
    )
  }

  return (
    normalized["*"]?.includes("*") === true ||
    normalized["*"]?.includes(actionKey) === true ||
    normalized[resourceKey]?.includes("*") === true ||
    normalized[resourceKey]?.includes(actionKey) === true
  )
}

export function hasApiKeyPermissions(
  permissions: string | ApiKeyPermissions | null | undefined,
  required: ApiKeyPermissions,
  catalog?: AccessCatalog,
): boolean {
  return Object.entries(normalizeApiKeyPermissions(required)).every(([resource, actions]) =>
    actions.every((action) => hasApiKeyPermission(permissions, resource, action, catalog)),
  )
}

export function describePermissions(
  permissions: string | ApiKeyPermissions | null | undefined,
): string {
  const normalized = normalizeApiKeyPermissions(permissions)
  const permissionStrings = permissionsToStrings(normalized)

  if (normalized["*"]?.includes("*")) return "Full access"
  if (permissionStrings.length === 0) return "No permissions"
  if (permissionStrings.length === 1 && permissionStrings[0] === "*:read") return "Read-only access"

  const resources = Object.keys(normalized).filter((resource) => resource !== "*")
  const actions = new Set(
    Object.values(normalized)
      .flat()
      .filter((action) => action !== "*"),
  )

  return `${resources.length || "All"} resource${resources.length === 1 ? "" : "s"} / ${
    actions.size || "all"
  } action${actions.size === 1 ? "" : "s"}`
}

export const EXPIRATION_PRESETS = {
  never: {
    label: "Never",
    days: null,
  },
  "7days": {
    label: "7 days",
    days: 7,
  },
  "30days": {
    label: "30 days",
    days: 30,
  },
  "90days": {
    label: "90 days",
    days: 90,
  },
  "180days": {
    label: "6 months",
    days: 180,
  },
  "365days": {
    label: "1 year",
    days: 365,
  },
  custom: {
    label: "Custom date",
    days: null,
  },
} as const

export type ExpirationPresetKey = keyof typeof EXPIRATION_PRESETS

export function calculateExpirationDate(
  preset: ExpirationPresetKey,
  customDate?: Date,
): Date | null {
  if (preset === "never") return null
  if (preset === "custom") return customDate || null

  const config = EXPIRATION_PRESETS[preset]
  if (!config.days) return null

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + config.days)
  return expiresAt
}

/** @deprecated Use ApiKeyPermissionString. */
export type ApiKeyScope = ApiKeyPermissionString
/** @deprecated Use ApiKeyPermissionDescriptor. */
export type ApiKeyScopeDescriptor = ApiKeyPermissionDescriptor & { scope: ApiKeyPermissionString }
/** @deprecated Use apiKeyPermissionStringSchema. */
export const apiKeyScopeSchema = apiKeyPermissionStringSchema
/** @deprecated Use array of apiKeyPermissionStringSchema only for display strings. */
export const apiKeyScopesSchema = z.array(apiKeyPermissionStringSchema).default([])
/** @deprecated Use permissionStringsToPermissions. */
export const scopesToPermissions = permissionStringsToPermissions
/** @deprecated Use permissionsToStrings. */
export const permissionsToScopes = permissionsToStrings
/** @deprecated Use permissionsToStrings. */
export const normalizeApiKeyScopes = permissionsToStrings
/** @deprecated Use apiKeyPermissionStringSchema.parse. */
export function normalizeApiKeyScope(scope: string): ApiKeyPermissionString {
  const normalized = scope.trim().toLowerCase()
  if (normalized === "*:*") return "*"
  return apiKeyPermissionStringSchema.parse(normalized)
}
/** @deprecated Use hasApiKeyPermission. */
export function scopeMatches(userScope: string, requiredScope: string): boolean {
  const [resource, action] = requiredScope.split(":")
  if (!resource || !action) return false
  return hasApiKeyPermission(permissionStringsToPermissions([userScope]), resource, action)
}
/** @deprecated Use hasApiKeyPermissions. */
export function hasScopes(
  userScopes: readonly string[],
  requiredScopes: readonly string[],
): boolean {
  return hasApiKeyPermissions(
    permissionStringsToPermissions(userScopes),
    permissionStringsToPermissions(requiredScopes),
  )
}
/** @deprecated Use describePermissions. */
export const describeScopes = describePermissions
/** @deprecated Use describePermissions. */
export const describescopes = describePermissions
