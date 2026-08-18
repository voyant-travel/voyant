import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import type { InboundEmailEnvelopeV1 } from "@voyant-travel/conversations-contracts"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/pglite"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { ConversationsAttachmentRuntime } from "../../src/attachment-runtime.js"
import {
  ConversationAttachmentConflictError,
  ConversationAttachmentNotFoundError,
  cleanupConversationAttachments,
  createConversationPrivateAttachmentDeliveryResolver,
  downloadConversationAttachment,
  linkAttachmentsToPart,
  requireSendableAttachments,
} from "../../src/attachment-service.js"
import {
  conversationAttachments,
  conversationEvents,
  conversationParts,
  conversations,
} from "../../src/schema.js"
import {
  ConversationConflictError,
  ingestEnvelope,
  replyToConversation,
} from "../../src/service.js"

const defaultInboxId = "cvin_01k2p3q4r5s6t7v8w9x0y1z2a3"
const actorUserId = "user_attachment_agent"

describe("attachment security state transitions", () => {
  let client: PGlite
  let db: ReturnType<typeof drizzle>

  beforeAll(async () => {
    client = new PGlite()
    db = drizzle(client)
    await client.exec(readMigration("0000_conversations_baseline.sql"))
    await client.exec(`
      INSERT INTO conversations
        (id, reply_alias, customer_address, last_part_at)
      VALUES
        ('legacy_conversation', 'legacy@example.test', 'customer@example.test', now());
      INSERT INTO conversation_parts
        (id, conversation_id, direction, sender_address, recipient_addresses,
         attachments, payload_fingerprint, delivery_status, occurred_at)
      VALUES
        ('legacy_part', 'legacy_conversation', 'inbound', 'customer@example.test', '[]',
         '[{"filename":"secret.txt","path":"https://secret.invalid/token","contentBase64":"c2VjcmV0"}]',
         'legacy', 'received', now());
    `)
    await client.exec(readMigration("0001_collaboration.sql"))
    await client.exec(readMigration("0002_secure_content.sql"))
    await client.exec(readMigration("0003_sms_conversations.sql"))
    await client.exec(`
      CREATE TABLE "event_outbox" (
        "id" text PRIMARY KEY,
        "event_id" text NOT NULL UNIQUE,
        "name" text NOT NULL,
        "payload" jsonb,
        "metadata" jsonb,
        "status" text NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "max_attempts" integer NOT NULL DEFAULT 8,
        "next_attempt_at" timestamptz NOT NULL DEFAULT now(),
        "last_error" text,
        "attempt_errors" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "delivered_at" timestamptz
      );
      INSERT INTO conversation_inbox_memberships (id, inbox_id, user_id, role, active)
      VALUES ('cvim_attachment_agent', '${defaultInboxId}', '${actorUserId}', 'member', true);
    `)
    const migrated = await client.query<{ row: string }>(`
      SELECT row_to_json(part)::text AS row
      FROM conversation_parts part
      WHERE id = 'legacy_part'
    `)
    expect(migrated.rows[0]?.row).not.toMatch(/secret\.invalid|c2VjcmV0|contentBase64|attachments/)
    expect(migrated.rows[0]?.row).toContain('"legacy_attachment_count":1')
    expect(migrated.rows[0]?.row).toContain('"content_status":"quarantined"')
  })

  beforeEach(async () => {
    await client.exec(`
      TRUNCATE conversation_events, conversation_ingress_operations,
        conversation_attachments, conversation_participants, conversation_parts,
        conversations CASCADE
    `)
  })

  afterAll(async () => client.close())

  it("links only clean active attachments and rejects concurrent link drift", async () => {
    await seedConversation(db)
    await seedAttachment(db, {
      id: "attachment_clean",
      scanStatus: "clean",
      availability: "active",
    })
    const sendable = await requireSendableAttachments(db as never, "conversation_one", [
      "attachment_clean",
    ])
    expect(sendable).toHaveLength(1)
    await linkAttachmentsToPart(db as never, ["attachment_clean"], "part_one")
    await expect(
      linkAttachmentsToPart(db as never, ["attachment_clean"], "part_one"),
    ).rejects.toBeInstanceOf(ConversationAttachmentConflictError)
  })

  it.each([
    ["pending", "quarantined"],
    ["blocked", "quarantined"],
    ["failed", "quarantined"],
    ["clean", "redacted"],
  ] as const)("rejects %s/%s attachment state", async (scanStatus, availability) => {
    await seedConversation(db)
    await seedAttachment(db, { id: "attachment_rejected", scanStatus, availability })
    await expect(
      requireSendableAttachments(db as never, "conversation_one", ["attachment_rejected"]),
    ).rejects.toBeInstanceOf(ConversationAttachmentConflictError)
  })

  it("scopes download to the requested conversation and returns only a private redirect", async () => {
    await seedConversation(db)
    await db.insert(conversations).values(conversationRow("conversation_other"))
    await seedAttachment(db, {
      id: "attachment_clean",
      scanStatus: "clean",
      availability: "active",
    })
    const runtime = attachmentRuntime()
    await expect(
      downloadConversationAttachment(db as never, runtime, {
        conversationId: "conversation_other",
        attachmentId: "attachment_clean",
      }),
    ).rejects.toBeInstanceOf(ConversationAttachmentNotFoundError)
    await expect(
      downloadConversationAttachment(db as never, runtime, {
        conversationId: "conversation_one",
        attachmentId: "attachment_clean",
      }),
    ).resolves.toMatchObject({ download: { kind: "redirect" } })
  })

  it("keeps the handle pending after deletion failure, then nulls it and preserves redaction facts", async () => {
    await seedConversation(db)
    await seedAttachment(db, {
      id: "attachment_redact",
      scanStatus: "clean",
      availability: "redaction_pending",
      partId: "part_one",
    })
    const runtime = attachmentRuntime()
    vi.mocked(runtime.delete).mockRejectedValueOnce(new Error("temporary deletion failure"))
    await expect(cleanupConversationAttachments(db as never, runtime)).rejects.toThrow(
      "temporary deletion failure",
    )
    let [attachment] = await db
      .select()
      .from(conversationAttachments)
      .where(eq(conversationAttachments.id, "attachment_redact"))
    expect(attachment).toMatchObject({
      privateHandle: "private-attachment_redact",
      availability: "redaction_pending",
    })

    await expect(cleanupConversationAttachments(db as never, runtime)).resolves.toEqual({
      inspected: 1,
      redacted: 1,
    })
    ;[attachment] = await db
      .select()
      .from(conversationAttachments)
      .where(eq(conversationAttachments.id, "attachment_redact"))
    expect(attachment).toMatchObject({ privateHandle: null, availability: "redacted" })
    const [part] = await db
      .select()
      .from(conversationParts)
      .where(eq(conversationParts.id, "part_one"))
    expect(part).toMatchObject({ textBody: null, htmlBody: null, contentStatus: "redacted" })
    expect(
      await db
        .select()
        .from(conversationEvents)
        .where(
          and(
            eq(conversationEvents.conversationId, "conversation_one"),
            eq(conversationEvents.type, "attachment.redacted"),
          ),
        ),
    ).toHaveLength(1)
  })

  it("revalidates every worker attempt and quarantines changed content", async () => {
    await seedConversation(db)
    await seedAttachment(db, {
      id: "attachment_changed",
      scanStatus: "clean",
      availability: "active",
      partId: "part_one",
    })
    const runtime = attachmentRuntime()
    vi.mocked(runtime.scan).mockResolvedValue({
      status: "clean",
      detectedContentType: "application/pdf",
      detectedSizeBytes: 11,
    })
    const resolver = createConversationPrivateAttachmentDeliveryResolver(db as never, runtime)
    await expect(
      resolver.resolveForDelivery({
        targetId: "part_one",
        privateHandle: "private-attachment_changed",
        filename: "invoice.pdf",
      }),
    ).rejects.toBeInstanceOf(ConversationAttachmentConflictError)
    const [attachment] = await db
      .select()
      .from(conversationAttachments)
      .where(eq(conversationAttachments.id, "attachment_changed"))
    expect(attachment).toMatchObject({ scanStatus: "blocked", availability: "quarantined" })
  })

  it("quarantines classified inbound audit facts without reopening or permitting reply", async () => {
    await seedConversation(db, { status: "closed" })
    const envelope: InboundEmailEnvelopeV1 = {
      version: "1",
      sourceId: "source",
      externalEnvelopeId: "auto-envelope",
      externalMessageId: "auto-message",
      sender: { address: "customer@example.test" },
      to: [{ address: "inbox@example.test" }],
      cc: [],
      replyTo: [],
      subject: "Automatic response",
      text: "This mailbox is unattended",
      html: "<p>This mailbox is unattended</p>",
      attachments: [],
      classification: "automatic_reply",
      threading: { messageId: "auto-message", inReplyTo: "root-message", references: [] },
      occurredAt: "2026-08-18T00:00:00.000Z",
    }
    const result = await ingestEnvelope(db as never, envelope)
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, "conversation_one"))
    expect(conversation).toMatchObject({ status: "closed" })
    const [part] = await db
      .select()
      .from(conversationParts)
      .where(eq(conversationParts.id, result.partId))
    expect(part).toMatchObject({
      classification: "automatic_reply",
      replyable: false,
      contentStatus: "quarantined",
    })
    const admission = { admitRenderedServiceMessage: vi.fn() }
    await expect(
      replyToConversation(db as never, admission, {
        conversationId: "conversation_one",
        actor: { userId: actorUserId },
        channelAccountId: "account",
        text: "loop",
        idempotencyKey: "loop-key",
      }),
    ).rejects.toBeInstanceOf(ConversationConflictError)
    expect(admission.admitRenderedServiceMessage).not.toHaveBeenCalled()
  })

  it("imports and scans inbound attachments before making them active", async () => {
    const runtime = attachmentRuntime()
    runtime.importInbound = vi.fn(async (input) => ({
      privateHandle: "imported-private-handle",
      filename: input.filename,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
    }))
    const envelope: InboundEmailEnvelopeV1 = {
      version: "1",
      sourceId: "source",
      externalEnvelopeId: "attachment-envelope",
      externalMessageId: "attachment-message",
      sender: { address: "customer@example.test" },
      to: [{ address: "inbox@example.test" }],
      cc: [],
      replyTo: [],
      subject: "Invoice",
      text: "Attached",
      html: null,
      attachments: [
        {
          externalId: "external-attachment",
          filename: "invoice.pdf",
          contentType: "application/pdf",
          size: 10,
          privateHandle: "source-private-handle",
        },
      ],
      classification: "message",
      threading: { messageId: "attachment-message", inReplyTo: null, references: [] },
      occurredAt: "2026-08-18T00:00:00.000Z",
    }
    const result = await ingestEnvelope(db as never, envelope, { attachmentRuntime: runtime })
    const [attachment] = await db
      .select()
      .from(conversationAttachments)
      .where(eq(conversationAttachments.partId, result.partId))
    expect(runtime.importInbound).toHaveBeenCalledOnce()
    expect(runtime.scan).toHaveBeenCalledOnce()
    expect(attachment).toMatchObject({
      privateHandle: "imported-private-handle",
      scanStatus: "clean",
      availability: "active",
    })
    const [part] = await db
      .select()
      .from(conversationParts)
      .where(eq(conversationParts.id, result.partId))
    expect(part?.contentStatus).toBe("safe")
  })
})

function readMigration(name: string) {
  return readFileSync(new URL(`../../migrations/${name}`, import.meta.url), "utf8").replaceAll(
    "--> statement-breakpoint",
    "",
  )
}

function conversationRow(id: string) {
  const now = new Date("2026-08-17T00:00:00.000Z")
  return {
    id,
    inboxId: defaultInboxId,
    replyAlias: `${id}@inbox.example.test`,
    customerAddress: "customer@example.test",
    nextPartSequence: 2,
    lastPartAt: now,
    createdAt: now,
    updatedAt: now,
  }
}

async function seedConversation(
  db: ReturnType<typeof drizzle>,
  options: { status?: "open" | "closed" } = {},
) {
  const now = new Date("2026-08-17T00:00:00.000Z")
  await db.insert(conversations).values({
    ...conversationRow("conversation_one"),
    status: options.status ?? "open",
  })
  await db.insert(conversationParts).values({
    id: "part_one",
    conversationId: "conversation_one",
    sequence: 1,
    direction: "inbound",
    senderAddress: "customer@example.test",
    recipientAddresses: ["inbox@example.test"],
    textBody: "Original body",
    htmlBody: "<p>Original body</p>",
    messageId: "root-message",
    payloadFingerprint: "fingerprint",
    admissionStatus: "received",
    occurredAt: now,
    createdAt: now,
  })
}

async function seedAttachment(
  db: ReturnType<typeof drizzle>,
  input: {
    id: string
    scanStatus: "pending" | "clean" | "blocked" | "failed"
    availability: "active" | "quarantined" | "redaction_pending" | "redacted"
    partId?: string
  },
) {
  await db.insert(conversationAttachments).values({
    id: input.id,
    conversationId: "conversation_one",
    partId: input.partId ?? null,
    privateHandle: `private-${input.id}`,
    filename: "invoice.pdf",
    contentType: "application/pdf",
    sizeBytes: 10,
    scanStatus: input.scanStatus,
    availability: input.availability,
  })
}

function attachmentRuntime(): ConversationsAttachmentRuntime {
  return {
    scan: vi.fn(async () => ({
      status: "clean" as const,
      detectedContentType: "application/pdf",
      detectedSizeBytes: 10,
    })),
    download: vi.fn(async () => ({
      kind: "redirect" as const,
      url: "https://private.invalid/short-lived",
      expiresAt: "2026-08-18T00:01:00.000Z",
    })),
    delete: vi.fn(async () => undefined),
    resolveForSend: vi.fn(async () => ({
      kind: "private-url" as const,
      url: "https://private.invalid/attempt",
      expiresAt: "2026-08-18T00:01:00.000Z",
      contentType: "application/pdf",
    })),
  }
}
