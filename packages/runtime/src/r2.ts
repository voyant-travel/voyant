import { signRequest } from "@voyant-travel/storage/lib/sigv4"
import type {
  R2BucketLike,
  R2ObjectLike,
  R2PutOptionsLike,
} from "@voyant-travel/storage/providers/r2"

/**
 * An `R2Bucket`-shaped client backed by R2's S3-compatible API. Signing reuses
 * `@voyant-travel/storage`'s SigV4 implementation (verified against AWS test
 * vectors) rather than reimplementing it here. The shim satisfies the
 * structural {@link R2BucketLike} the storage providers depend on, plus the
 * richer `bucket.get(key) -> { arrayBuffer(), body, httpMetadata }` surface the
 * operator's document routes use.
 */
export type R2Fetch = typeof fetch

/** The object returned by {@link R2BucketShim.get}. Superset of {@link R2ObjectLike}. */
export interface R2ShimObject extends R2ObjectLike {
  /** Buffered body bytes, re-readable as a stream. */
  body: ReadableStream<Uint8Array> | null
  httpMetadata?: { contentType?: string }
  customMetadata?: Record<string, string>
  size: number
}

export interface R2BucketShim extends R2BucketLike {
  get(key: string): Promise<R2ShimObject | null>
  head(key: string): Promise<Omit<R2ShimObject, "arrayBuffer" | "body"> | null>
}

export interface R2BucketShimOptions {
  /** R2 S3 endpoint, e.g. `https://<accountid>.r2.cloudflarestorage.com`. */
  endpoint: string
  /** Bucket name. */
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  /** S3 region — R2 ignores it but SigV4 requires one. Defaults to `"auto"`. */
  region?: string
  /** Override the fetch implementation (tests / custom agents). */
  fetchImpl?: R2Fetch
}

const CUSTOM_META_PREFIX = "x-amz-meta-"

/**
 * Build an {@link R2BucketShim} over the R2 S3-compatible API.
 */
export function createR2BucketShim(options: R2BucketShimOptions): R2BucketShim {
  const fetchImpl = options.fetchImpl ?? fetch
  const region = options.region ?? "auto"
  const endpoint = options.endpoint.replace(/\/$/, "")
  const credentials = {
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
  }

  function objectUrl(key: string): string {
    return `${endpoint}/${encodeURIComponent(options.bucket)}/${encodeKey(key)}`
  }

  async function send(
    method: string,
    key: string,
    init: { headers?: Record<string, string>; body?: Uint8Array } = {},
  ): Promise<Response> {
    const url = objectUrl(key)
    const signed = await signRequest({
      method,
      url,
      headers: init.headers,
      body: init.body,
      credentials,
      region,
      service: "s3",
    })
    return fetchImpl(url, {
      method,
      headers: signed.headers,
      body: init.body as BodyInit | undefined,
    })
  }

  function readMetadata(response: Response): {
    httpMetadata?: { contentType?: string }
    customMetadata?: Record<string, string>
    size: number
  } {
    const contentType = response.headers.get("content-type") ?? undefined
    const customMetadata: Record<string, string> = {}
    response.headers.forEach((value, name) => {
      if (name.toLowerCase().startsWith(CUSTOM_META_PREFIX)) {
        customMetadata[name.slice(CUSTOM_META_PREFIX.length)] = value
      }
    })
    const contentLength = response.headers.get("content-length")
    const result: {
      httpMetadata?: { contentType?: string }
      customMetadata?: Record<string, string>
      size: number
    } = { size: contentLength ? Number.parseInt(contentLength, 10) : 0 }
    if (contentType !== undefined) result.httpMetadata = { contentType }
    if (Object.keys(customMetadata).length > 0) result.customMetadata = customMetadata
    return result
  }

  return {
    async put(key, value, putOptions) {
      const bytes = await toBytes(value)
      const headers = putHeaders(putOptions)
      const response = await send("PUT", key, { headers, body: bytes })
      if (!response.ok) {
        const text = await response.text().catch(() => "")
        throw new Error(`R2 put failed (${response.status}): ${text}`)
      }
      return { key }
    },
    async delete(key) {
      const keys = Array.isArray(key) ? key : [key]
      for (const k of keys) {
        const response = await send("DELETE", k)
        // 204 on success, 404 on missing — both are effectively "gone".
        if (!response.ok && response.status !== 404) {
          const text = await response.text().catch(() => "")
          throw new Error(`R2 delete failed (${response.status}): ${text}`)
        }
      }
    },
    async get(key) {
      const response = await send("GET", key)
      if (response.status === 404) return null
      if (!response.ok) {
        const text = await response.text().catch(() => "")
        throw new Error(`R2 get failed (${response.status}): ${text}`)
      }
      const buffer = await response.arrayBuffer()
      const meta = readMetadata(response)
      const object: R2ShimObject = {
        arrayBuffer: async () => buffer.slice(0),
        body: bytesToStream(new Uint8Array(buffer)),
        size: meta.size || buffer.byteLength,
      }
      if (meta.httpMetadata) object.httpMetadata = meta.httpMetadata
      if (meta.customMetadata) object.customMetadata = meta.customMetadata
      return object
    },
    async head(key) {
      const response = await send("HEAD", key)
      if (response.status === 404) return null
      if (!response.ok) {
        const text = await response.text().catch(() => "")
        throw new Error(`R2 head failed (${response.status}): ${text}`)
      }
      return readMetadata(response)
    },
  }
}

function putHeaders(putOptions?: R2PutOptionsLike): Record<string, string> {
  const headers: Record<string, string> = {}
  if (putOptions?.httpMetadata?.contentType) {
    headers["content-type"] = putOptions.httpMetadata.contentType
  }
  if (putOptions?.customMetadata) {
    for (const [k, v] of Object.entries(putOptions.customMetadata)) {
      headers[`${CUSTOM_META_PREFIX}${k.toLowerCase()}`] = v
    }
  }
  return headers
}

function encodeKey(key: string): string {
  return key
    .split("/")
    .map((segment) =>
      encodeURIComponent(segment).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join("/")
}

async function toBytes(
  value: ArrayBuffer | ArrayBufferView | Blob | string | ReadableStream | null,
): Promise<Uint8Array> {
  if (value === null) return new Uint8Array()
  if (typeof value === "string") return new TextEncoder().encode(value)
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer())
  // ReadableStream
  return new Uint8Array(await new Response(value as ReadableStream).arrayBuffer())
}

function bytesToStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}
