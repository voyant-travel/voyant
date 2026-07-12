import { getVoyantCloudClient, type VoyantCloudClient } from "@voyant-travel/cloud-sdk"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"

import { createR2Provider, type R2BucketLike } from "./providers/r2.js"
import type { MediaRoutesOptions, VideoUploadTicketRequest } from "./routes.js"
import type { StorageProvider } from "./types.js"

export type StorageRuntimeEnv = Readonly<
  Partial<
    Record<
      | "API_BASE_URL"
      | "APP_URL"
      | "DOCUMENTS_BASE_URL"
      | "DOCUMENTS_BUCKET"
      | "MEDIA_BUCKET"
      | "VOYANT_API_KEY"
      | "VOYANT_CLOUD_API_KEY"
      | "VOYANT_CLOUD_API_URL"
      | "VOYANT_CLOUD_USER_AGENT",
      unknown
    >
  >
>
type RuntimeEnv = StorageRuntimeEnv
type StorageRuntimePrimitives = Pick<VoyantRuntimeHostPrimitives, "env">

const CLIENT_CACHE = new WeakMap<object, Map<string, VoyantCloudClient>>()
const LOCAL_PLACEHOLDER_KEYS = new Set(["local-dev"])

const MIME_BY_EXT: Readonly<Record<string, string>> = {
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

function nonEmpty(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 && !LOCAL_PLACEHOLDER_KEYS.has(trimmed) ? trimmed : undefined
}

function resolveVoyantApiKey(env: RuntimeEnv): string | undefined {
  return nonEmpty(env.VOYANT_API_KEY) ?? nonEmpty(env.VOYANT_CLOUD_API_KEY)
}

function getCloudClient(env: RuntimeEnv): VoyantCloudClient {
  const apiKey = resolveVoyantApiKey(env)
  const cacheOwner = env as object
  const cached = apiKey ? CLIENT_CACHE.get(cacheOwner)?.get(apiKey) : undefined
  if (cached) return cached

  const baseUrl = nonEmpty(env.VOYANT_CLOUD_API_URL)
  const userAgent = nonEmpty(env.VOYANT_CLOUD_USER_AGENT)
  const client = getVoyantCloudClient(
    {
      ...(apiKey ? { VOYANT_CLOUD_API_KEY: apiKey } : {}),
      ...(baseUrl ? { VOYANT_CLOUD_API_URL: baseUrl } : {}),
      ...(userAgent ? { VOYANT_CLOUD_USER_AGENT: userAgent } : {}),
    },
    apiKey ? { apiKey } : undefined,
  )
  if (apiKey) {
    const clients = CLIENT_CACHE.get(cacheOwner) ?? new Map<string, VoyantCloudClient>()
    clients.set(apiKey, client)
    CLIENT_CACHE.set(cacheOwner, clients)
  }
  return client
}

function bucket(env: RuntimeEnv, key: "MEDIA_BUCKET" | "DOCUMENTS_BUCKET") {
  return env[key] as R2BucketLike | undefined
}

function createR2BucketStorage(
  storageBucket: R2BucketLike | undefined,
  options: { publicBaseUrl?: string } = {},
): StorageProvider | null {
  if (!storageBucket) return null
  return createR2Provider({
    bucket: storageBucket,
    ...(options.publicBaseUrl ? { publicBaseUrl: options.publicBaseUrl } : {}),
  })
}

/** Best-effort MIME type guess shared by media and document serving routes. */
export function guessMimeType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? ""
  return MIME_BY_EXT[ext] ?? "application/octet-stream"
}

/** Resolve standard media storage from the graph-selected environment. */
export function createMediaStorage(env: RuntimeEnv): StorageProvider | null {
  const appUrl = typeof env.APP_URL === "string" ? env.APP_URL.replace(/\/api$/, "") : ""
  return createR2BucketStorage(bucket(env, "MEDIA_BUCKET"), {
    publicBaseUrl: `${appUrl}/api/v1/admin/media/`,
  })
}

/** Resolve private document storage from the graph-selected environment. */
export function createDocumentStorage(env: RuntimeEnv): StorageProvider | null {
  return createR2BucketStorage(bucket(env, "DOCUMENTS_BUCKET"))
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

export async function readDocumentContentBase64(
  env: RuntimeEnv,
  storageKey: string,
): Promise<string | null> {
  const object = await bucket(env, "DOCUMENTS_BUCKET")?.get(storageKey)
  return object ? arrayBufferToBase64(await object.arrayBuffer()) : null
}

function normalizeUrl(value: string) {
  return value.replace(/\/+$/, "")
}

function normalizeApiBaseUrl(value: unknown) {
  const trimmed = typeof value === "string" ? value.trim() : ""
  if (!trimmed) return null
  const normalized = normalizeUrl(trimmed)
  try {
    const parsed = new URL(normalized)
    if (parsed.pathname === "/" || parsed.pathname === "") {
      parsed.pathname = "/api"
      return normalizeUrl(parsed.toString())
    }
  } catch {
    return normalized
  }
  return normalized
}

function resolveDocumentDownloadApiBaseUrl(env: RuntimeEnv) {
  return (
    normalizeApiBaseUrl(env.API_BASE_URL) ??
    normalizeApiBaseUrl(env.APP_URL) ??
    normalizeApiBaseUrl(env.DOCUMENTS_BASE_URL) ??
    null
  )
}

export async function resolveDocumentDownloadUrl(
  env: RuntimeEnv,
  storageKey: string,
  _expiresIn?: number,
): Promise<string | null> {
  if (!bucket(env, "DOCUMENTS_BUCKET")) return null
  const apiBaseUrl = resolveDocumentDownloadApiBaseUrl(env)
  if (!apiBaseUrl) return null
  const keyPath = storageKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
  return `${apiBaseUrl}/v1/admin/documents/files/${keyPath}`
}

/** Voyant Cloud one-shot video upload ticket provider. */
export function createVideoUploadTicket(
  env: RuntimeEnv,
  input: VideoUploadTicketRequest,
): Promise<unknown> {
  return getCloudClient(env).video.videos.createUpload(input)
}

/** Build Storage's route runtime from generic host primitives. */
export function createStorageRuntime(primitives: StorageRuntimePrimitives): MediaRoutesOptions {
  return {
    resolveStorage: (context) => createMediaStorage(primitives.env(context.env)),
    guessServedMimeType: guessMimeType,
    signVideoUploadTicket: (context, input) =>
      createVideoUploadTicket(primitives.env(context.env), input),
  }
}
