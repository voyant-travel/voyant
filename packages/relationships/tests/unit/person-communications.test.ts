import { describe, expect, it } from "vitest"

import type { PersonConversationPart, PersonNotificationDelivery } from "../../src/runtime-port.js"
import {
  decodePersonTimelineCursor,
  InvalidPersonTimelineCursorError,
  mergePersonTimelineCandidates,
  overlayConversationDeliveryTruth,
  type PersonCommunicationEntry,
  type PersonTimelineQuery,
} from "../../src/service/person-communications.js"

const PERSON_ID = "person_01"
const QUERY: PersonTimelineQuery = { limit: 2 }

function logged(id: string, occurredAt: string): PersonCommunicationEntry {
  return {
    id,
    personId: PERSON_ID,
    organizationId: null,
    conversationId: null,
    channel: "phone",
    direction: "inbound",
    subject: "Manual call",
    content: null,
    deliveryStatus: null,
    occurredAt: new Date(occurredAt),
    createdAt: new Date(occurredAt),
    source: "logged",
  }
}

function part(
  id: string,
  occurredAt: string,
  notificationDeliveryId: string | null = null,
): PersonConversationPart {
  return {
    id,
    conversationId: `conversation_${id}`,
    channel: "email",
    direction: "outbound",
    subject: "Reply",
    body: "Hello",
    deliveryStatus: "accepted",
    notificationDeliveryId,
    occurredAt,
    createdAt: occurredAt,
  }
}

function delivery(id: string, occurredAt: string): PersonNotificationDelivery {
  return {
    id,
    channel: "email",
    subject: "Notice",
    body: "Hello",
    status: "bounced",
    occurredAt,
    createdAt: occurredAt,
  }
}

function page(
  query: PersonTimelineQuery,
  loggedRows: PersonCommunicationEntry[],
  parts: PersonConversationPart[],
  deliveries: PersonNotificationDelivery[],
  linked = new Set<string>(),
) {
  const boundary = decodePersonTimelineCursor(query.cursor, PERSON_ID, query)
  return mergePersonTimelineCandidates(
    PERSON_ID,
    query,
    boundary,
    loggedRows,
    parts,
    deliveries,
    linked,
  )
}

describe("Person communication timeline", () => {
  it("uses a total stable order for equal timestamps", () => {
    const at = "2026-08-03T09:00:00.000Z"
    const result = page(
      { limit: 10 },
      [logged("log_b", at), logged("log_a", at)],
      [part("part_a", at)],
      [delivery("delivery_a", at)],
    )

    expect(result.data.map((item) => item.id)).toEqual(["log_b", "log_a", "part_a", "delivery_a"])
  })

  it("paginates deeply without gaps or duplicates as sources exhaust", () => {
    const logs = [logged("log_3", "2026-08-06T00:00:00Z")]
    const parts = [
      part("part_3", "2026-08-05T00:00:00Z"),
      part("part_2", "2026-08-03T00:00:00Z"),
      part("part_1", "2026-08-01T00:00:00Z"),
    ]
    const deliveries = [
      delivery("delivery_2", "2026-08-04T00:00:00Z"),
      delivery("delivery_1", "2026-08-02T00:00:00Z"),
    ]
    const seen: string[] = []
    let cursor: string | undefined
    do {
      const result = page({ ...QUERY, cursor }, logs, parts, deliveries)
      seen.push(...result.data.map((item) => item.id))
      cursor = result.nextCursor ?? undefined
    } while (cursor)

    expect(seen).toEqual(["log_3", "part_3", "delivery_2", "part_2", "delivery_1", "part_1"])
    expect(new Set(seen).size).toBe(seen.length)
  })

  it("deduplicates a delivery linked to a Conversation Part and keeps delivery truth", () => {
    const at = "2026-08-03T09:00:00.000Z"
    const result = page(
      { limit: 10 },
      [],
      [part("part_1", at, "delivery_1")],
      [delivery("delivery_1", at), delivery("delivery_2", at)],
      new Set(["delivery_1"]),
    )

    expect(result.data.map((item) => item.id)).toEqual(["part_1", "delivery_2"])
    expect(result.data[0]).toMatchObject({
      source: "conversation",
      conversationId: "conversation_part_1",
      deliveryStatus: "accepted",
    })
    expect(result.data[1]).toMatchObject({ source: "notification", deliveryStatus: "bounced" })
  })

  it("overlays current delivery truth before linked-delivery dedupe", () => {
    const projected = overlayConversationDeliveryTruth(
      [part("part_1", "2026-08-03T09:00:00Z", "delivery_1")],
      { delivery_1: "bounced" },
    )
    expect(projected[0]?.deliveryStatus).toBe("bounced")
  })

  it("rejects malformed, cross-person, and filter-drifted cursors", () => {
    const first = page({ limit: 1 }, [logged("log_1", "2026-08-01T00:00:00Z")], [], [])
    expect(first.nextCursor).toBeNull()
    const source = page(
      { limit: 1 },
      [logged("log_2", "2026-08-02T00:00:00Z"), logged("log_1", "2026-08-01T00:00:00Z")],
      [],
      [],
    )
    expect(source.nextCursor).not.toBeNull()
    expect(() => decodePersonTimelineCursor("not-base64", PERSON_ID, QUERY)).toThrow(
      InvalidPersonTimelineCursorError,
    )
    expect(() => decodePersonTimelineCursor(source.nextCursor!, "person_02", { limit: 1 })).toThrow(
      InvalidPersonTimelineCursorError,
    )
    expect(() =>
      decodePersonTimelineCursor(source.nextCursor!, PERSON_ID, { limit: 1, channel: "email" }),
    ).toThrow(InvalidPersonTimelineCursorError)
  })
})
