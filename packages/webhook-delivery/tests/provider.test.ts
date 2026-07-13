import type { EventEnvelope } from "@voyant-travel/core"
import { describe, expect, it, vi } from "vitest"
import { createPostgresWebhookDeliveryEnqueuer } from "../src/postgres-store.js"
import {
  type OutboundWebhookDeliveryEnqueuer,
  resolveOutboundWebhookDeliveryEnqueuer,
} from "../src/provider.js"

const event: EventEnvelope = {
  name: "catalog.entity.updated",
  data: { id: "product_1" },
  emittedAt: "2026-07-13T12:00:00.000Z",
}

describe("outbound webhook enqueue providers", () => {
  it("resolves explicit providers and disables enqueueing for none", async () => {
    const postgres: OutboundWebhookDeliveryEnqueuer = { enqueue: vi.fn(async () => ["queued"]) }
    const host: OutboundWebhookDeliveryEnqueuer = { enqueue: vi.fn(async () => ["hosted"]) }
    const createPostgres = vi.fn(() => postgres)

    expect(
      resolveOutboundWebhookDeliveryEnqueuer({ provider: "postgres", createPostgres, host }),
    ).toBe(postgres)
    expect(resolveOutboundWebhookDeliveryEnqueuer({ provider: "host", host })).toBe(host)
    expect(resolveOutboundWebhookDeliveryEnqueuer({ provider: "none", createPostgres, host })).toBe(
      undefined,
    )
    expect(createPostgres).toHaveBeenCalledOnce()
  })

  it("requires an explicit supported provider", () => {
    const postgres: OutboundWebhookDeliveryEnqueuer = { enqueue: vi.fn() }

    expect(() =>
      resolveOutboundWebhookDeliveryEnqueuer({
        provider: "",
        createPostgres: () => postgres,
      }),
    ).toThrow(/must be explicitly selected/)
    expect(() =>
      resolveOutboundWebhookDeliveryEnqueuer({
        provider: undefined,
        createPostgres: () => postgres,
      }),
    ).toThrow(/must be explicitly selected/)
    expect(() => resolveOutboundWebhookDeliveryEnqueuer({ provider: "host" })).toThrow(
      /requires host\.deliverEvent/,
    )
    expect(() =>
      resolveOutboundWebhookDeliveryEnqueuer({
        provider: "external-queue",
        createPostgres: () => postgres,
      }),
    ).toThrow(/is not supported/)
  })

  it("adapts bindings to the package-owned Postgres queue", async () => {
    const database = { kind: "database" }
    const bindings = { DATABASE_URL: "postgres://example.invalid/voyant" }
    const resolveDatabase = vi.fn(() => database as never)
    const queue = { enqueue: vi.fn(async () => []) }
    const enqueuer = createPostgresWebhookDeliveryEnqueuer({
      resolveDatabase,
      queue,
    })

    await expect(enqueuer.enqueue(event, bindings)).resolves.toEqual([])
    expect(resolveDatabase).toHaveBeenCalledWith(bindings)
    expect(queue.enqueue).toHaveBeenCalledWith(event)
  })
})
