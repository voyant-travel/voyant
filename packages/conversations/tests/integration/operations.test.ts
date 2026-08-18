import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import {
  bulkUpdateConversations,
  getInboxOperationalReport,
  listOperationalConversations,
} from "../../src/operations-service.js"
import {
  conversationEvents,
  conversationInboxes,
  conversationInboxMemberships,
  conversationParticipants,
  conversationParts,
  conversations,
} from "../../src/schema.js"

const inboxA = "cvin_ops_a"
const inboxB = "cvin_ops_b"
const staffA = "staff-a"

describe("operational Inbox persistence", () => {
  let client: PGlite
  let db: ReturnType<typeof drizzle>

  beforeAll(async () => {
    client = new PGlite()
    db = drizzle(client)
    for (const migration of [
      "0000_conversations_baseline.sql",
      "0001_collaboration.sql",
      "0002_secure_content.sql",
      "0003_sms_conversations.sql",
      "0004_operational_inbox.sql",
    ]) {
      await client.exec(readMigration(migration))
    }
    await client.exec(`
      CREATE TABLE event_outbox (
        id text primary key, event_id text not null unique, name text not null,
        payload jsonb, metadata jsonb, status text not null default 'pending',
        attempts integer not null default 0, max_attempts integer not null default 8,
        next_attempt_at timestamptz not null default now(), last_error text,
        attempt_errors jsonb, created_at timestamptz not null default now(),
        delivered_at timestamptz
      );
    `)
  })

  beforeEach(async () => {
    await client.exec(`
      TRUNCATE event_outbox, conversation_events, conversation_ingress_operations,
        conversation_attachments, conversation_read_cursors, conversation_notes,
        conversation_participants, conversation_parts, conversations,
        conversation_inbox_memberships, conversation_inboxes CASCADE;
    `)
    await db.insert(conversationInboxes).values([
      { id: inboxA, name: "Operations A", isDefault: true },
      { id: inboxB, name: "Operations B" },
    ])
    await db.insert(conversationInboxMemberships).values({
      id: "cvim_ops_a",
      inboxId: inboxA,
      userId: staffA,
      role: "manager",
      active: true,
    })
  })

  afterAll(async () => client.close())

  it("keeps deep keyset pages stable when a newer conversation arrives", async () => {
    const at = new Date("2026-08-18T10:00:00.000Z")
    for (let index = 0; index < 125; index += 1) {
      await seedConversation(db, {
        id: `conv_${String(index).padStart(3, "0")}`,
        inboxId: inboxA,
        lastPartAt: new Date(at.getTime() - index * 1_000),
      })
    }
    const first = await listOperationalConversations(db as never, { userId: staffA, limit: 40 })
    expect(first.data).toHaveLength(40)
    await seedConversation(db, {
      id: "conv_newer",
      inboxId: inboxA,
      lastPartAt: new Date("2026-08-18T11:00:00.000Z"),
    })
    const seen = new Set(first.data.map(({ id }) => id))
    let cursor = first.page.nextCursor
    while (cursor) {
      const page = await listOperationalConversations(db as never, {
        userId: staffA,
        cursor,
        limit: 40,
      })
      for (const row of page.data) {
        expect(seen.has(row.id)).toBe(false)
        seen.add(row.id)
      }
      cursor = page.page.nextCursor
    }
    expect(seen).toHaveLength(125)
    expect(seen.has("conv_newer")).toBe(false)
  })

  it("enforces membership and searches only safe tenant content", async () => {
    await seedConversation(db, { id: "allowed", inboxId: inboxA, subject: "Rail itinerary" })
    await seedPart(db, "allowed", 1, "Visible reservation reference", "safe")
    await db.insert(conversationParticipants).values({
      conversationId: "allowed",
      role: "customer",
      address: "traveller@example.test",
    })
    await seedConversation(db, { id: "forbidden", inboxId: inboxB, subject: "Rail secret" })
    await seedPart(db, "forbidden", 1, "Visible reservation reference", "safe")
    await seedConversation(db, { id: "quarantined", inboxId: inboxA })
    await seedPart(db, "quarantined", 1, "malicious needle", "quarantined")

    const subject = await listOperationalConversations(db as never, { userId: staffA, q: "Rail" })
    expect(subject.data.map(({ id }) => id)).toEqual(["allowed"])
    const address = await listOperationalConversations(db as never, {
      userId: staffA,
      participant: "traveller@",
    })
    expect(address.data.map(({ id }) => id)).toEqual(["allowed"])
    const unsafe = await listOperationalConversations(db as never, {
      userId: staffA,
      q: "malicious",
    })
    expect(unsafe.data).toHaveLength(0)
  })

  it("serves indexed queue projections and per-user unread state", async () => {
    await seedConversation(db, { id: "unassigned", inboxId: inboxA, waitingOn: "staff" })
    await seedPart(db, "unassigned", 1, "Need help", "safe")
    await seedConversation(db, {
      id: "mine",
      inboxId: inboxA,
      assignedToUserId: staffA,
      waitingOn: "customer",
    })
    expect(
      (
        await listOperationalConversations(db as never, { userId: staffA, queue: "unassigned" })
      ).data.map(({ id }) => id),
    ).toEqual(["unassigned"])
    expect(
      (
        await listOperationalConversations(db as never, {
          userId: staffA,
          queue: "assigned_to_me",
        })
      ).data.map(({ id }) => id),
    ).toEqual(["mine"])
    expect(
      (await listOperationalConversations(db as never, { userId: staffA, unread: true })).data.map(
        ({ id }) => id,
      ),
    ).toEqual(["unassigned"])
  })

  it("applies optimistic bulk lifecycle changes with an event and outbox row per item", async () => {
    await seedConversation(db, { id: "bulk_a", inboxId: inboxA })
    await seedConversation(db, { id: "bulk_b", inboxId: inboxA })
    const updated = await bulkUpdateConversations(db as never, {
      actor: { userId: staffA, correlationId: "bulk-correlation" },
      items: [
        { id: "bulk_a", revision: 1 },
        { id: "bulk_b", revision: 1 },
      ],
      changes: { assignedToUserId: staffA, status: "closed" },
      staffDirectory: { isActiveStaff: async () => true, listActiveStaff: async () => [] },
    })
    expect(
      updated.every(
        ({ status, assignedToUserId }) => status === "closed" && assignedToUserId === staffA,
      ),
    ).toBe(true)
    const events = await db.select().from(conversationEvents)
    expect(events).toHaveLength(2)
    const outbox = await client.query<{ count: number }>(
      "select count(*)::int as count from event_outbox",
    )
    expect(outbox.rows[0]?.count).toBe(2)
  })

  it("reconstructs content-free reporting and uses a queue cursor index", async () => {
    const createdAt = new Date("2026-08-18T08:00:00.000Z")
    await seedConversation(db, {
      id: "reported",
      inboxId: inboxA,
      createdAt,
      lastPartAt: new Date("2026-08-18T09:00:00.000Z"),
      lastInboundAt: new Date("2026-08-18T08:10:00.000Z"),
      firstResponseAt: new Date("2026-08-18T08:20:00.000Z"),
      waitingOn: "staff",
    })
    await seedPart(db, "reported", 1, "private body", "safe", "admitted")
    const report = await getInboxOperationalReport(db as never, {
      userId: staffA,
      from: new Date("2026-08-18T00:00:00.000Z"),
      to: new Date("2026-08-19T00:00:00.000Z"),
      deliveryTruth: {
        async getDeliveryTruth(_database, deliveryIds) {
          return Object.fromEntries(deliveryIds.map((id) => [id, "failed" as const]))
        },
      },
    })
    expect(report.volumes.new).toBe(1)
    expect(report.backlog).toBe(1)
    expect(report.averagesMs.firstResponse).toBe(20 * 60_000)
    expect(report.delivery.failed).toBe(1)
    expect(report.sla.authoritative).toBe(false)
    expect(JSON.stringify(report)).not.toContain("private body")

    await client.exec("SET enable_seqscan = off")
    const explained = await client.query<{ "QUERY PLAN": string }>(`
      EXPLAIN SELECT id FROM conversations
      WHERE inbox_id = '${inboxA}' AND status = 'open' AND waiting_on = 'staff'
      ORDER BY last_part_at DESC, id DESC LIMIT 50
    `)
    expect(explained.rows.map((row) => row["QUERY PLAN"]).join("\n")).toMatch(
      /idx_conversations_queue_cursor/,
    )
  })
})

async function seedConversation(
  db: ReturnType<typeof drizzle>,
  input: {
    id: string
    inboxId: string
    subject?: string
    assignedToUserId?: string | null
    waitingOn?: "staff" | "customer" | null
    createdAt?: Date
    lastPartAt?: Date
    lastInboundAt?: Date | null
    firstResponseAt?: Date | null
  },
) {
  const lastPartAt = input.lastPartAt ?? new Date("2026-08-18T10:00:00.000Z")
  await db.insert(conversations).values({
    id: input.id,
    inboxId: input.inboxId,
    assignedToUserId: input.assignedToUserId ?? null,
    waitingOn: input.waitingOn ?? null,
    subject: input.subject ?? null,
    replyAlias: `${input.id}@inbox.example.test`,
    customerAddress: `${input.id}@customer.example.test`,
    nextPartSequence: 2,
    createdAt: input.createdAt ?? lastPartAt,
    lastPartAt,
    lastInboundAt: input.lastInboundAt ?? null,
    firstResponseAt: input.firstResponseAt ?? null,
  })
}

async function seedPart(
  db: ReturnType<typeof drizzle>,
  conversationId: string,
  sequence: number,
  textBody: string,
  contentStatus: "safe" | "quarantined" | "redacted",
  admissionStatus: "received" | "admitted" = "received",
) {
  await db.insert(conversationParts).values({
    id: `part_${conversationId}_${sequence}`,
    conversationId,
    sequence,
    direction: "inbound",
    senderAddress: "customer@example.test",
    recipientAddresses: ["inbox@example.test"],
    textBody,
    contentStatus,
    payloadFingerprint: `${conversationId}:${sequence}`,
    notificationDeliveryId: admissionStatus === "admitted" ? `delivery_${conversationId}` : null,
    admissionStatus,
    occurredAt: new Date("2026-08-18T10:00:00.000Z"),
  })
}

function readMigration(name: string): string {
  return readFileSync(new URL(`../../migrations/${name}`, import.meta.url), "utf8").replaceAll(
    "--> statement-breakpoint",
    "",
  )
}
