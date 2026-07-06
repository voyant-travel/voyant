import type { R2BucketShim, R2ShimObject } from "./r2.js"

/**
 * An in-process `R2Bucket`-shaped store for local/dev Node runs without S3
 * credentials. Mirrors {@link R2BucketShim} (`put`/`get`/`delete`/`head`) over a
 * `Map<string, StoredObject>`, so the operator's media/document routes work
 * end-to-end offline. Production points {@link createR2BucketShim} at real R2
 * (S3-compatible) or an S3 provider instead — the interface is identical, so
 * `server.ts` swaps one for the other on a credentials check.
 */

interface StoredObject {
  bytes: Uint8Array
  contentType?: string
  customMetadata?: Record<string, string>
}

function bytesToStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
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
  return new Uint8Array(await new Response(value as ReadableStream).arrayBuffer())
}

function toObject(stored: StoredObject): R2ShimObject {
  const { bytes } = stored
  const object: R2ShimObject = {
    // Copy only this view's bytes — `bytes` may be a subarray of a larger
    // backing buffer (e.g. a Node Buffer passed through `StorageProvider.upload`),
    // so returning the whole `.buffer` would leak unrelated bytes.
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    body: bytesToStream(bytes),
    size: bytes.byteLength,
  }
  if (stored.contentType) object.httpMetadata = { contentType: stored.contentType }
  if (stored.customMetadata) object.customMetadata = stored.customMetadata
  return object
}

/** Build an in-memory {@link R2BucketShim} for local/dev runs. */
export function createMemoryR2Bucket(): R2BucketShim {
  const map = new Map<string, StoredObject>()

  return {
    async put(key, value, putOptions) {
      const stored: StoredObject = { bytes: await toBytes(value) }
      if (putOptions?.httpMetadata?.contentType) {
        stored.contentType = putOptions.httpMetadata.contentType
      }
      if (putOptions?.customMetadata) stored.customMetadata = putOptions.customMetadata
      map.set(key, stored)
      return { key }
    },
    async delete(key) {
      const keys = Array.isArray(key) ? key : [key]
      for (const k of keys) map.delete(k)
    },
    async get(key) {
      const stored = map.get(key)
      return stored ? toObject(stored) : null
    },
    async head(key) {
      const stored = map.get(key)
      if (!stored) return null
      const meta: Omit<R2ShimObject, "arrayBuffer" | "body"> = { size: stored.bytes.byteLength }
      if (stored.contentType) meta.httpMetadata = { contentType: stored.contentType }
      if (stored.customMetadata) meta.customMetadata = stored.customMetadata
      return meta
    },
  }
}
