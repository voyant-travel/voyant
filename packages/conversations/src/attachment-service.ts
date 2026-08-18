import type { ConversationPrivateAttachmentDeliveryResolver } from "@voyant-travel/conversations-contracts"
import { newId } from "@voyant-travel/db/lib/typeid"
import { insertOutboxEvents } from "@voyant-travel/db/outbox"
import { and, eq, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { ConversationsAttachmentRuntime } from "./attachment-runtime.js"
import {
  assertAttachmentSetPolicy,
  assertDetectedAttachmentMetadata,
  ConversationAttachmentPolicyError,
  normalizeAttachmentMetadata,
} from "./content-security.js"
import {
  type ConversationAttachment,
  conversationAttachments,
  conversationEvents,
  conversationParts,
  conversations,
} from "./schema.js"

export class ConversationAttachmentUnavailableError extends Error {
  readonly code = "attachment_runtime_unavailable"
}

export class ConversationAttachmentNotFoundError extends Error {
  readonly code = "attachment_not_found"
}

export class ConversationAttachmentConflictError extends Error {
  readonly code = "attachment_conflict"
}

export async function createAttachmentUploadTicket(
  db: PostgresJsDatabase,
  runtime: ConversationsAttachmentRuntime | undefined,
  input: { conversationId: string; filename: string; contentType: string; sizeBytes: number },
) {
  const metadata = normalizeAttachmentMetadata(input)
  const [conversation] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.id, input.conversationId))
    .limit(1)
  if (!conversation) throw new ConversationAttachmentNotFoundError("Conversation not found")
  if (!runtime?.createUploadTicket || !runtime.finalizeUpload) {
    throw new ConversationAttachmentUnavailableError("Private upload is not configured")
  }
  return runtime.createUploadTicket({ conversationId: input.conversationId, ...metadata })
}

export async function finalizeAttachmentUpload(
  db: PostgresJsDatabase,
  runtime: ConversationsAttachmentRuntime | undefined,
  input: {
    conversationId: string
    token: string
    filename: string
    contentType: string
    sizeBytes: number
  },
): Promise<ConversationAttachment> {
  const requested = normalizeAttachmentMetadata(input)
  if (!runtime?.finalizeUpload) {
    throw new ConversationAttachmentUnavailableError("Private upload is not configured")
  }
  const finalized = await runtime.finalizeUpload({ ...input, ...requested })
  const scan = await runtime.scan({
    privateHandle: finalized.privateHandle,
    filename: finalized.filename,
    declaredContentType: finalized.contentType,
    declaredSizeBytes: finalized.sizeBytes,
  })
  let verified = normalizeAttachmentMetadata(finalized)
  let scanStatus: "clean" | "blocked" | "failed" = scan.status
  try {
    verified = assertDetectedAttachmentMetadata({
      filename: finalized.filename,
      declaredContentType: finalized.contentType,
      declaredSizeBytes: finalized.sizeBytes,
      detectedContentType: scan.detectedContentType,
      detectedSizeBytes: scan.detectedSizeBytes,
    })
  } catch {
    scanStatus = "blocked"
  }
  if (
    verified.filename !== requested.filename ||
    verified.contentType !== requested.contentType ||
    verified.sizeBytes !== requested.sizeBytes ||
    !finalized.privateHandle.trim()
  ) {
    throw new ConversationAttachmentConflictError("Finalized upload metadata does not match")
  }
  const [attachment] = await db
    .insert(conversationAttachments)
    .values({
      id: newId("conversation_attachments"),
      conversationId: input.conversationId,
      privateHandle: finalized.privateHandle,
      ...verified,
      scanStatus,
      availability: scanStatus === "clean" ? "active" : "quarantined",
    })
    .returning()
  if (!attachment) throw new Error("Finalized attachment was not persisted")
  return attachment
}

export async function downloadConversationAttachment(
  db: PostgresJsDatabase,
  runtime: ConversationsAttachmentRuntime | undefined,
  input: { conversationId: string; attachmentId: string },
) {
  if (!runtime) throw new ConversationAttachmentUnavailableError("Private download is unavailable")
  const [attachment] = await db
    .select()
    .from(conversationAttachments)
    .where(
      and(
        eq(conversationAttachments.id, input.attachmentId),
        eq(conversationAttachments.conversationId, input.conversationId),
        eq(conversationAttachments.scanStatus, "clean"),
        eq(conversationAttachments.availability, "active"),
      ),
    )
    .limit(1)
  if (!attachment) throw new ConversationAttachmentNotFoundError("Attachment not available")
  if (!attachment.privateHandle)
    throw new ConversationAttachmentNotFoundError("Attachment has been redacted")
  const download = await runtime.download(attachment.privateHandle)
  if (!download) throw new ConversationAttachmentNotFoundError("Attachment bytes not found")
  return { attachment, download }
}

export async function requestAttachmentRedaction(
  db: PostgresJsDatabase,
  input: { conversationId: string; attachmentId: string },
) {
  const [attachment] = await db
    .update(conversationAttachments)
    .set({ availability: "redaction_pending", updatedAt: new Date() })
    .where(
      and(
        eq(conversationAttachments.id, input.attachmentId),
        eq(conversationAttachments.conversationId, input.conversationId),
        inArray(conversationAttachments.availability, ["active", "quarantined"]),
      ),
    )
    .returning()
  if (!attachment) throw new ConversationAttachmentNotFoundError("Attachment not found")
  return attachment
}

export async function cleanupConversationAttachments(
  db: PostgresJsDatabase,
  runtime: ConversationsAttachmentRuntime,
  now = new Date(),
  limit = 100,
) {
  const due = await db
    .select()
    .from(conversationAttachments)
    .where(
      or(
        eq(conversationAttachments.availability, "redaction_pending"),
        and(
          isNotNull(conversationAttachments.retentionUntil),
          lte(conversationAttachments.retentionUntil, now),
        ),
      ),
    )
    .limit(Math.min(Math.max(limit, 1), 500))
  let redacted = 0
  for (const attachment of due) {
    if (attachment.privateHandle) await runtime.delete(attachment.privateHandle)
    const didRedact = await db.transaction(async (transaction) => {
      const tx = transaction as PostgresJsDatabase
      const [updated] = await tx
        .update(conversationAttachments)
        .set({
          availability: "redacted",
          privateHandle: null,
          redactedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(conversationAttachments.id, attachment.id),
            inArray(conversationAttachments.availability, [
              "active",
              "quarantined",
              "redaction_pending",
            ]),
          ),
        )
        .returning({ id: conversationAttachments.id })
      if (!updated) return false
      if (attachment.partId) {
        await tx
          .update(conversationParts)
          .set({ textBody: null, htmlBody: null, contentStatus: "redacted" })
          .where(eq(conversationParts.id, attachment.partId))
      }
      const [conversation] = await tx
        .update(conversations)
        .set({ revision: sql`${conversations.revision} + 1`, updatedAt: now })
        .where(eq(conversations.id, attachment.conversationId))
        .returning({ inboxId: conversations.inboxId, revision: conversations.revision })
      if (!conversation) return false
      await tx.insert(conversationEvents).values({
        conversationId: attachment.conversationId,
        type: "attachment.redacted",
        revision: conversation.revision,
        payload: { attachmentId: attachment.id, partId: attachment.partId },
        occurredAt: now,
      })
      await insertOutboxEvents(tx as never, [
        {
          name: "conversation.changed",
          data: {
            conversationId: attachment.conversationId,
            inboxId: conversation.inboxId,
            revision: conversation.revision,
            change: "attachment.redacted",
          },
          metadata: {},
          emittedAt: now.toISOString(),
        },
      ])
      return true
    })
    if (didRedact) redacted += 1
  }
  return { inspected: due.length, redacted }
}

export async function requireSendableAttachments(
  db: PostgresJsDatabase,
  conversationId: string,
  attachmentIds: readonly string[],
) {
  if (attachmentIds.length === 0) return []
  if (new Set(attachmentIds).size !== attachmentIds.length) {
    throw new ConversationAttachmentPolicyError("Duplicate attachment id")
  }
  const rows = await db
    .select()
    .from(conversationAttachments)
    .where(
      and(
        eq(conversationAttachments.conversationId, conversationId),
        inArray(conversationAttachments.id, [...attachmentIds]),
        isNull(conversationAttachments.partId),
      ),
    )
  if (
    rows.length !== attachmentIds.length ||
    rows.some(
      (row) =>
        row.partId ||
        !row.privateHandle ||
        row.scanStatus !== "clean" ||
        row.availability !== "active",
    )
  ) {
    throw new ConversationAttachmentConflictError("Attachments are not clean and available")
  }
  assertAttachmentSetPolicy(
    rows.map((row) => ({
      filename: row.filename,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes,
    })),
  )
  return rows.map((row) => ({ ...row, privateHandle: row.privateHandle! }))
}

export async function linkAttachmentsToPart(
  db: PostgresJsDatabase,
  attachmentIds: readonly string[],
  partId: string,
) {
  if (attachmentIds.length === 0) return
  const linked = await db
    .update(conversationAttachments)
    .set({ partId, updatedAt: new Date() })
    .where(
      and(
        inArray(conversationAttachments.id, [...attachmentIds]),
        isNull(conversationAttachments.partId),
        eq(conversationAttachments.scanStatus, "clean"),
        eq(conversationAttachments.availability, "active"),
      ),
    )
    .returning({ id: conversationAttachments.id })
  if (linked.length !== attachmentIds.length) {
    throw new ConversationAttachmentConflictError("Attachment link changed concurrently")
  }
}

export async function listPartAttachments(db: PostgresJsDatabase, partIds: readonly string[]) {
  if (partIds.length === 0) return []
  return db
    .select()
    .from(conversationAttachments)
    .where(inArray(conversationAttachments.partId, [...partIds]))
}

/**
 * Build the worker-only resolver. Every invocation re-reads attachment truth,
 * re-runs scanning, and materializes an ephemeral payload immediately before a
 * provider attempt. The durable operation continues to store only the handle.
 */
export function createConversationPrivateAttachmentDeliveryResolver(
  db: PostgresJsDatabase,
  runtime: ConversationsAttachmentRuntime,
): ConversationPrivateAttachmentDeliveryResolver {
  return {
    async resolveForDelivery(input) {
      const [attachment] = await db
        .select()
        .from(conversationAttachments)
        .where(
          and(
            eq(conversationAttachments.privateHandle, input.privateHandle),
            eq(conversationAttachments.partId, input.targetId),
          ),
        )
        .limit(1)
      if (
        !attachment?.privateHandle ||
        attachment.scanStatus !== "clean" ||
        attachment.availability !== "active"
      ) {
        throw new ConversationAttachmentConflictError("Attachment is not sendable")
      }
      const scan = await runtime.scan({
        privateHandle: attachment.privateHandle,
        filename: attachment.filename,
        declaredContentType: attachment.contentType,
        declaredSizeBytes: attachment.sizeBytes,
      })
      try {
        assertDetectedAttachmentMetadata({
          filename: attachment.filename,
          declaredContentType: attachment.contentType,
          declaredSizeBytes: attachment.sizeBytes,
          detectedContentType: scan.detectedContentType,
          detectedSizeBytes: scan.detectedSizeBytes,
        })
      } catch {
        await quarantineAttachment(db, attachment.id, "blocked")
        throw new ConversationAttachmentConflictError("Attachment changed after admission")
      }
      if (scan.status !== "clean") {
        await quarantineAttachment(db, attachment.id, scan.status)
        throw new ConversationAttachmentConflictError("Attachment failed send-time scanning")
      }
      const material = await runtime.resolveForSend(attachment.privateHandle)
      if (!material) throw new ConversationAttachmentNotFoundError("Attachment bytes not found")
      const common = {
        filename: attachment.filename,
        contentType: attachment.contentType,
        disposition:
          attachment.disposition === "inline" ? ("inline" as const) : ("attachment" as const),
        ...(attachment.inlineContentId ? { contentId: attachment.inlineContentId } : {}),
      }
      return material.kind === "private-url"
        ? { ...common, path: material.url }
        : { ...common, contentBase64: bytesToBase64(material.bytes) }
    },
  }
}

async function quarantineAttachment(
  db: PostgresJsDatabase,
  id: string,
  scanStatus: "blocked" | "failed",
) {
  await db
    .update(conversationAttachments)
    .set({ scanStatus, availability: "quarantined", scannedAt: new Date(), updatedAt: new Date() })
    .where(eq(conversationAttachments.id, id))
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}
