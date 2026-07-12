import type { AnyDrizzleDb } from "@voyant-travel/db"
import { describe, expect, it, vi } from "vitest"

import { enqueueGraphWebhookEvent } from "../../src/outbound-webhooks.js"

function subscription(id: string, url: string) {
  return {
    id,
    url,
    events: ["catalog.entity.updated"],
    secret: "s".repeat(32),
    active: true,
    maxRetries: 5,
    headers: { Authorization: "Bearer private", "x-partner": id },
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastDeliveryAt: null,
    failureCount: 0,
  }
}

function dbReturning(rows: unknown[]): AnyDrizzleDb {
  return {
    select: () => ({
      from: () => ({
        where: async () => rows,
      }),
    }),
  } as unknown as AnyDrizzleDb
}

describe("enqueueGraphWebhookEvent", () => {
  it("fans a stable event out to the enabled matching subscriptions", async () => {
    const db = dbReturning([
      subscription("hksub_one", "https://one.example.test/hooks"),
      subscription("hksub_two", "https://two.example.test/hooks"),
    ])
    const enqueue = vi.fn(async () => ({ id: "whde_test" }) as never)
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

    await enqueueGraphWebhookEvent(db, event, { enqueue })

    expect(enqueue).toHaveBeenCalledTimes(2)
    expect(enqueue).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        sourceEvent: event.name,
        sourceEntityModule: "products",
        sourceEntityId: "prod_123",
        subscriptionId: "hksub_one",
        targetUrl: "https://one.example.test/hooks",
        idempotencyKey: "graph-webhook:evt_123:hksub_one",
        requestBody: expect.objectContaining({
          data: { entity_module: "products", entity_id: "prod_123" },
        }),
      }),
    )
  })

  it("rejects envelopes without the event id required for replay deduplication", async () => {
    await expect(
      enqueueGraphWebhookEvent(dbReturning([]), {
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
