import { describe, expect, it, vi } from "vitest"

import {
  assertWebhookSubscriptionCreateEvents,
  assertWebhookSubscriptionUpdateEvents,
  prepareExternalWebhookEvent,
} from "../src/contracts.js"
import { createWebhookSubscriptionService } from "../src/subscriptions.js"

const contracts = [
  {
    eventId: "@acme/catalog#event.updated",
    eventType: "catalog.entity.updated",
    eventVersion: "1.0.0",
    payloadSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" },
        secret: { type: "string", "x-voyant-redact": true },
      },
      additionalProperties: false,
    },
  },
] as const

describe("external webhook contracts", () => {
  it("rejects subscription events outside the selected external catalog", () => {
    expect(() =>
      assertWebhookSubscriptionCreateEvents({ events: ["catalog.entity.deleted"] }, contracts),
    ).toThrow(/outside the selected external catalog/)
    expect(() =>
      assertWebhookSubscriptionUpdateEvents({ events: ["catalog.entity.deleted"] }, contracts),
    ).toThrow(/outside the selected external catalog/)
  })

  it("projects payload fields and redacts schema-marked properties", () => {
    const event = prepareExternalWebhookEvent(
      {
        name: "catalog.entity.updated",
        data: { id: "prod_1", secret: "private", email: "private@example.test" },
        metadata: {
          eventId: "evt_1",
          graphEventId: "@acme/catalog#event.updated",
          graphEventVersion: "1.0.0",
          privateMetadata: "drop-me",
        },
        emittedAt: "2026-07-12T00:00:00.000Z",
      },
      contracts[0],
    )

    expect(event.data).toEqual({ id: "prod_1", secret: "[REDACTED]" })
    expect(event.metadata).not.toHaveProperty("privateMetadata")
  })

  it("fails closed when an external object schema has no explicit properties", () => {
    expect(() =>
      prepareExternalWebhookEvent(
        {
          name: "catalog.entity.updated",
          data: { id: "prod_1" },
          emittedAt: "2026-07-12T00:00:00.000Z",
        },
        { ...contracts[0], payloadSchema: { type: "object" } },
      ),
    ).toThrow(/explicit properties/)
  })

  it("validates selected events before the mutation store is called", async () => {
    const store = {
      create: vi.fn(async () => ({}) as never),
      update: vi.fn(async () => ({}) as never),
    }
    const service = createWebhookSubscriptionService({ contracts, store })
    const input = {
      url: "https://partner.example.test/hooks",
      events: ["catalog.entity.deleted"],
      secret: "s".repeat(32),
      active: true,
      maxRetries: 5,
      headers: null,
      description: null,
    }

    await expect(service.create(input)).rejects.toThrow(/outside the selected external catalog/)
    await expect(service.update("hksub_1", input)).rejects.toThrow(
      /outside the selected external catalog/,
    )
    expect(store.create).not.toHaveBeenCalled()
    expect(store.update).not.toHaveBeenCalled()
  })
})
