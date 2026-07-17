import { ApiHttpError } from "@voyant-travel/hono"
import type { AccessCatalog } from "@voyant-travel/types/api-keys"
import type { AppRelease } from "./schema.js"

export interface ConsentComputationInput {
  release: AppRelease
  accessCatalog: AccessCatalog
  operatorGrantedScopes: readonly string[]
  grantedOptionalScopes?: readonly string[]
}

export interface ComputedConsent {
  requiredScopes: string[]
  optionalScopes: string[]
  grantedScopes: string[]
  deniedOptionalScopes: string[]
}

export function computeAppConsent(input: ConsentComputationInput): ComputedConsent {
  const normalized = parseReleaseScopes(input.release.normalizedRecord)
  const remoteSafe = remoteSafeScopes(input.accessCatalog)
  const operatorGranted = new Set(input.operatorGrantedScopes)
  const optionalGrantRequest = new Set(input.grantedOptionalScopes ?? [])

  const requiredScopes = normalized.requestedScopes.filter((scope) =>
    canGrantScope(scope, remoteSafe, operatorGranted),
  )
  const missingRequired = normalized.requestedScopes.filter(
    (scope) => !requiredScopes.includes(scope),
  )
  if (missingRequired.length > 0) {
    throw new ApiHttpError("Required app scopes are not grantable for remote apps", {
      status: 403,
      code: "app_required_scope_not_grantable",
      details: { scopes: missingRequired },
    })
  }

  const optionalScopes = normalized.optionalScopes.filter((scope) =>
    canGrantScope(scope, remoteSafe, operatorGranted),
  )
  const grantedOptional = optionalScopes.filter((scope) => optionalGrantRequest.has(scope))
  const deniedOptionalScopes = normalized.optionalScopes.filter(
    (scope) => !grantedOptional.includes(scope),
  )
  const grantedScopes = Array.from(new Set([...requiredScopes, ...grantedOptional])).sort()

  return {
    requiredScopes: requiredScopes.sort(),
    optionalScopes: optionalScopes.sort(),
    grantedScopes,
    deniedOptionalScopes: deniedOptionalScopes.sort(),
  }
}

function canGrantScope(scope: string, remoteSafe: Set<string>, operatorGranted: Set<string>) {
  return remoteSafe.has(scope) && operatorGranted.has(scope)
}

function remoteSafeScopes(catalog: AccessCatalog): Set<string> {
  const catalogScopes = new Set(
    catalog.resources.flatMap((resource) =>
      resource.actions.map((action) => `${resource.resource}:${action.action}`),
    ),
  )
  const presetScopes = catalog.presets
    .filter((preset) => preset.kind === "api-token-grant" && Boolean(preset.audience))
    .flatMap((preset) => preset.grants)
  return new Set(presetScopes.filter((scope) => catalogScopes.has(scope)))
}

function parseReleaseScopes(value: unknown): {
  requestedScopes: string[]
  optionalScopes: string[]
} {
  if (!value || typeof value !== "object") return { requestedScopes: [], optionalScopes: [] }
  const record = value as Record<string, unknown>
  return {
    requestedScopes: stringArray(record.requestedScopes),
    optionalScopes: stringArray(record.optionalScopes),
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((item): item is string => typeof item === "string"))).sort()
    : []
}
