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
} from "@voyantjs/cloud-sdk"

const CLIENT_CACHE = new WeakMap<object, VoyantCloudClient>()

export type VoyantApiEnv = {
  VOYANT_API_KEY?: string
  VOYANT_CLOUD_API_KEY?: string
  VOYANT_CLOUD_API_URL?: string
  VOYANT_CLOUD_USER_AGENT?: string
}

export function resolveVoyantApiKey(env: VoyantApiEnv): string | undefined {
  return nonEmpty(env.VOYANT_API_KEY) ?? nonEmpty(env.VOYANT_CLOUD_API_KEY)
}

export function getCloudClient(env: VoyantApiEnv): VoyantCloudClient {
  const cached = CLIENT_CACHE.get(env as unknown as object)
  if (cached) return cached
  const apiKey = resolveVoyantApiKey(env)
  const client = getVoyantCloudClient(
    env as unknown as Parameters<typeof getVoyantCloudClient>[0],
    apiKey ? { apiKey } : undefined,
  )
  CLIENT_CACHE.set(env as unknown as object, client)
  return client
}

export function tryGetCloudClient(env: VoyantApiEnv): VoyantCloudClient | null {
  const cached = CLIENT_CACHE.get(env as unknown as object)
  if (cached) return cached
  const apiKey = resolveVoyantApiKey(env)
  const client = tryGetVoyantCloudClient(
    env as unknown as Parameters<typeof tryGetVoyantCloudClient>[0],
    apiKey ? { apiKey } : undefined,
  )
  if (client) CLIENT_CACHE.set(env as unknown as object, client)
  return client
}

function nonEmpty(value: string | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}
