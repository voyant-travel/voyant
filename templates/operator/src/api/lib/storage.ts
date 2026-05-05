import type { StorageProvider } from "@voyantjs/storage"
import { createR2Provider } from "@voyantjs/storage/providers/r2"

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
  xml: "application/xml",
  zip: "application/zip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

/** Best-effort MIME type guess from a file key/path. Used by the /v1/media/* serve route. */
export function guessMimeType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? ""
  return MIME_BY_EXT[ext] ?? "application/octet-stream"
}

function createR2BucketStorage(
  bucket: R2Bucket | undefined,
  options: {
    publicBaseUrl?: string
  } = {},
): StorageProvider | null {
  if (!bucket) return null

  return createR2Provider({
    bucket,
    ...(options.publicBaseUrl ? { publicBaseUrl: options.publicBaseUrl } : {}),
  })
}

const DEFAULT_DOCUMENT_URL_EXPIRES_IN = 60 * 5

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

/**
 * Resolve the media storage provider from the environment.
 *
 * This is the single place to swap storage backends. The default uses
 * **Cloudflare R2 via the Workers binding** (`MEDIA_BUCKET`) — the native,
 * zero-signing path. Alternatives:
 *
 *   - **R2 via S3 API** (if you need cross-cloud parity or signed URLs):
 *     ```ts
 *     import { createS3Provider } from "@voyantjs/storage/providers/s3"
 *     return createS3Provider({
 *       accessKeyId: env.R2_ACCESS_KEY_ID!,
 *       secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
 *       region: "auto",
 *       bucket: env.R2_BUCKET!,
 *       endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
 *     })
 *     ```
 *
 *   - **AWS S3 / S3-compatible** (Wasabi, MinIO, Backblaze B2, Spaces, etc.):
 *     ```ts
 *     return createS3Provider({
 *       accessKeyId: env.S3_ACCESS_KEY_ID!,
 *       secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
 *       region: env.S3_REGION ?? "us-east-1",
 *       bucket: env.S3_BUCKET!,
 *       endpoint: env.S3_ENDPOINT, // optional, for S3-compatible services
 *       publicBaseUrl: `${appUrl}/api/v1/media/`,
 *     })
 *     ```
 *
 *   - **Local in-memory** (dev/tests only):
 *     ```ts
 *     import { createLocalStorageProvider } from "@voyantjs/storage/providers/local"
 *     return createLocalStorageProvider({ baseUrl: `${appUrl}/api/v1/media/` })
 *     ```
 *
 *   - **Custom** (GCS, Azure Blob, etc.): Implement the `StorageProvider`
 *     interface (upload/delete/signedUrl/get) and return it here.
 *
 * Returns `null` when no storage is configured — the upload/serve routes
 * will respond with 503.
 */
export function createMediaStorage(env: CloudflareBindings): StorageProvider | null {
  const appUrl = env.APP_URL?.replace(/\/api$/, "") ?? ""
  return createR2BucketStorage(env.MEDIA_BUCKET, {
    publicBaseUrl: `${appUrl}/api/v1/media/`,
  })
}

/**
 * Resolve the private document storage provider from the environment.
 *
 * Documents default to a private R2 bucket binding (`DOCUMENTS_BUCKET`) with
 * no public base URL. Consumers should access files through fresh signed URLs
 * or authenticated application routes, not stable public URLs.
 *
 * Returns `null` when no private document storage is configured.
 */
export function createDocumentStorage(env: CloudflareBindings): StorageProvider | null {
  return createR2BucketStorage(env.DOCUMENTS_BUCKET)
}

export async function readDocumentContentBase64(
  env: CloudflareBindings,
  storageKey: string,
): Promise<string | null> {
  const object = await env.DOCUMENTS_BUCKET?.get(storageKey)
  if (!object) return null
  return arrayBufferToBase64(await object.arrayBuffer())
}

export async function resolveDocumentDownloadUrl(
  env: CloudflareBindings,
  storageKey: string,
  expiresIn = DEFAULT_DOCUMENT_URL_EXPIRES_IN,
): Promise<string | null> {
  const storage = createDocumentStorage(env)
  if (!storage) return null
  const signed = await storage.signedUrl(storageKey, expiresIn)
  // R2's bucket binding doesn't natively produce signed URLs — the
  // storage provider's `signedUrl` falls back to returning the raw
  // storage key when no SigV4 signer is configured. That's not a
  // usable URL: a redirect to "contracts/cont_…/contract.pdf"
  // resolves relative to the request URL and 404s.
  //
  // Detect the "key passed through" case (no scheme prefix) and
  // rewrite it to an ABSOLUTE URL on the operator's
  // `/v1/admin/documents/files/*` streaming proxy. Prefer
  // DOCUMENTS_BASE_URL when set because external systems (Cloud email
  // attachments, Cloudflare Browser Rendering, Resend, etc.) cannot
  // fetch localhost. Fall back to APP_URL for local browser/admin
  // flows. Use an absolute URL — not a root-relative path — because:
  //   1. The Vite dev server mounts the API under `/api`, but the
  //      worker mounts its routes under `/v1/...`. A redirect to
  //      `/v1/admin/...` lands on the SPA's 404 handler instead of
  //      the API; only `${APP_URL}/v1/admin/...` reaches the worker.
  //   2. Production deploys may host the API on a separate origin
  //      from the dashboard — a relative path can't bridge that.
  // In production with a real S3 signer, the signed `https://…`
  // URL is returned as-is and used directly without any rewrite.
  if (signed && /^https?:\/\//i.test(signed)) {
    return signed
  }
  if (!signed) return null
  const apiBase = (
    env.DOCUMENTS_BASE_URL?.trim() ||
    env.APP_URL?.trim() ||
    env.API_BASE_URL?.trim() ||
    ""
  ).replace(/\/$/, "")
  if (!apiBase) {
    // Without a configured API base we have no way to compose an
    // absolute URL. Fall back to a root-relative URL with no `/api`
    // prefix — same-origin same-path deploys (no SPA mount) will
    // work; reverse-proxied deploys won't, but that's a configuration
    // issue surfaced as a 404, not a silent corruption.
    return `/v1/admin/documents/files/${encodeStorageKeyPath(signed)}`
  }
  return `${apiBase}/v1/admin/documents/files/${encodeStorageKeyPath(signed)}`
}

function encodeStorageKeyPath(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}
