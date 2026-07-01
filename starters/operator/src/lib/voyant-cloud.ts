/**
 * Lazy accessor for the Voyant Cloud SDK client. Other modules (the
 * legal contract PDF generator, future SMS / verification flows)
 * should call `getCloudClient(env)` rather than instantiating their
 * own — the SDK caches state internally and we want a single
 * shared client per isolate.
 *
 * `tryGetCloudClient(env)` returns `null` when `VOYANT_API_KEY`
 * is unset — useful for local dev where the cloud-backed feature
 * (e.g. browser-rendered PDFs) gracefully degrades to the basic
 * pdf-lib fallback rather than crashing the whole worker.
 */

import {
  getVoyantCloudClient,
  tryGetVoyantCloudClient,
  type VoyantCloudClient,
} from "@voyant-travel/cloud-sdk"

const CLIENT_CACHE = new WeakMap<object, VoyantCloudClient>()
type CloudClientEnv = Parameters<typeof getVoyantCloudClient>[0]
type TryCloudClientEnv = Parameters<typeof tryGetVoyantCloudClient>[0]

export type VoyantApiEnv = {
  VOYANT_API_KEY?: unknown
  VOYANT_CLOUD_API_KEY?: unknown
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

export function getCloudClient(env: VoyantApiEnv): VoyantCloudClient {
  const cached = CLIENT_CACHE.get(env)
  if (cached) return cached
  const apiKey = resolveVoyantApiKey(env)
  const client = getVoyantCloudClient(
    asCloudClientEnv(env, apiKey),
    apiKey ? { apiKey } : undefined,
  )
  CLIENT_CACHE.set(env, client)
  return client
}

export function tryGetCloudClient(env: VoyantApiEnv): VoyantCloudClient | null {
  const cached = CLIENT_CACHE.get(env)
  if (cached) return cached
  const apiKey = resolveVoyantApiKey(env)
  const client = tryGetVoyantCloudClient(
    asTryCloudClientEnv(env, apiKey),
    apiKey ? { apiKey } : undefined,
  )
  if (client) CLIENT_CACHE.set(env, client)
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
  return trimmed.length > 0 ? trimmed : undefined
}
