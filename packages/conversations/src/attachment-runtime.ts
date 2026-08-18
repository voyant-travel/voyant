import type { StorageProviderResolver } from "@voyant-travel/storage"

export interface ConversationAttachmentUploadTicket {
  token: string
  method: "PUT" | "POST"
  url: string
  headers?: Readonly<Record<string, string>>
  expiresAt: string
}

export interface ConversationAttachmentFinalizeResult {
  privateHandle: string
  filename: string
  contentType: string
  sizeBytes: number
}

export type ConversationAttachmentDownload =
  | { kind: "response"; response: Response }
  | { kind: "redirect"; url: string; expiresAt: string }

export type ConversationAttachmentSendMaterial =
  | { kind: "bytes"; bytes: Uint8Array; contentType: string }
  | { kind: "private-url"; url: string; expiresAt: string; contentType: string }

export interface ConversationAttachmentScanResult {
  status: "clean" | "blocked" | "failed"
  detectedContentType?: string
  detectedSizeBytes?: number
}

/** Runtime-only authority for private attachment bytes. No method returns credentials. */
export interface ConversationsAttachmentRuntime {
  createUploadTicket?(input: {
    conversationId: string
    filename: string
    contentType: string
    sizeBytes: number
  }): Promise<ConversationAttachmentUploadTicket>
  finalizeUpload?(input: {
    conversationId: string
    token: string
    filename: string
    contentType: string
    sizeBytes: number
  }): Promise<ConversationAttachmentFinalizeResult>
  importInbound?(input: {
    sourceId: string
    externalId: string
    privateHandle: string
    filename: string
    contentType: string
    sizeBytes: number
  }): Promise<ConversationAttachmentFinalizeResult>
  scan(input: {
    privateHandle: string
    filename: string
    declaredContentType: string
    declaredSizeBytes: number
  }): Promise<ConversationAttachmentScanResult>
  download(privateHandle: string): Promise<ConversationAttachmentDownload | null>
  delete(privateHandle: string): Promise<void>
  resolveForSend(privateHandle: string): Promise<ConversationAttachmentSendMaterial | null>
}

/**
 * Safe fallback for deployments with the logical private documents store. It
 * intentionally does not invent a direct-upload protocol; upload remains
 * capability-gated while downloads, cleanup, and worker materialization work.
 */
export function createDocumentsConversationAttachmentRuntime(
  resolver: StorageProviderResolver,
): ConversationsAttachmentRuntime | null {
  const storage = resolver.resolve("documents")
  if (!storage?.signedUrl) return null
  return {
    async scan() {
      return { status: "failed" as const }
    },
    async download(privateHandle) {
      const expiresIn = 60
      return {
        kind: "redirect" as const,
        url: await storage.signedUrl!(privateHandle, expiresIn),
        expiresAt: new Date(Date.now() + expiresIn * 1_000).toISOString(),
      }
    },
    delete: (privateHandle) => storage.delete(privateHandle),
    async resolveForSend(privateHandle) {
      const expiresIn = 60
      return {
        kind: "private-url" as const,
        url: await storage.signedUrl!(privateHandle, expiresIn),
        expiresAt: new Date(Date.now() + expiresIn * 1_000).toISOString(),
        contentType: "application/octet-stream",
      }
    },
  }
}
