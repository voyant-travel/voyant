/**
 * Lazy accessor for the Voyant Cloud SDK client. Other modules should call the
 * resolver for the capability they need rather than instantiating their own
 * client. The SDK caches state internally and we keep one shared client per
 * env/key pair per isolate.
 *
 * `tryGetCloudClient(env)` returns `null` when `VOYANT_API_KEY` is unset. More
 * specific helpers such as `tryGetCloudPdfClient(env)` intentionally use their
 * own env vars so local/self-hosted deployments can enable one Cloud-backed
 * concern without accidentally enabling another.
 */

import {
  getVoyantCloudClient,
  tryGetVoyantCloudClient,
  type VoyantCloudClient,
} from "@voyant-travel/cloud-sdk"

const CLIENT_CACHE = new WeakMap<object, Map<string, VoyantCloudClient>>()
const LOCAL_PLACEHOLDER_KEYS = new Set(["local-dev"])
type CloudClientEnv = Parameters<typeof getVoyantCloudClient>[0]
type TryCloudClientEnv = Parameters<typeof tryGetVoyantCloudClient>[0]

export type VoyantApiEnv = {
  VOYANT_API_KEY?: unknown
  VOYANT_CLOUD_API_KEY?: unknown
  VOYANT_CLOUD_PDF_API_KEY?: unknown
  VOYANT_DATA_API_KEY?: unknown
  VOYANT_CLOUD_API_URL?: unknown
  VOYANT_CLOUD_USER_AGENT?: unknown
  VOYANT_ADMIN_AUTH_MODE?: unknown
}

export function resolveVoyantApiKey(env: VoyantApiEnv): string | undefined {
  return nonEmpty(env.VOYANT_API_KEY) ?? nonEmpty(env.VOYANT_CLOUD_API_KEY)
}

export function isVoyantCloudAdminAuthMode(env: VoyantApiEnv): boolean {
  return nonEmpty(env.VOYANT_ADMIN_AUTH_MODE) === "voyant-cloud"
}

export function resolveVoyantDataApiKey(env: VoyantApiEnv): string | undefined {
  return nonEmpty(env.VOYANT_DATA_API_KEY) ?? cloudModeLegacyApiKey(env)
}

export function resolveVoyantCloudPdfApiKey(env: VoyantApiEnv): string | undefined {
  return nonEmpty(env.VOYANT_CLOUD_PDF_API_KEY) ?? cloudModeLegacyApiKey(env)
}

export function getCloudClient(env: VoyantApiEnv): VoyantCloudClient {
  const apiKey = resolveVoyantApiKey(env)
  const cached = getCachedClient(env, apiKey)
  if (cached) return cached
  const client = getVoyantCloudClient(
    asCloudClientEnv(env, apiKey),
    apiKey ? { apiKey } : undefined,
  )
  setCachedClient(env, apiKey, client)
  return client
}

export function tryGetCloudClient(env: VoyantApiEnv): VoyantCloudClient | null {
  const apiKey = resolveVoyantApiKey(env)
  const cached = getCachedClient(env, apiKey)
  if (cached) return cached
  const client = tryGetVoyantCloudClient(
    asTryCloudClientEnv(env, apiKey),
    apiKey ? { apiKey } : undefined,
  )
  if (client) setCachedClient(env, apiKey, client)
  return client
}

export function tryGetCloudPdfClient(env: VoyantApiEnv): VoyantCloudClient | null {
  const apiKey = resolveVoyantCloudPdfApiKey(env)
  const cached = getCachedClient(env, apiKey)
  if (cached) return cached
  const client = tryGetVoyantCloudClient(
    asTryCloudClientEnv(env, apiKey),
    apiKey ? { apiKey } : undefined,
  )
  if (client) setCachedClient(env, apiKey, client)
  return client
}

function asCloudClientEnv(env: VoyantApiEnv, apiKey: string | undefined): CloudClientEnv {
  return sanitizeCloudClientEnv(env, apiKey) as CloudClientEnv
}

function asTryCloudClientEnv(env: VoyantApiEnv, apiKey: string | undefined): TryCloudClientEnv {
  return sanitizeCloudClientEnv(env, apiKey) as TryCloudClientEnv
}

function sanitizeCloudClientEnv(
  env: VoyantApiEnv,
  apiKey: string | undefined,
): Pick<VoyantApiEnv, "VOYANT_CLOUD_API_KEY" | "VOYANT_CLOUD_API_URL" | "VOYANT_CLOUD_USER_AGENT"> {
  const baseUrl = nonEmpty(env.VOYANT_CLOUD_API_URL)
  const userAgent = nonEmpty(env.VOYANT_CLOUD_USER_AGENT)
  return {
    ...(apiKey ? { VOYANT_CLOUD_API_KEY: apiKey } : {}),
    ...(baseUrl ? { VOYANT_CLOUD_API_URL: baseUrl } : {}),
    ...(userAgent ? { VOYANT_CLOUD_USER_AGENT: userAgent } : {}),
  }
}

function nonEmpty(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0) return undefined
  return LOCAL_PLACEHOLDER_KEYS.has(trimmed) ? undefined : trimmed
}

function cloudModeLegacyApiKey(env: VoyantApiEnv): string | undefined {
  return isVoyantCloudAdminAuthMode(env) ? resolveVoyantApiKey(env) : undefined
}

function cacheKey(apiKey: string | undefined): string {
  return apiKey ?? ""
}

function getCachedClient(env: VoyantApiEnv, apiKey: string | undefined): VoyantCloudClient | null {
  if (!apiKey) return null
  return CLIENT_CACHE.get(env)?.get(cacheKey(apiKey)) ?? null
}

function setCachedClient(
  env: VoyantApiEnv,
  apiKey: string | undefined,
  client: VoyantCloudClient,
): void {
  if (!apiKey) return
  const existing = CLIENT_CACHE.get(env)
  if (existing) {
    existing.set(cacheKey(apiKey), client)
    return
  }
  CLIENT_CACHE.set(env, new Map([[cacheKey(apiKey), client]]))
}
