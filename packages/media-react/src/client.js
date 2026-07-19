/**
 * Zod fetch client for the media-library admin API
 * (`/v1/admin/media-library/*`). The low-level `fetchWithValidation` /
 * `VoyantApiError` infra mirrors the other `*-react` clients; the typed
 * operation functions reuse the request schemas from
 * `@voyant-travel/media/validation` and validate responses against the wire
 * schemas in `./schemas`.
 */
import {
  assetUsageListResponseSchema,
  mediaAssetEnvelopeSchema,
  mediaAssetListResponseSchema,
  mediaFolderEnvelopeSchema,
  mediaFolderListResponseSchema,
  mediaFolderMemberEnvelopeSchema,
  removeFolderMemberResponseSchema,
  uploadMediaAssetResponseSchema,
} from "./schemas.js"
export const defaultFetcher = (url, init) => fetch(url, { credentials: "include", ...init })
export class VoyantApiError extends Error {
  status
  body
  constructor(message, status, body) {
    super(message)
    this.name = "VoyantApiError"
    this.status = status
    this.body = body
  }
}
/** True when the failure is the service's delete-in-use guard (HTTP 409). */
export function isAssetInUseError(error) {
  return error instanceof VoyantApiError && error.status === 409
}
function extractErrorMessage(status, statusText, body) {
  if (typeof body === "object" && body !== null && "error" in body) {
    const err = body.error
    if (typeof err === "string") return err
    if (typeof err === "object" && err !== null && "message" in err) {
      return String(err.message)
    }
  }
  return `Voyant API error: ${status} ${statusText}`
}
export async function fetchWithValidation(path, schema, options, init) {
  const url = joinUrl(options.baseUrl, path)
  const headers = new Headers(init?.headers)
  if (
    init?.body !== undefined &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json")
  }
  const response = await options.fetcher(url, { ...init, headers })
  if (!response.ok) {
    const body = await safeJson(response)
    throw new VoyantApiError(
      extractErrorMessage(response.status, response.statusText, body),
      response.status,
      body,
    )
  }
  if (response.status === 204) {
    return schema.parse(undefined)
  }
  const body = await safeJson(response)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new VoyantApiError(
      `Voyant API response failed validation: ${parsed.error.message}`,
      response.status,
      body,
    )
  }
  return parsed.data
}
export function withQueryParams(path, query) {
  if (!query) {
    return path
  }
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, String(item))
      }
      continue
    }
    params.set(key, String(value))
  }
  const serialized = params.toString()
  return serialized ? `${path}?${serialized}` : path
}
async function safeJson(response) {
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
function joinUrl(baseUrl, path) {
  const trimmedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  const trimmedPath = path.startsWith("/") ? path : `/${path}`
  return `${trimmedBase}${trimmedPath}`
}
// ──────────────────────────────────────────────────────────────────
// Typed media-library operations
// ──────────────────────────────────────────────────────────────────
const ASSETS = "/v1/admin/media-library/assets"
const FOLDERS = "/v1/admin/media-library/folders"
const USAGE = "/v1/admin/media-library/usage"
/** List/search assets (filters: type, folderId, tag, mimeType, name; paginated). */
export function listMediaAssets(query, options) {
  return fetchWithValidation(withQueryParams(ASSETS, query), mediaAssetListResponseSchema, options)
}
export function getMediaAsset(assetId, options) {
  return fetchWithValidation(`${ASSETS}/${assetId}`, mediaAssetEnvelopeSchema, options)
}
/** Upload an asset (multipart → dedup → store → catalogue). Returns the asset. */
export function uploadMediaAsset(input, options) {
  const form = new FormData()
  form.set("file", input.file)
  form.set("type", input.type)
  if (input.name) form.set("name", input.name)
  if (input.alt !== undefined) form.set("alt", input.alt)
  if (input.mimeType) form.set("mimeType", input.mimeType)
  if (input.tags?.length) form.set("tags", input.tags.join(","))
  if (input.folderIds?.length) form.set("folderIds", input.folderIds.join(","))
  return fetchWithValidation(ASSETS, uploadMediaAssetResponseSchema, options, {
    method: "POST",
    body: form,
  })
}
export function updateMediaAsset(assetId, input, options) {
  return fetchWithValidation(`${ASSETS}/${assetId}`, mediaAssetEnvelopeSchema, options, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}
export function deleteMediaAsset(assetId, options) {
  return fetchWithValidation(`${ASSETS}/${assetId}`, mediaAssetEnvelopeSchema, options, {
    method: "DELETE",
  })
}
export function listMediaFolders(query, options) {
  return fetchWithValidation(
    withQueryParams(FOLDERS, query),
    mediaFolderListResponseSchema,
    options,
  )
}
export function createMediaFolder(input, options) {
  return fetchWithValidation(FOLDERS, mediaFolderEnvelopeSchema, options, {
    method: "POST",
    body: JSON.stringify(input),
  })
}
export function updateMediaFolder(folderId, input, options) {
  return fetchWithValidation(`${FOLDERS}/${folderId}`, mediaFolderEnvelopeSchema, options, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}
export function deleteMediaFolder(folderId, options) {
  return fetchWithValidation(`${FOLDERS}/${folderId}`, mediaFolderEnvelopeSchema, options, {
    method: "DELETE",
  })
}
export function addAssetToFolder(folderId, assetId, options) {
  return fetchWithValidation(
    `${FOLDERS}/${folderId}/members`,
    mediaFolderMemberEnvelopeSchema,
    options,
    { method: "POST", body: JSON.stringify({ assetId }) },
  )
}
export function removeAssetFromFolder(folderId, assetId, options) {
  return fetchWithValidation(
    `${FOLDERS}/${folderId}/members/${assetId}`,
    removeFolderMemberResponseSchema,
    options,
    { method: "DELETE" },
  )
}
export function listAssetUsage(query, options) {
  return fetchWithValidation(withQueryParams(USAGE, query), assetUsageListResponseSchema, options)
}
