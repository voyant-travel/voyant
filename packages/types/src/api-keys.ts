// agent-quality: file-size exception -- owner: types; existing module stays co-located until a dedicated split preserves behavior and tests.
import { z } from "zod"

export const API_KEY_ACTIONS = ["read", "write", "delete", "trigger", "relay", "search"] as const

export type ApiKeyAction = (typeof API_KEY_ACTIONS)[number]

export const API_KEY_RESOURCES = [
  "availability",
  "bookings",
  "catalog",
  "crm",
  "cruises",
  "departures",
  "finance",
  "ground",
  "accommodations",
  "itineraries",
  "legal",
  "notifications",
  "pricing",
  "products",
  "quotes",
  "resources",
  "storefront",
  "suppliers",
  "transactions",
  "trips",
  "webhooks",
  "workflows",
  "settings",
  "team",
] as const

export type ApiKeyResource = (typeof API_KEY_RESOURCES)[number]

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

function permission(resource: string, action: string, label: string, description: string) {
  return { resource, action, label, description }
}

export const API_KEY_PERMISSION_GROUPS = [
  {
    resource: "catalog",
    label: "Catalog",
    description: "Search and read unified catalog content.",
    permissions: [
      permission(
        "catalog",
        "read",
        "Read catalog",
        "Read catalog records and storefront-ready content.",
      ),
      permission(
        "catalog",
        "search",
        "Search catalog",
        "Run catalog search and discovery requests.",
      ),
    ],
  },
  {
    resource: "products",
    label: "Products",
    description: "Read and manage products, options, content, and media.",
    permissions: [
      permission(
        "products",
        "read",
        "Read products",
        "Read product, option, media, category, and tag data.",
      ),
      permission(
        "products",
        "write",
        "Write products",
        "Create or update products and product content.",
      ),
      permission(
        "products",
        "delete",
        "Delete products",
        "Delete products and product-owned records.",
      ),
    ],
  },
  {
    resource: "departures",
    label: "Departures",
    description: "Read and manage scheduled departures.",
    permissions: [
      permission(
        "departures",
        "read",
        "Read departures",
        "Read departure schedules and availability context.",
      ),
      permission(
        "departures",
        "write",
        "Write departures",
        "Create or update scheduled departures.",
      ),
    ],
  },
  {
    resource: "itineraries",
    label: "Itineraries",
    description: "Read and manage day-by-day itinerary content.",
    permissions: [
      permission(
        "itineraries",
        "read",
        "Read itineraries",
        "Read itinerary days, services, and descriptions.",
      ),
      permission(
        "itineraries",
        "write",
        "Write itineraries",
        "Create or update itinerary content.",
      ),
    ],
  },
  {
    resource: "bookings",
    label: "Bookings",
    description: "Read and manage booking records and booking workflows.",
    permissions: [
      permission(
        "bookings",
        "read",
        "Read bookings",
        "Read booking records and non-sensitive booking state.",
      ),
      permission(
        "bookings",
        "write",
        "Write bookings",
        "Create, update, confirm, or cancel bookings.",
      ),
      permission(
        "bookings",
        "delete",
        "Delete bookings",
        "Delete booking-owned records where supported.",
      ),
    ],
  },
  {
    resource: "quotes",
    label: "Quotes",
    description: "Read and manage quote records, quote versions, and quote workflows.",
    permissions: [
      permission(
        "quotes",
        "read",
        "Read quotes",
        "Read quote records, quote versions, pipelines, and stages.",
      ),
      permission(
        "quotes",
        "write",
        "Write quotes",
        "Create or update quote records, quote versions, pipelines, and stages.",
      ),
    ],
  },
  {
    resource: "trips",
    label: "Trips",
    description: "Read and manage composed trips, components, pricing, and reservations.",
    permissions: [
      permission(
        "trips",
        "read",
        "Read trips",
        "Read composed trips, components, snapshots, pricing, and reservation state.",
      ),
      permission(
        "trips",
        "write",
        "Write trips",
        "Create or update composed trips, components, pricing, and reservations.",
      ),
    ],
  },
  {
    resource: "availability",
    label: "Availability",
    description: "Read and manage availability rules, slots, and closeouts.",
    permissions: [
      permission(
        "availability",
        "read",
        "Read availability",
        "Read availability slots, rules, pickup points, and closeouts.",
      ),
      permission(
        "availability",
        "write",
        "Write availability",
        "Create or update availability configuration.",
      ),
    ],
  },
  {
    resource: "accommodations",
    label: "Accommodations",
    description: "Read and manage lodging catalog content, room options, and rate plans.",
    permissions: [
      permission(
        "accommodations",
        "read",
        "Read accommodations",
        "Read lodging content, room options, rate plans, and accommodation booking lines.",
      ),
      permission(
        "accommodations",
        "write",
        "Write accommodations",
        "Create or update accommodation catalog and resale records.",
      ),
    ],
  },
  {
    resource: "ground",
    label: "Ground",
    description: "Read and manage ground transport operations.",
    permissions: [
      permission(
        "ground",
        "read",
        "Read ground",
        "Read transport schedules, vehicles, dispatch, and operations data.",
      ),
      permission("ground", "write", "Write ground", "Create or update ground transport records."),
    ],
  },
  {
    resource: "cruises",
    label: "Cruises",
    description: "Read and manage cruise products and sailing data.",
    permissions: [
      permission(
        "cruises",
        "read",
        "Read cruises",
        "Read cruise products, sailings, cabins, and itinerary data.",
      ),
      permission("cruises", "write", "Write cruises", "Create or update cruise records."),
    ],
  },
  {
    resource: "workflows",
    label: "Workflows",
    description: "Trigger workflow automation from external systems.",
    permissions: [
      permission(
        "workflows",
        "trigger",
        "Trigger workflows",
        "Trigger workflow runs and ingest workflow events.",
      ),
    ],
  },
  {
    resource: "webhooks",
    label: "Webhooks",
    description: "Relay webhook events into Voyant runtimes.",
    permissions: [
      permission(
        "webhooks",
        "relay",
        "Relay webhooks",
        "Relay validated third-party webhook events.",
      ),
    ],
  },
  {
    resource: "settings",
    label: "Settings",
    description: "Workspace configuration — profile, taxes, channels, tokens, payments.",
    permissions: [
      permission("settings", "read", "View settings", "Read workspace configuration."),
      permission(
        "settings",
        "write",
        "Manage settings",
        "Change workspace configuration. Admin-only by default.",
      ),
      permission(
        "settings",
        "delete",
        "Delete settings",
        "Remove workspace configuration entries. Admin-only by default.",
      ),
    ],
  },
  {
    resource: "team",
    label: "Team",
    description: "Members and their access to this workspace.",
    permissions: [
      permission("team", "read", "View team", "See members and pending invitations."),
      permission(
        "team",
        "write",
        "Manage team",
        "Invite members and set their permissions. Admin-only by default.",
      ),
      permission(
        "team",
        "delete",
        "Revoke invitations",
        "Revoke pending invitations. Admin-only by default.",
      ),
    ],
  },
] as const satisfies readonly ApiKeyPermissionGroup[]

export const API_KEY_PERMISSION_PRESETS = {
  "catalog-read": {
    label: "Catalog read",
    description: "Read/search catalog, product, departure, and itinerary content.",
    permissions: {
      catalog: ["read", "search"],
      products: ["read"],
      departures: ["read"],
      itineraries: ["read"],
    },
  },
  "commerce-read": {
    label: "Commerce read",
    description: "Read bookings, availability, products, pricing, and suppliers.",
    permissions: {
      bookings: ["read"],
      availability: ["read"],
      products: ["read"],
      pricing: ["read"],
      suppliers: ["read"],
    },
  },
  automation: {
    label: "Automation",
    description: "Trigger workflows and relay webhooks.",
    permissions: {
      workflows: ["trigger"],
      webhooks: ["relay"],
    },
  },
  "read-only": {
    label: "Read only",
    description: "Read across every resource that accepts API tokens.",
    permissions: {
      "*": ["read"],
    },
  },
  "full-access": {
    label: "Full access",
    description: "All resources and all actions. Use only for trusted automation.",
    permissions: {
      "*": ["*"],
    },
  },
} as const satisfies Record<
  string,
  { label: string; description: string; permissions: ApiKeyPermissions }
>

export type ApiKeyPermissionPresetKey = keyof typeof API_KEY_PERMISSION_PRESETS

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
): boolean {
  const normalized = normalizeApiKeyPermissions(permissions)
  const resourceKey = resource.trim().toLowerCase()
  const actionKey = action.trim().toLowerCase()

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
): boolean {
  return Object.entries(normalizeApiKeyPermissions(required)).every(([resource, actions]) =>
    actions.every((action) => hasApiKeyPermission(permissions, resource, action)),
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
/** @deprecated Use API_KEY_PERMISSION_GROUPS. */
export const API_KEY_SCOPE_GROUPS = API_KEY_PERMISSION_GROUPS.map((group) => ({
  ...group,
  scopes: group.permissions.map((item) => ({
    ...item,
    scope: `${item.resource}:${item.action}` as ApiKeyPermissionString,
  })),
}))
/** @deprecated Use API_KEY_PERMISSION_PRESETS. */
export const API_KEY_SCOPE_PRESETS = Object.fromEntries(
  Object.entries(API_KEY_PERMISSION_PRESETS).map(([key, preset]) => [
    key,
    { ...preset, scopes: permissionsToStrings(preset.permissions) },
  ]),
) as Record<string, { label: string; description: string; scopes: ApiKeyPermissionString[] }>
/** @deprecated Use ApiKeyPermissionPresetKey. */
export type ApiKeyScopePresetKey = ApiKeyPermissionPresetKey
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
