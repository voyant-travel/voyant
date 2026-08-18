import { and, desc, eq, gte, lt, lte, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type {
  PersonCommunicationDeliveryStatus,
  PersonConversationPart,
  PersonNotificationDelivery,
  PersonTimelineBoundary,
  RelationshipsPersonConversationsRuntime,
  RelationshipsPersonNotificationsRuntime,
} from "../runtime-port.js"
import { communicationLog } from "../schema.js"

export type PersonCommunicationSource = "logged" | "conversation" | "notification"

export interface PersonCommunicationEntry {
  id: string
  personId: string
  organizationId: string | null
  conversationId: string | null
  channel: "email" | "phone" | "whatsapp" | "sms" | "meeting" | "other"
  direction: "inbound" | "outbound"
  subject: string | null
  content: string | null
  deliveryStatus: PersonCommunicationDeliveryStatus | null
  occurredAt: Date
  createdAt: Date
  source: PersonCommunicationSource
}

export interface PersonTimelineQuery {
  limit: number
  cursor?: string
  channel?: PersonCommunicationEntry["channel"]
  direction?: PersonCommunicationEntry["direction"]
  dateFrom?: string
  dateTo?: string
}

export interface PersonTimelinePage {
  data: PersonCommunicationEntry[]
  nextCursor: string | null
}

interface CursorPayload {
  v: 1
  personId: string
  filters: string
  boundary: PersonTimelineBoundary
}

const sourceRank: Record<PersonCommunicationSource, number> = {
  logged: 0,
  conversation: 1,
  notification: 2,
}

export class InvalidPersonTimelineCursorError extends Error {
  readonly code = "invalid_person_timeline_cursor"
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url")
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8")
}

function filterIdentity(query: PersonTimelineQuery): string {
  return JSON.stringify({
    channel: query.channel ?? null,
    direction: query.direction ?? null,
    dateFrom: query.dateFrom ?? null,
    dateTo: query.dateTo ?? null,
  })
}

export function encodePersonTimelineCursor(
  personId: string,
  query: PersonTimelineQuery,
  boundary: PersonTimelineBoundary,
): string {
  return base64UrlEncode(
    JSON.stringify({ v: 1, personId, filters: filterIdentity(query), boundary }),
  )
}

export function decodePersonTimelineCursor(
  cursor: string | undefined,
  personId: string,
  query: PersonTimelineQuery,
): PersonTimelineBoundary | undefined {
  if (!cursor) return undefined
  try {
    const parsed = JSON.parse(base64UrlDecode(cursor)) as Partial<CursorPayload>
    if (
      parsed.v !== 1 ||
      parsed.personId !== personId ||
      parsed.filters !== filterIdentity(query) ||
      !parsed.boundary ||
      !["logged", "conversation", "notification"].includes(parsed.boundary.source) ||
      typeof parsed.boundary.id !== "string" ||
      Number.isNaN(new Date(parsed.boundary.occurredAt).getTime())
    ) {
      throw new InvalidPersonTimelineCursorError()
    }
    return parsed.boundary
  } catch (error) {
    if (error instanceof InvalidPersonTimelineCursorError) throw error
    throw new InvalidPersonTimelineCursorError()
  }
}

function comesAfterBoundary(
  source: PersonCommunicationSource,
  id: string,
  occurredAt: Date,
  boundary: PersonTimelineBoundary,
): boolean {
  const timestamp = occurredAt.getTime()
  const boundaryTimestamp = new Date(boundary.occurredAt).getTime()
  if (timestamp !== boundaryTimestamp) return timestamp < boundaryTimestamp
  if (sourceRank[source] !== sourceRank[boundary.source]) {
    return sourceRank[source] > sourceRank[boundary.source]
  }
  return id < boundary.id
}

function compareTimeline(left: PersonCommunicationEntry, right: PersonCommunicationEntry): number {
  const timestamp = right.occurredAt.getTime() - left.occurredAt.getTime()
  if (timestamp !== 0) return timestamp
  const source = sourceRank[left.source] - sourceRank[right.source]
  if (source !== 0) return source
  return right.id.localeCompare(left.id)
}

async function listLogged(
  db: PostgresJsDatabase,
  personId: string,
  query: PersonTimelineQuery,
  boundary: PersonTimelineBoundary | undefined,
): Promise<PersonCommunicationEntry[]> {
  const orderedAt = sql<Date>`coalesce(${communicationLog.sentAt}, ${communicationLog.createdAt})`
  const conditions = [eq(communicationLog.personId, personId)]
  if (query.channel) conditions.push(eq(communicationLog.channel, query.channel))
  if (query.direction) conditions.push(eq(communicationLog.direction, query.direction))
  if (query.dateFrom) conditions.push(gte(orderedAt, new Date(query.dateFrom)))
  if (query.dateTo) conditions.push(lte(orderedAt, new Date(query.dateTo)))
  if (boundary) {
    const at = new Date(boundary.occurredAt)
    const rank = sourceRank.logged
    conditions.push(
      rank > sourceRank[boundary.source]
        ? lte(orderedAt, at)
        : rank < sourceRank[boundary.source]
          ? lt(orderedAt, at)
          : or(lt(orderedAt, at), and(eq(orderedAt, at), lt(communicationLog.id, boundary.id)))!,
    )
  }
  const rows = await db
    .select()
    .from(communicationLog)
    .where(and(...conditions))
    .orderBy(desc(orderedAt), desc(communicationLog.id))
    .limit(query.limit + 1)
  return rows.map((row) => ({
    id: row.id,
    personId: row.personId,
    organizationId: row.organizationId,
    conversationId: null,
    channel: row.channel,
    direction: row.direction,
    subject: row.subject,
    content: row.content,
    deliveryStatus: null,
    occurredAt: row.sentAt ?? row.createdAt,
    createdAt: row.createdAt,
    source: "logged",
  }))
}

function conversationEntry(
  personId: string,
  part: PersonConversationPart,
): PersonCommunicationEntry {
  return {
    id: part.id,
    personId,
    organizationId: null,
    conversationId: part.conversationId,
    channel: part.channel,
    direction: part.direction,
    subject: part.subject,
    content: part.body,
    deliveryStatus: part.deliveryStatus,
    occurredAt: new Date(part.occurredAt),
    createdAt: new Date(part.createdAt),
    source: "conversation",
  }
}

function notificationEntry(
  personId: string,
  delivery: PersonNotificationDelivery,
): PersonCommunicationEntry {
  return {
    id: delivery.id,
    personId,
    organizationId: null,
    conversationId: null,
    channel: delivery.channel,
    direction: "outbound",
    subject: delivery.subject,
    content: delivery.body,
    deliveryStatus: delivery.status,
    occurredAt: new Date(delivery.occurredAt),
    createdAt: new Date(delivery.createdAt),
    source: "notification",
  }
}

/** Exact keyset merge. Each authority is queried at the same global boundary. */
export async function listPersonTimeline(
  db: PostgresJsDatabase,
  personId: string,
  query: PersonTimelineQuery,
  actorUserId: string,
  runtimes: {
    notifications?: RelationshipsPersonNotificationsRuntime
    conversations?: RelationshipsPersonConversationsRuntime
  },
): Promise<PersonTimelinePage> {
  const boundary = decodePersonTimelineCursor(query.cursor, personId, query)
  const runtimeQuery = {
    limit: query.limit + 1,
    boundary,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    channel: query.channel,
    direction: query.direction,
    includeAllStatuses: true,
    actorUserId,
  }
  const [logged, conversationParts] = await Promise.all([
    listLogged(db, personId, query, boundary),
    runtimes.conversations &&
    (!query.direction || query.direction === "inbound" || query.direction === "outbound")
      ? runtimes.conversations.listPersonParts(db, personId, runtimeQuery)
      : Promise.resolve([]),
  ])

  const channelParts = conversationParts.filter(
    (part) =>
      (!query.channel || part.channel === query.channel) &&
      (!query.direction || part.direction === query.direction),
  )
  const deliveries: PersonNotificationDelivery[] = []
  const linked = new Set<string>()
  if (runtimes.notifications && query.direction !== "inbound") {
    let notificationBoundary = boundary
    while (deliveries.length - linked.size <= query.limit) {
      const batch = await runtimes.notifications.listPersonDeliveries(db, personId, {
        ...runtimeQuery,
        boundary: notificationBoundary,
      })
      if (batch.length === 0) break
      deliveries.push(...batch)
      if (runtimes.conversations) {
        for (const id of await runtimes.conversations.findLinkedDeliveryIds(
          db,
          personId,
          batch.map((delivery) => delivery.id),
          actorUserId,
        )) {
          linked.add(id)
        }
      }
      if (batch.length < runtimeQuery.limit) break
      const last = batch.at(-1)!
      notificationBoundary = {
        occurredAt: last.occurredAt,
        source: "notification",
        id: last.id,
      }
    }
  }

  const truth = runtimes.notifications
    ? await runtimes.notifications.getDeliveryTruth(
        db,
        channelParts.flatMap((part) =>
          part.notificationDeliveryId ? [part.notificationDeliveryId] : [],
        ),
      )
    : {}
  const projectedParts = overlayConversationDeliveryTruth(channelParts, truth)

  return mergePersonTimelineCandidates(
    personId,
    query,
    boundary,
    logged,
    projectedParts,
    deliveries,
    linked,
  )
}

export function overlayConversationDeliveryTruth(
  parts: readonly PersonConversationPart[],
  truth: Readonly<Record<string, PersonCommunicationDeliveryStatus>>,
): PersonConversationPart[] {
  return parts.map((part) => ({
    ...part,
    deliveryStatus: part.notificationDeliveryId
      ? (truth[part.notificationDeliveryId] ?? null)
      : part.deliveryStatus,
  }))
}

/** Pure merge used to prove pagination independently from database adapters. */
export function mergePersonTimelineCandidates(
  personId: string,
  query: PersonTimelineQuery,
  boundary: PersonTimelineBoundary | undefined,
  logged: readonly PersonCommunicationEntry[],
  conversationParts: readonly PersonConversationPart[],
  deliveries: readonly PersonNotificationDelivery[],
  linkedDeliveryIds: ReadonlySet<string>,
): PersonTimelinePage {
  const merged = [
    ...logged,
    ...conversationParts.map((part) => conversationEntry(personId, part)),
    ...deliveries
      .filter((delivery) => !linkedDeliveryIds.has(delivery.id))
      .map((delivery) => notificationEntry(personId, delivery)),
  ]
    .filter(
      (entry) =>
        !boundary || comesAfterBoundary(entry.source, entry.id, entry.occurredAt, boundary),
    )
    .sort(compareTimeline)

  const data = merged.slice(0, query.limit)
  const last = data.at(-1)
  return {
    data,
    nextCursor:
      merged.length > query.limit && last
        ? encodePersonTimelineCursor(personId, query, {
            occurredAt: last.occurredAt.toISOString(),
            source: last.source,
            id: last.id,
          })
        : null,
  }
}
