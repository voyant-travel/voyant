export interface DocumentDownloadEnvelope {
  url: string
  expiresAt: string | null
}

export type DocumentDownloadResolution =
  | { status: "ready"; download: DocumentDownloadEnvelope }
  | { status: "resolver_not_configured" }
  | { status: "not_available" }

export type DocumentDownloadResolver = (
  bindings: unknown,
  storageKey: string,
) => Promise<string | null> | string | null

export interface StoredDocumentReference {
  storageKey?: string | null
  metadata?: unknown
}

function getMetadataRecord(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }

  return metadata as Record<string, unknown>
}

function maybeUrl(value: unknown) {
  return typeof value === "string" && /^https?:\/\//i.test(value) ? value : null
}

function maybeIsoString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null
}

function getFallbackDownload(metadata: unknown): DocumentDownloadEnvelope | null {
  const record = getMetadataRecord(metadata)
  if (!record) {
    return null
  }

  const url = maybeUrl(record.url) ?? maybeUrl(record.downloadUrl)
  if (!url) {
    return null
  }

  return {
    url,
    expiresAt: maybeIsoString(record.expiresAt) ?? maybeIsoString(record.expires_at),
  }
}

export async function resolveStoredDocumentDownload(
  reference: StoredDocumentReference,
  options: {
    bindings: unknown
    resolveDocumentDownloadUrl?: DocumentDownloadResolver
  },
): Promise<DocumentDownloadResolution> {
  let needsResolver = false
  if (reference.storageKey) {
    if (!options.resolveDocumentDownloadUrl) {
      needsResolver = true
    } else {
      const url = await options.resolveDocumentDownloadUrl(options.bindings, reference.storageKey)
      if (url) {
        return { status: "ready" as const, download: { url, expiresAt: null } }
      }
    }
  }

  const fallback = getFallbackDownload(reference.metadata)
  if (fallback) {
    return { status: "ready" as const, download: fallback }
  }

  if (needsResolver) {
    return { status: "resolver_not_configured" as const }
  }

  return { status: "not_available" as const }
}
