import { presignUrl, type SigV4Credentials, signRequest } from "../lib/sigv4.js"
import type { StorageObject, StorageProvider, StorageUploadBody, UploadOptions } from "../types.js"

/**
 * Fetch shape used by the S3 provider. Matches the global `fetch` and
 * Cloudflare Workers `fetch`. Tests can stub this.
 */
export type S3Fetch = (
  input: string,
  init: {
    method: string
    headers: Record<string, string>
    body?: Uint8Array
  },
) => Promise<{
  ok: boolean
  status: number
  arrayBuffer: () => Promise<ArrayBuffer>
  text: () => Promise<string>
}>

function defaultS3Fetch(input: string, init: Parameters<S3Fetch>[1]): ReturnType<S3Fetch> {
  return globalThis.fetch(input, { ...init, body: init.body as BodyInit | undefined })
}

/**
 * Options for {@link createS3Provider}.
 */
export interface S3ProviderOptions {
  /** AWS access key id. */
  accessKeyId: string
  /** AWS secret access key. */
  secretAccessKey: string
  /** Optional session token for temporary credentials. */
  sessionToken?: string
  /** S3 region (e.g. `"us-east-1"`). */
  region: string
  /** S3 bucket name. */
  bucket: string
  /**
   * Endpoint URL override. Defaults to the public AWS S3 endpoint for the
   * region (`https://s3.<region>.amazonaws.com`). Set this for S3-compatible
   * services (MinIO, Backblaze B2, DigitalOcean Spaces, Wasabi, R2 S3 API).
   */
  endpoint?: string
  /**
   * When `true`, put the bucket in the URL path rather than the hostname
   * subdomain. Defaults to `true` to stay compatible with the widest set
   * of S3-compatible services. Set to `false` to use
   * `https://<bucket>.s3.<region>.amazonaws.com` virtual-hosted style.
   */
  forcePathStyle?: boolean
  /** Base URL used for the public `url` field returned from `upload`. */
  publicBaseUrl?: string
  /** Override `fetch` (e.g. in tests). Defaults to global `fetch`. */
  fetch?: S3Fetch
  /** Provider name (defaults to `"s3"`). */
  name?: string
  /** Custom key generator; defaults to `crypto.randomUUID()`. */
  generateKey?: () => string
}

/**
 * Create an S3 / S3-compatible storage provider. Uses Web Crypto to sign
 * requests with AWS SigV4, so no AWS SDK dependency is required.
 */
export function createS3Provider(options: S3ProviderOptions): StorageProvider {
  const name = options.name ?? "s3"
  const forcePathStyle = options.forcePathStyle ?? true
  const endpoint =
    options.endpoint ??
    (forcePathStyle
      ? `https://s3.${options.region}.amazonaws.com`
      : `https://${options.bucket}.s3.${options.region}.amazonaws.com`)
  const publicBaseUrl = options.publicBaseUrl ?? ""
  const fetchImpl = options.fetch ?? defaultS3Fetch
  const credentials: SigV4Credentials = {
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
  }
  if (options.sessionToken !== undefined) credentials.sessionToken = options.sessionToken

  const generateKey =
    options.generateKey ??
    (() => {
      const g = globalThis as { crypto?: { randomUUID?: () => string } }
      return g.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
    })

  function buildUrl(key: string): string {
    if (forcePathStyle) {
      return `${endpoint}/${encodeURIComponent(options.bucket)}/${encodeKey(key)}`
    }
    return `${endpoint}/${encodeKey(key)}`
  }

  async function upload(body: StorageUploadBody, opts: UploadOptions = {}): Promise<StorageObject> {
    if (!fetchImpl) throw new Error("S3 provider requires a fetch implementation")
    const key = opts.key ?? generateKey()
    const bytes = await toBytes(body)
    const url = buildUrl(key)
    const headers: Record<string, string> = {}
    if (opts.contentType) headers["content-type"] = opts.contentType
    if (opts.metadata) {
      for (const [k, v] of Object.entries(opts.metadata)) {
        headers[`x-amz-meta-${k.toLowerCase()}`] = v
      }
    }
    const signed = await signRequest({
      method: "PUT",
      url,
      headers,
      body: bytes,
      credentials,
      region: options.region,
      service: "s3",
    })
    const response = await fetchImpl(url, {
      method: "PUT",
      headers: signed.headers,
      body: bytes,
    })
    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(`S3 upload failed (${response.status}): ${text}`)
    }
    return { key, url: publicBaseUrl ? `${publicBaseUrl}${key}` : "" }
  }

  return {
    name,
    upload,
    async delete(key) {
      if (!fetchImpl) throw new Error("S3 provider requires a fetch implementation")
      const url = buildUrl(key)
      const signed = await signRequest({
        method: "DELETE",
        url,
        credentials,
        region: options.region,
        service: "s3",
      })
      const response = await fetchImpl(url, {
        method: "DELETE",
        headers: signed.headers,
      })
      // S3 returns 204 on successful delete, 404 on missing — treat both as success.
      if (!response.ok && response.status !== 404) {
        const text = await response.text().catch(() => "")
        throw new Error(`S3 delete failed (${response.status}): ${text}`)
      }
    },
    async signedUrl(key, expiresIn) {
      return presignUrl({
        method: "GET",
        url: buildUrl(key),
        expiresIn,
        credentials,
        region: options.region,
        service: "s3",
      })
    },
    async get(key) {
      if (!fetchImpl) throw new Error("S3 provider requires a fetch implementation")
      const url = buildUrl(key)
      const signed = await signRequest({
        method: "GET",
        url,
        credentials,
        region: options.region,
        service: "s3",
      })
      const response = await fetchImpl(url, {
        method: "GET",
        headers: signed.headers,
      })
      if (response.status === 404) return null
      if (!response.ok) {
        const text = await response.text().catch(() => "")
        throw new Error(`S3 get failed (${response.status}): ${text}`)
      }
      return response.arrayBuffer()
    },
  }
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

async function toBytes(body: StorageUploadBody): Promise<Uint8Array> {
  if (body instanceof Uint8Array) return body
  if (body instanceof ArrayBuffer) return new Uint8Array(body)
  const buffer = await body.arrayBuffer()
  return new Uint8Array(buffer)
}
