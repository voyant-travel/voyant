export interface DocumentDownloadEnvelope {
  url: string
  expiresAt: string | null
  filename: string | null
}

export type DocumentDownloadResolution =
  | { status: "ready"; download: DocumentDownloadEnvelope }
  | { status: "resolver_not_configured" }
  | { status: "not_available" }

export type DocumentDownloadResolverResult =
  | string
  | {
      url: string
      expiresAt?: string | null
      filename?: string | null
    }
  | null
  | undefined

export type DocumentDownloadResolver<TBindings = unknown> = (
  bindings: TBindings,
  storageKey: string,
) => Promise<DocumentDownloadResolverResult> | DocumentDownloadResolverResult

export type AuthenticatedDocumentDownloadResolver<TBindings = unknown> = (
  bindings: TBindings,
  storageKey: string,
) => string | null

export interface AuthenticatedDocumentDownloadResolverOptions<TBindings = unknown> {
  /**
   * Absolute application/API origin used for authenticated download URLs.
   * Return `null`/empty when the current deployment cannot expose downloads.
   */
  apiBaseUrl: string | ((bindings: TBindings) => string | null | undefined)
  /**
   * Authenticated route prefix mounted by the host app. The storage key is
   * appended after this prefix with each path segment encoded independently.
   *
   * Defaults to Voyant's operator document byte route.
   */
  routePrefix?: string
  /** Optional deployment-specific availability check. */
  isAvailable?: (bindings: TBindings) => boolean
}

export interface StoredDocumentReference {
  storageKey?: string | null
  metadata?: unknown
  filename?: string | null
  name?: string | null
}

function getMetadataRecord(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }

  return metadata as Record<string, unknown>
}

function maybeString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function maybeUrl(value: unknown) {
  const candidate = maybeString(value)
  return candidate && /^https?:\/\//i.test(candidate) ? candidate : null
}

function resolveApiBaseUrl<TBindings>(
  value: AuthenticatedDocumentDownloadResolverOptions<TBindings>["apiBaseUrl"],
  bindings: TBindings,
) {
  const resolved = typeof value === "function" ? value(bindings) : value
  const trimmed = resolved?.trim()
  return trimmed ? trimmed.replace(/\/+$/, "") : null
}

function normalizeRoutePrefix(routePrefix: string) {
  const trimmed = routePrefix.trim()
  if (!trimmed) return ""
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`
}

export function encodeStorageKeyPath(storageKey: string): string {
  return storageKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

export function createAuthenticatedDocumentDownloadResolver<TBindings = unknown>(
  options: AuthenticatedDocumentDownloadResolverOptions<TBindings>,
): AuthenticatedDocumentDownloadResolver<TBindings> {
  const routePrefix = normalizeRoutePrefix(options.routePrefix ?? "/v1/admin/documents/files")

  return (bindings, storageKey) => {
    if (options.isAvailable && !options.isAvailable(bindings)) {
      return null
    }

    const apiBaseUrl = resolveApiBaseUrl(options.apiBaseUrl, bindings)
    if (!apiBaseUrl) {
      return null
    }

    const keyPath = encodeStorageKeyPath(storageKey)
    return `${apiBaseUrl}${routePrefix}/${keyPath}`
  }
}

function maybeIsoString(value: unknown) {
  return maybeString(value)
}

function filenameFromStorageKey(storageKey: string | null | undefined) {
  const normalized = maybeString(storageKey)
  if (!normalized) {
    return null
  }

  return normalized.split("/").filter(Boolean).at(-1) ?? null
}

function getReferenceFilename(reference: StoredDocumentReference) {
  const record = getMetadataRecord(reference.metadata)
  return (
    maybeString(reference.filename) ??
    maybeString(reference.name) ??
    maybeString(record?.filename) ??
    maybeString(record?.fileName) ??
    maybeString(record?.name) ??
    maybeString(record?.originalName) ??
    filenameFromStorageKey(reference.storageKey)
  )
}

function getMetadataExpiresAt(metadata: unknown) {
  const record = getMetadataRecord(metadata)
  return maybeIsoString(record?.expiresAt) ?? maybeIsoString(record?.expires_at)
}

function getFallbackDownload(reference: StoredDocumentReference): DocumentDownloadEnvelope | null {
  const record = getMetadataRecord(reference.metadata)
  if (!record) {
    return null
  }

  const url = maybeUrl(record.url) ?? maybeUrl(record.downloadUrl)
  if (!url) {
    return null
  }

  return {
    url,
    expiresAt: getMetadataExpiresAt(record),
    filename: getReferenceFilename(reference),
  }
}

function normalizeResolverDownload(
  value: DocumentDownloadResolverResult,
  reference: StoredDocumentReference,
): DocumentDownloadEnvelope | null {
  if (typeof value === "string") {
    const url = maybeUrl(value)
    if (!url) {
      return null
    }

    return {
      url,
      expiresAt: getMetadataExpiresAt(reference.metadata),
      filename: getReferenceFilename(reference),
    }
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const url = maybeUrl(value.url)
  if (!url) {
    return null
  }

  return {
    url,
    expiresAt:
      value.expiresAt === undefined
        ? getMetadataExpiresAt(reference.metadata)
        : maybeIsoString(value.expiresAt),
    filename: maybeString(value.filename) ?? getReferenceFilename(reference),
  }
}

export async function resolveStoredDocumentDownload<TBindings = unknown>(
  reference: StoredDocumentReference,
  options: {
    bindings: TBindings
    resolveDocumentDownloadUrl?: DocumentDownloadResolver<TBindings>
  },
): Promise<DocumentDownloadResolution> {
  let needsResolver = false
  if (reference.storageKey) {
    if (!options.resolveDocumentDownloadUrl) {
      needsResolver = true
    } else {
      const resolved = await options.resolveDocumentDownloadUrl(
        options.bindings,
        reference.storageKey,
      )
      const download = normalizeResolverDownload(resolved, reference)
      if (download) {
        return { status: "ready" as const, download }
      }
    }
  }

  const fallback = getFallbackDownload(reference)
  if (fallback) {
    return { status: "ready" as const, download: fallback }
  }

  if (needsResolver) {
    return { status: "resolver_not_configured" as const }
  }

  return { status: "not_available" as const }
}
