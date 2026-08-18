import { and, desc, eq, gte, isNull, lt, lte, or, type SQL, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type {
  ConversationsDeliveryTruthReader,
  ConversationsStaffDirectory,
} from "./runtime-port.js"
import {
  type Conversation,
  conversationInboxMemberships,
  conversationParticipants,
  conversationParts,
  conversationReadCursors,
  conversations,
} from "./schema.js"
import {
  type ConversationActor,
  type ConversationView,
  updateConversationState,
} from "./service.js"

export type ConversationQueue =
  | "unassigned"
  | "assigned_to_me"
  | "waiting_on_staff"
  | "waiting_on_customer"
  | "snoozed"
  | "closed"

export interface OperationalConversationQuery {
  userId: string
  inboxId?: string
  assignedToUserId?: string
  status?: "open" | "closed" | "snoozed"
  priority?: "low" | "normal" | "high" | "urgent"
  unread?: boolean
  channel?: string
  participant?: string
  q?: string
  from?: Date
  to?: Date
  queue?: ConversationQueue
  cursor?: string
  limit?: number
}

export interface OperationalConversationPage {
  data: ConversationView[]
  page: { nextCursor: string | null }
}

interface ConversationCursor {
  version: 1
  lastPartAt: string
  id: string
}

export class ConversationQueryError extends Error {
  readonly code = "conversation_query_invalid"
}

function encodeCursor(conversation: Conversation): string {
  const value: ConversationCursor = {
    version: 1,
    lastPartAt: conversation.lastPartAt.toISOString(),
    id: conversation.id,
  }
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

function decodeCursor(value: string): { lastPartAt: Date; id: string } {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<ConversationCursor>
    if (
      parsed.version !== 1 ||
      typeof parsed.id !== "string" ||
      typeof parsed.lastPartAt !== "string"
    ) {
      throw new Error("invalid cursor shape")
    }
    const lastPartAt = new Date(parsed.lastPartAt)
    if (Number.isNaN(lastPartAt.getTime()) || parsed.id.length === 0)
      throw new Error("invalid cursor")
    return { lastPartAt, id: parsed.id }
  } catch {
    throw new ConversationQueryError("Conversation cursor is invalid")
  }
}

function escapedLike(value: string): string {
  return `%${value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`
}

/**
 * Tenant-database-only operational search. The correlated body predicate excludes
 * quarantined/redacted content and never copies message text or addresses into a
 * deployment-wide catalog or metric label.
 */
export async function listOperationalConversations(
  db: PostgresJsDatabase,
  input: OperationalConversationQuery,
): Promise<OperationalConversationPage> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100)
  if (input.from && input.to) {
    const rangeMs = input.to.getTime() - input.from.getTime()
    if (rangeMs < 0 || rangeMs > 366 * 24 * 60 * 60 * 1_000) {
      throw new ConversationQueryError("Inbox date range must be between 0 and 366 days")
    }
  }
  const filters: SQL[] = [
    eq(conversationInboxMemberships.userId, input.userId),
    eq(conversationInboxMemberships.active, true),
  ]
  if (input.inboxId) filters.push(eq(conversations.inboxId, input.inboxId))
  if (input.assignedToUserId)
    filters.push(eq(conversations.assignedToUserId, input.assignedToUserId))
  if (input.status) filters.push(eq(conversations.status, input.status))
  if (input.priority) filters.push(eq(conversations.priority, input.priority))
  if (input.channel) filters.push(eq(conversations.channel, input.channel))
  if (input.from) filters.push(gte(conversations.lastPartAt, input.from))
  if (input.to) filters.push(lte(conversations.lastPartAt, input.to))
  if (input.participant) {
    const participant = escapedLike(input.participant.trim())
    filters.push(sql`exists (
      select 1 from ${conversationParticipants} participant
      where participant.conversation_id = ${conversations.id}
        and participant.address ilike ${participant} escape '\\'
    )`)
  }
  if (input.q) {
    const term = input.q.trim()
    if (term.length < 2 || term.length > 100) {
      throw new ConversationQueryError("Search must contain between 2 and 100 characters")
    }
    const pattern = escapedLike(term)
    filters.push(sql`(
      ${conversations.subject} ilike ${pattern} escape '\\'
      or ${conversations.customerAddress} ilike ${pattern} escape '\\'
      or ${conversations.personRef} ilike ${pattern} escape '\\'
      or ${conversations.contactPointRef} ilike ${pattern} escape '\\'
      or exists (
        select 1 from ${conversationParticipants} participant
        where participant.conversation_id = ${conversations.id}
          and participant.address ilike ${pattern} escape '\\'
      )
      or exists (
        select 1 from ${conversationParts} part
        where part.conversation_id = ${conversations.id}
          and part.content_status = 'safe'
          and part.classification = 'message'
          and (
            part.text_body ilike ${pattern} escape '\\'
            or regexp_replace(coalesce(part.html_body, ''), '<[^>]*>', ' ', 'g') ilike ${pattern} escape '\\'
          )
      )
    )`)
  }
  if (input.unread !== undefined) {
    const unread = sql`exists (
      select 1 from ${conversationParts} unread_part
      where unread_part.conversation_id = ${conversations.id}
        and unread_part.direction = 'inbound'
        and unread_part.sequence > coalesce((
          select cursor.last_read_sequence from ${conversationReadCursors} cursor
          where cursor.conversation_id = ${conversations.id}
            and cursor.user_id = ${input.userId}
        ), 0)
    )`
    filters.push(input.unread ? unread : sql`not (${unread})`)
  }
  switch (input.queue) {
    case "unassigned":
      filters.push(isNull(conversations.assignedToUserId), eq(conversations.status, "open"))
      break
    case "assigned_to_me":
      filters.push(
        eq(conversations.assignedToUserId, input.userId),
        eq(conversations.status, "open"),
      )
      break
    case "waiting_on_staff":
      filters.push(eq(conversations.waitingOn, "staff"), eq(conversations.status, "open"))
      break
    case "waiting_on_customer":
      filters.push(eq(conversations.waitingOn, "customer"), eq(conversations.status, "open"))
      break
    case "snoozed":
      filters.push(eq(conversations.status, "snoozed"))
      break
    case "closed":
      filters.push(eq(conversations.status, "closed"))
      break
  }
  if (input.cursor) {
    const cursor = decodeCursor(input.cursor)
    filters.push(
      or(
        lt(conversations.lastPartAt, cursor.lastPartAt),
        and(eq(conversations.lastPartAt, cursor.lastPartAt), lt(conversations.id, cursor.id)),
      )!,
    )
  }
  const unreadCount = sql<number>`(
    select count(*)::int from ${conversationParts} unread_part
    where unread_part.conversation_id = ${conversations.id}
      and unread_part.direction = 'inbound'
      and unread_part.sequence > coalesce((
        select cursor.last_read_sequence from ${conversationReadCursors} cursor
        where cursor.conversation_id = ${conversations.id}
          and cursor.user_id = ${input.userId}
      ), 0)
  )`
  const rows = await db
    .select({ conversation: conversations, unreadCount })
    .from(conversations)
    .innerJoin(
      conversationInboxMemberships,
      eq(conversationInboxMemberships.inboxId, conversations.inboxId),
    )
    .where(and(...filters))
    .orderBy(desc(conversations.lastPartAt), desc(conversations.id))
    .limit(limit + 1)
  const pageRows = rows.slice(0, limit)
  const last = pageRows.at(-1)?.conversation
  return {
    data: pageRows.map(({ conversation, unreadCount: count }) => ({
      ...conversation,
      unreadCount: count,
    })),
    page: { nextCursor: rows.length > limit && last ? encodeCursor(last) : null },
  }
}

export async function bulkUpdateConversations(
  db: PostgresJsDatabase,
  input: {
    actor: ConversationActor
    items: ReadonlyArray<{ id: string; revision: number }>
    changes: {
      assignedToUserId?: string | null
      status?: "open" | "closed" | "snoozed"
      snoozedUntil?: string | null
    }
    staffDirectory: ConversationsStaffDirectory
    runtimeBindings?: unknown
  },
): Promise<Conversation[]> {
  if (input.items.length === 0 || input.items.length > 100) {
    throw new ConversationQueryError("Bulk operations require between 1 and 100 conversations")
  }
  if (new Set(input.items.map(({ id }) => id)).size !== input.items.length) {
    throw new ConversationQueryError("Bulk operation contains duplicate conversations")
  }
  if (Object.keys(input.changes).length === 0) {
    throw new ConversationQueryError("Bulk operation has no lifecycle or assignment change")
  }
  return db.transaction(async (transaction) => {
    const tx = transaction as PostgresJsDatabase
    const updated: Conversation[] = []
    for (const item of input.items) {
      updated.push(
        await updateConversationState(tx, item.id, {
          actor: input.actor,
          revision: item.revision,
          staffDirectory: input.staffDirectory,
          runtimeBindings: input.runtimeBindings,
          ...input.changes,
        }),
      )
    }
    return updated
  })
}

export interface InboxOperationalReport {
  period: { from: string; to: string }
  volumes: { new: number; opened: number; closed: number }
  backlog: number
  averagesMs: {
    firstResponse: number | null
    resolution: number | null
    customerWaiting: number | null
  }
  delivery: { failed: number; suppressed: number }
  ingress: { averageLagMs: number | null; failedOrDrifted: number }
  sla: {
    authoritative: false
    clock: "elapsed"
    startsAt: "conversation_created"
    pauses: "none"
    reopen: "original_clock_continues"
    businessHours: "not_configured"
  }
}

function executedRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows?: unknown }).rows
    if (Array.isArray(rows)) return rows as T[]
  }
  return []
}

/** Content-free, membership-scoped operational aggregates over durable tenant rows. */
export async function getInboxOperationalReport(
  db: PostgresJsDatabase,
  input: {
    userId: string
    from: Date
    to: Date
    inboxId?: string
    deliveryTruth?: ConversationsDeliveryTruthReader
  },
): Promise<InboxOperationalReport> {
  if (input.to <= input.from) throw new ConversationQueryError("Reporting period is invalid")
  if (input.to.getTime() - input.from.getTime() > 366 * 24 * 60 * 60 * 1_000) {
    throw new ConversationQueryError("Reporting period cannot exceed 366 days")
  }
  const inboxFilter = input.inboxId ? sql`and c.inbox_id = ${input.inboxId}` : sql``
  const summaryResult = await db.execute<{
    newVolume: number
    openedVolume: number
    closedVolume: number
    backlog: number
    firstResponseMs: number | null
    resolutionMs: number | null
    customerWaitingMs: number | null
  }>(sql`
    select
      count(*) filter (where c.created_at >= ${input.from} and c.created_at < ${input.to})::int as "newVolume",
      count(*) filter (where c.last_inbound_at >= ${input.from} and c.last_inbound_at < ${input.to})::int as "openedVolume",
      count(*) filter (where c.closed_at >= ${input.from} and c.closed_at < ${input.to})::int as "closedVolume",
      count(*) filter (where c.status <> 'closed')::int as backlog,
      avg(extract(epoch from (c.first_response_at - c.created_at)) * 1000)::float8 as "firstResponseMs",
      avg(extract(epoch from (c.resolved_at - c.created_at)) * 1000)::float8 as "resolutionMs",
      avg(extract(epoch from (${input.to}::timestamptz - c.last_inbound_at)) * 1000)
        filter (where c.waiting_on = 'staff' and c.status = 'open')::float8 as "customerWaitingMs"
    from conversations c
    where exists (
      select 1 from conversation_inbox_memberships membership
      where membership.inbox_id = c.inbox_id
        and membership.user_id = ${input.userId}
        and membership.active = true
    ) ${inboxFilter}
  `)
  const [summary] = executedRows<{
    newVolume: number
    openedVolume: number
    closedVolume: number
    backlog: number
    firstResponseMs: number | null
    resolutionMs: number | null
    customerWaitingMs: number | null
  }>(summaryResult)
  const deliveryResult = await db.execute<{
    notificationDeliveryId: string | null
    admissionStatus: "received" | "pending" | "admitted" | "suppressed"
  }>(sql`
    select
      part.notification_delivery_id as "notificationDeliveryId",
      part.admission_status as "admissionStatus"
    from conversation_parts part
    join conversations c on c.id = part.conversation_id
    where part.occurred_at >= ${input.from} and part.occurred_at < ${input.to}
      and exists (
        select 1 from conversation_inbox_memberships membership
        where membership.inbox_id = c.inbox_id
          and membership.user_id = ${input.userId}
          and membership.active = true
      ) ${inboxFilter}
  `)
  const deliveryRows = executedRows<{
    notificationDeliveryId: string | null
    admissionStatus: "received" | "pending" | "admitted" | "suppressed"
  }>(deliveryResult)
  const deliveryTruth: Record<string, import("./runtime-port.js").ConversationDeliveryTruth> = {}
  const deliveryIds = deliveryRows.flatMap(({ notificationDeliveryId }) =>
    notificationDeliveryId ? [notificationDeliveryId] : [],
  )
  if (input.deliveryTruth) {
    for (let offset = 0; offset < deliveryIds.length; offset += 100) {
      Object.assign(
        deliveryTruth,
        await input.deliveryTruth.getDeliveryTruth(db, deliveryIds.slice(offset, offset + 100)),
      )
    }
  }
  let failedDeliveries = 0
  let suppressedDeliveries = 0
  for (const row of deliveryRows) {
    const truth = row.notificationDeliveryId ? deliveryTruth[row.notificationDeliveryId] : undefined
    if (truth === "failed" || truth === "bounced" || truth === "complained") {
      failedDeliveries += 1
    }
    if (truth === "suppressed" || (!truth && row.admissionStatus === "suppressed")) {
      suppressedDeliveries += 1
    }
  }
  const ingressResult = await db.execute<{
    averageLagMs: number | null
    failedOrDrifted: number
  }>(sql`
    select
      avg(extract(epoch from (operation.committed_at - operation.created_at)) * 1000)::float8 as "averageLagMs",
      count(*) filter (where operation.status = 'drifted')::int as "failedOrDrifted"
    from conversation_ingress_operations operation
    left join conversation_parts part on part.id = operation.conversation_part_id
    left join conversations c on c.id = part.conversation_id
    where operation.created_at >= ${input.from} and operation.created_at < ${input.to}
      and (c.id is null or exists (
        select 1 from conversation_inbox_memberships membership
        where membership.inbox_id = c.inbox_id
          and membership.user_id = ${input.userId}
          and membership.active = true
      )) ${inboxFilter}
  `)
  const [ingress] = executedRows<{ averageLagMs: number | null; failedOrDrifted: number }>(
    ingressResult,
  )
  return {
    period: { from: input.from.toISOString(), to: input.to.toISOString() },
    volumes: {
      new: summary?.newVolume ?? 0,
      opened: summary?.openedVolume ?? 0,
      closed: summary?.closedVolume ?? 0,
    },
    backlog: summary?.backlog ?? 0,
    averagesMs: {
      firstResponse: summary?.firstResponseMs ?? null,
      resolution: summary?.resolutionMs ?? null,
      customerWaiting: summary?.customerWaitingMs ?? null,
    },
    delivery: { failed: failedDeliveries, suppressed: suppressedDeliveries },
    ingress: {
      averageLagMs: ingress?.averageLagMs ?? null,
      failedOrDrifted: ingress?.failedOrDrifted ?? 0,
    },
    sla: {
      authoritative: false,
      clock: "elapsed",
      startsAt: "conversation_created",
      pauses: "none",
      reopen: "original_clock_continues",
      businessHours: "not_configured",
    },
  }
}
