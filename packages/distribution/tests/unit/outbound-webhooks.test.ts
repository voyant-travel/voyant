import { describe, expect, it, vi } from "vitest"

import { enqueueGraphWebhookEvent } from "../../src/outbound-webhooks.js"

describe("enqueueGraphWebhookEvent", () => {
  it("delegates a selected event to the package-owned durable queue", async () => {
    const enqueue = vi.fn(async () => [{ status: "succeeded" }] as never)
    const queue = { enqueue }
    const event = {
      name: "catalog.entity.updated",
      data: { entity_module: "products", entity_id: "prod_123", email: "private@test.io" },
      metadata: {
        eventId: "evt_123",
        category: "domain" as const,
        graphEventId: "@voyant-travel/catalog#event.entity.updated",
        graphEventVersion: "1.0.0",
        graphEventSourceModule: "catalog",
        graphEventPayloadSchema: {
          type: "object",
          required: ["entity_module", "entity_id"],
          properties: {
            entity_module: { type: "string" },
            entity_id: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      emittedAt: "2026-07-10T12:00:00.000Z",
    }

    await enqueueGraphWebhookEvent({} as never, event, { queue })

    expect(enqueue).toHaveBeenCalledOnce()
    expect(enqueue).toHaveBeenCalledWith(event)
  })

  it("rejects envelopes without the event id required for replay deduplication", async () => {
    await expect(
      enqueueGraphWebhookEvent({} as never, {
        name: "catalog.entity.updated",
        data: {},
        metadata: {
          graphEventId: "@voyant-travel/catalog#event.entity.updated",
          graphEventVersion: "1.0.0",
          graphEventPayloadSchema: { type: "object", properties: {} },
        },
        emittedAt: "2026-07-10T12:00:00.000Z",
      }),
    ).rejects.toThrow(/requires metadata\.eventId/)
  })
})
