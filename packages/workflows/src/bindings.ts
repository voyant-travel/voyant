// @voyantjs/workflows/bindings
//
// Runtime binding shim. Edge runtime passes through to native CF bindings;
// container runtime makes authenticated HTTPS calls to CF's per-binding APIs.
//
// Contract defined in docs/sdk-surface.md §9 and docs/design.md §5.2.

// Types intentionally mirror Cloudflare's native binding shapes so the
// same code runs on edge and container runtimes. Runtime behavior is
// provided by the platform (native bindings on Workers; an HTTPS shim
// on the container runtime) — this package is the shared type surface.

export interface Env {
  [key: string]: Binding
}

export type Binding = D1Database | R2Bucket | KVNamespace | Queue<unknown> | string // secrets

export interface D1Database {
  prepare(sql: string): D1PreparedStatement
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>
  exec(sql: string): Promise<D1ExecResult>
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(column?: string): Promise<T | null>
  run(): Promise<D1Result>
  all<T = unknown>(): Promise<{ results: T[]; meta: D1Meta }>
  /** Per-step-invocation read cache. */
  memoize(): D1PreparedStatement
}

export interface D1Result {
  success: boolean
  meta: D1Meta
  results?: unknown[]
}

export interface D1ExecResult {
  count: number
  duration: number
}

export interface D1Meta {
  duration: number
  rows_read: number
  rows_written: number
}

export interface R2Bucket {
  get(key: string, opts?: R2GetOptions): Promise<R2Object | null>
  put(key: string, value: R2PutBody, opts?: R2PutOptions): Promise<R2Object>
  delete(keys: string | string[]): Promise<void>
  list(opts?: R2ListOptions): Promise<R2Objects>
  head(key: string): Promise<R2Object | null>
}

export interface R2GetOptions {
  range?: { offset?: number; length?: number }
  onlyIf?: { etagMatches?: string }
}
export interface R2PutOptions {
  httpMetadata?: Record<string, string>
  customMetadata?: Record<string, string>
}
export type R2PutBody = ReadableStream | ArrayBuffer | string
export interface R2Object {
  key: string
  size: number
  etag: string
  httpMetadata?: Record<string, string>
  customMetadata?: Record<string, string>
  body?: ReadableStream
  arrayBuffer(): Promise<ArrayBuffer>
  text(): Promise<string>
  json<T = unknown>(): Promise<T>
}
export interface R2ListOptions {
  prefix?: string
  cursor?: string
  limit?: number
}
export interface R2Objects {
  objects: R2Object[]
  truncated: boolean
  cursor?: string
}

export interface KVNamespace {
  get<T = string>(key: string, opts?: KVGetOptions<T>): Promise<T | null>
  put(key: string, value: string | ArrayBuffer, opts?: KVPutOptions): Promise<void>
  delete(key: string): Promise<void>
  list(opts?: KVListOptions): Promise<KVList>
}

export interface KVGetOptions<T> {
  type?: T extends string ? "text" : "json" | "arrayBuffer" | "stream"
}
export interface KVPutOptions {
  expiration?: number
  expirationTtl?: number
  metadata?: Record<string, unknown>
}
export interface KVListOptions {
  prefix?: string
  cursor?: string
  limit?: number
}
export interface KVList {
  keys: { name: string; expiration?: number; metadata?: unknown }[]
  list_complete: boolean
  cursor?: string
}

export interface Queue<T> {
  send(message: T, opts?: { delaySeconds?: number }): Promise<void>
  sendBatch(messages: readonly T[]): Promise<void>
}

/**
 * The environment object tenant code reads bindings from.
 *
 * On the edge runtime, this is a pass-through to the tenant worker's
 * `env` parameter (CF Workers). On the container runtime, the
 * platform injects HTTP-based clients that mimic the shapes above.
 */
export const env: Env = new Proxy({} as Env, {
  get(_, key: string): Binding {
    throw new Error(
      `@voyantjs/workflows/bindings: env.${key} was accessed outside a workflow / step body. ` +
        `Bindings are injected by the runtime — see docs/sdk-surface.md §9.`,
    )
  },
})
