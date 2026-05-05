/**
 * Lazy accessor for the Voyant Cloud SDK client. Other modules (the
 * legal contract PDF generator, future SMS / verification flows)
 * should call `getCloudClient(env)` rather than instantiating their
 * own — the SDK caches state internally and we want a single
 * shared client per isolate.
 *
 * `tryGetCloudClient(env)` returns `null` when `VOYANT_CLOUD_API_KEY`
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

export function getCloudClient(env: CloudflareBindings): VoyantCloudClient {
  const cached = CLIENT_CACHE.get(env as unknown as object)
  if (cached) return cached
  const client = getVoyantCloudClient(env as unknown as Parameters<typeof getVoyantCloudClient>[0])
  CLIENT_CACHE.set(env as unknown as object, client)
  return client
}

export function tryGetCloudClient(env: CloudflareBindings): VoyantCloudClient | null {
  const cached = CLIENT_CACHE.get(env as unknown as object)
  if (cached) return cached
  const client = tryGetVoyantCloudClient(
    env as unknown as Parameters<typeof tryGetVoyantCloudClient>[0],
  )
  if (client) CLIENT_CACHE.set(env as unknown as object, client)
  return client
}
