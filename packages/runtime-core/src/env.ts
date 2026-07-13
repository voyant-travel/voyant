import type { KVStore } from "@voyant-travel/utils/cache"

import type { R2BucketShim } from "./r2.js"

export interface NodeEnvBindings {
  /** KV namespace bindings, keyed by the binding name app code reads (e.g. `CACHE`). */
  kv?: Record<string, KVStore>
  /** R2 bucket bindings, keyed by the binding name (e.g. `DOCUMENTS_BUCKET`). */
  r2?: Record<string, R2BucketShim>
  /** Additional concrete provider objects keyed by their env name. */
  extra?: Record<string, unknown>
}

/**
 * The env bag handed to `app.fetch(request, env, ctx)`. On Workers this is the
 * bindings object the runtime injects; on Node we compose it from string
 * process-env vars plus the real provider objects so app code sees the same
 * shape (`env.CACHE`, `env.MEDIA_BUCKET`, …) without any Workers emulation.
 */
export type NodeEnv = Record<string, unknown>

/**
 * Compose the env bag for a Node deployment. All string vars from `processEnv`
 * (undefined values dropped) are spread first, then the KV and R2 providers are
 * attached under their binding names — the same shape the Workers runtime used
 * to inject, so the same `fetch(req, env, ctx)` runs unchanged. Unlike the old
 * bindings emulation, the attached providers are real in-process / S3-backed
 * stores, not shims over a Cloudflare binding.
 *
 * Binding names must not collide with a string var of the same name; the
 * provider wins (a KV/R2 binding is never legitimately also a string).
 *
 * The `Env` type parameter lets a deployment present the bag as its own bindings
 * interface (e.g. the operator's `CloudflareBindings`) at the boundary without a
 * cast at the call site — the runtime bag genuinely carries those string vars +
 * providers.
 */
export function composeNodeEnv<Env = NodeEnv>(
  processEnv: Record<string, string | undefined>,
  bindings: NodeEnvBindings = {},
): Env {
  const env: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(processEnv)) {
    if (value !== undefined) env[key] = value
  }
  for (const [name, provider] of Object.entries(bindings.kv ?? {})) {
    env[name] = provider
  }
  for (const [name, provider] of Object.entries(bindings.r2 ?? {})) {
    env[name] = provider
  }
  for (const [name, provider] of Object.entries(bindings.extra ?? {})) {
    env[name] = provider
  }
  return env as Env
}
