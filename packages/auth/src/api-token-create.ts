import {
  type AccessCatalog,
  API_KEY_AUDIENCES,
  type ApiKeyPermissions,
  assertKnownPermissions,
  permissionStringsToPermissions,
  UnknownApiKeyPermissionError,
} from "@voyant-travel/types/api-keys"

/** Fields accepted on a create-API-token request body (allowlist). */
export const API_TOKEN_CREATE_FIELDS = [
  "configId",
  "name",
  "expiresIn",
  "remaining",
  "prefix",
  "organizationId",
  "metadata",
  "permissions",
] as const

/** Pick an allowlisted subset of a request body. */
export function pickFields(
  body: Record<string, unknown>,
  fields: readonly string[],
): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  for (const field of fields) {
    if (body[field] !== undefined) next[field] = body[field]
  }
  return next
}

/** Thrown when a create body carries an invalid grant preset, permission, or audience (→ 400). */
export class ApiTokenValidationError extends Error {}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Union two permission maps (used to layer explicit permissions over a preset's). */
function mergePermissions(
  base: ApiKeyPermissions,
  extra: ApiKeyPermissions | undefined,
): ApiKeyPermissions {
  const out: ApiKeyPermissions = {}
  for (const [resource, actions] of Object.entries(base)) out[resource] = [...actions]
  if (extra) {
    for (const [resource, actions] of Object.entries(extra)) {
      out[resource] = Array.from(new Set([...(out[resource] ?? []), ...actions]))
    }
  }
  return out
}

/**
 * Build the `createApiKey` body from a request body: resolve an optional
 * `grantPreset` (permissions subset + audience), validate all permission strings
 * against the known resource/action taxonomy, and validate the grant audience.
 * Throws {@link ApiTokenValidationError} (→ 400) on any invalid input.
 */
export function buildApiTokenCreateBody(
  body: Record<string, unknown>,
  accessCatalog?: AccessCatalog,
): Record<string, unknown> {
  const selectedAccessCatalog = accessCatalog ?? { resources: [], presets: [] }
  const fields = pickFields(body, API_TOKEN_CREATE_FIELDS)
  const metadata: Record<string, unknown> = isPlainObject(fields.metadata)
    ? { ...fields.metadata }
    : {}

  const presetKey = typeof body.grantPreset === "string" ? body.grantPreset : undefined
  if (presetKey !== undefined) {
    const selectedPreset = selectedAccessCatalog.presets.find(
      (candidate) => candidate.kind === "api-token-grant" && candidate.id === presetKey,
    )
    if (!selectedPreset) {
      const knownPresets = selectedAccessCatalog.presets
        .filter((candidate) => candidate.kind === "api-token-grant")
        .map((candidate) => candidate.id)
        .sort()
      throw new ApiTokenValidationError(
        `Unknown grant preset "${presetKey}". Known presets: ${knownPresets.join(", ")}.`,
      )
    }
    fields.permissions = mergePermissions(
      permissionStringsToPermissions(selectedPreset.grants),
      isPlainObject(fields.permissions) ? (fields.permissions as ApiKeyPermissions) : undefined,
    )
    if (metadata.audience === undefined) {
      metadata.audience = selectedPreset.audience
    }
  }

  if (fields.permissions !== undefined) {
    try {
      assertKnownPermissions(fields.permissions as ApiKeyPermissions, selectedAccessCatalog)
    } catch (error) {
      if (error instanceof UnknownApiKeyPermissionError) {
        throw new ApiTokenValidationError(error.message)
      }
      throw error
    }
  }

  if (metadata.audience !== undefined) {
    if (
      typeof metadata.audience !== "string" ||
      !(API_KEY_AUDIENCES as readonly string[]).includes(metadata.audience)
    ) {
      throw new ApiTokenValidationError(
        `Invalid audience "${String(metadata.audience)}". Allowed: ${API_KEY_AUDIENCES.join(", ")}.`,
      )
    }
    fields.metadata = metadata
  }

  return fields
}
