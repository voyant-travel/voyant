import type { StorageObject, StorageProvider, StorageUploadBody, UploadOptions } from "../types.js"

/**
 * Subset of the Cloudflare Workers `R2Bucket` binding we depend on. Kept
 * as a minimal structural type so this package does not need a runtime
 * dependency on `@cloudflare/workers-types`.
 */
export interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | Blob | string | ReadableStream | null,
    options?: R2PutOptionsLike,
  ): Promise<unknown>
  delete(key: string | string[]): Promise<void>
  get(key: string): Promise<R2ObjectLike | null>
}

export interface R2PutOptionsLike {
  httpMetadata?: { contentType?: string }
  customMetadata?: Record<string, string>
}

export interface R2ObjectLike {
  arrayBuffer(): Promise<ArrayBuffer>
}

/**
 * Options for {@link createR2Provider}.
 */
export interface R2ProviderOptions {
  /** Cloudflare R2 bucket binding (from `env.BUCKET_NAME`). */
  bucket: R2BucketLike
  /**
   * Base URL used to construct public object URLs. Typical values:
   * - a public R2 custom domain: `https://cdn.example.com/`
   * - a Worker route that proxies to the binding: `https://api.example.com/assets/`
   */
  publicBaseUrl?: string
  /**
   * Signer invoked by `signedUrl`. Cloudflare R2 bindings do not produce
   * signed URLs directly; templates pass a custom signer that either:
   *   - returns a short-lived Worker route URL, or
   *   - calls R2's S3-compatible API with SigV4 credentials.
   * When omitted, `signedUrl` returns `${publicBaseUrl}${key}`. Calling
   * `signedUrl` without either a signer or public base URL is a
   * configuration error because a raw R2 object key is not a URL.
   */
  signer?: (key: string, expiresIn: number) => Promise<string> | string
  /** Provider name (defaults to `"r2"`). */
  name?: string
  /** Custom key generator; defaults to `crypto.randomUUID()`. */
  generateKey?: () => string
}

/**
 * Create a Cloudflare R2 storage provider bound to an R2 bucket binding.
 * The R2 binding handles authentication transparently at the Worker
 * runtime boundary, so no credentials are required at this layer.
 */
export function createR2Provider(options: R2ProviderOptions): StorageProvider {
  const name = options.name ?? "r2"
  const publicBaseUrl = options.publicBaseUrl ?? ""
  const generateKey =
    options.generateKey ??
    (() => {
      const g = globalThis as { crypto?: { randomUUID?: () => string } }
      return g.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
    })

  async function upload(body: StorageUploadBody, opts: UploadOptions = {}): Promise<StorageObject> {
    const key = opts.key ?? generateKey()
    const putOptions: R2PutOptionsLike = {}
    if (opts.contentType !== undefined) {
      putOptions.httpMetadata = { contentType: opts.contentType }
    }
    if (opts.metadata !== undefined) {
      putOptions.customMetadata = opts.metadata
    }
    await options.bucket.put(key, await toPutBody(body), putOptions)
    return { key, url: publicBaseUrl ? `${publicBaseUrl}${key}` : "" }
  }

  return {
    name,
    upload,
    async delete(key) {
      await options.bucket.delete(key)
    },
    async signedUrl(key, expiresIn) {
      if (options.signer) return options.signer(key, expiresIn)
      if (!publicBaseUrl) {
        throw new Error(
          "R2 provider: signedUrl requires either `publicBaseUrl` or `signer` to be configured",
        )
      }
      return `${publicBaseUrl}${key}`
    },
    async get(key) {
      const obj = await options.bucket.get(key)
      if (!obj) return null
      return obj.arrayBuffer()
    },
  }
}

async function toPutBody(body: StorageUploadBody): Promise<ArrayBuffer | ArrayBufferView | Blob> {
  if (body instanceof Uint8Array) return body
  if (body instanceof ArrayBuffer) return body
  return body
}
