import type { EventBus } from "@voyant-travel/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it } from "vitest"

import { PRODUCT_PUBLICATION_CHANGED_EVENT } from "../../src/events.js"
import { emitChannelPublicationChanges } from "../../src/service/channels.js"

function channelLookupDb(channel: { kind: string; status: string } | null) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => (channel ? [channel] : []) }),
      }),
    }),
  } as unknown as PostgresJsDatabase
}

function capturingBus() {
  const events: Array<{ event: string; data: Record<string, unknown> }> = []
  const bus = {
    async emit(event: string, data: unknown) {
      events.push({ event, data: data as Record<string, unknown> })
    },
    subscribe() {
      return { unsubscribe() {} } as ReturnType<EventBus["subscribe"]>
    },
  } as EventBus
  return { bus, events }
}

const targets = [
  { mappingId: "mapping_1", productId: "product_1", active: true },
  { mappingId: "mapping_2", productId: "product_2", active: true },
]

describe("Channel publication fanout", () => {
  it("emits an observable reindex trigger for every Product after Channel deactivation", async () => {
    const { bus, events } = capturingBus()

    await emitChannelPublicationChanges(
      bus,
      channelLookupDb({ kind: "direct", status: "inactive" }),
      "channel_1",
      targets,
      "updated",
    )

    expect(events).toHaveLength(2)
    expect(events.every((event) => event.event === PRODUCT_PUBLICATION_CHANGED_EVENT)).toBe(true)
    expect(new Set(events.map((event) => event.data.productId))).toEqual(
      new Set(["product_1", "product_2"]),
    )
    for (const event of events) {
      expect(event.data).toMatchObject({
        channelId: "channel_1",
        operation: "updated",
        previousActive: true,
        nextActive: true,
        channelStatus: "inactive",
      })
    }
  })

  it("emits a deletion trigger for every Product after Channel cascade deletion", async () => {
    const { bus, events } = capturingBus()

    await emitChannelPublicationChanges(bus, channelLookupDb(null), "channel_1", targets, "deleted")

    expect(events).toHaveLength(2)
    expect(new Set(events.map((event) => event.data.productId))).toEqual(
      new Set(["product_1", "product_2"]),
    )
    for (const event of events) {
      expect(event.data).toMatchObject({
        channelId: "channel_1",
        operation: "deleted",
        previousActive: true,
        nextActive: null,
        channelStatus: null,
      })
    }
  })
})
