import type { KvNamespaceShim } from "./kv.js"
import type { R2BucketShim } from "./r2.js"

export interface BuildDedicatedEnvBindings {
  /** KV namespace bindings, keyed by the binding name app code reads (e.g. `CACHE`). */
  kv?: Record<string, KvNamespaceShim>
  /** R2 bucket bindings, keyed by the binding name (e.g. `DOCUMENTS_BUCKET`). */
  r2?: Record<string, R2BucketShim>
}

/**
 * The env bag handed to `app.fetch(request, env, ctx)`. On Workers this is the
 * bindings object the runtime injects; on Node we compose it from string
 * process-env vars plus the shim objects so app code sees the same shape.
 */
export type DedicatedEnv = Record<string, string | KvNamespaceShim | R2BucketShim>

/**
 * Compose the env bag for a dedicated (Node) deployment. All string vars from
 * `processEnv` (undefined values dropped) are spread first, then KV and R2
 * shims are attached under their binding names — mirroring exactly what the
 * Workers runtime provides, so the same `fetch(req, env, ctx)` runs unchanged.
 *
 * Binding names must not collide with a string var of the same name; the shim
 * wins (a KV/R2 binding is never legitimately also a string).
 */
export function buildDedicatedEnv(
  processEnv: Record<string, string | undefined>,
  bindings: BuildDedicatedEnvBindings = {},
): DedicatedEnv {
  const env: DedicatedEnv = {}
  for (const [key, value] of Object.entries(processEnv)) {
    if (value !== undefined) env[key] = value
  }
  for (const [name, shim] of Object.entries(bindings.kv ?? {})) {
    env[name] = shim
  }
  for (const [name, shim] of Object.entries(bindings.r2 ?? {})) {
    env[name] = shim
  }
  return env
}
