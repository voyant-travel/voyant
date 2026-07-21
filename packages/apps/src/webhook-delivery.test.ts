import { newId } from "@voyant-travel/db/lib/typeid"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it, vi } from "vitest"
import { createAppWebhookDeliveryStore, replayAppWebhookDelivery } from "./webhook-delivery.js"

function selectionDb(rows: unknown[]): PostgresJsDatabase {
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: async () => rows,
  }
  return { select: () => chain } as never
}

const subscription = {
  id: "appws_1",
  installationId: "apin_1",
  appId: "app_1",
  eventVersion: "1.0.0",
  endpointUrl: "https://smartbill.example.com/webhooks/voyant",
  signingKeyId: "key_1",
}

describe("app webhook delivery signing authority", () => {
  it("persists app ownership even when the event originated in another module", async () => {
    let inserted: Record<string, unknown> | undefined
    const now = new Date("2026-07-21T12:00:00Z")
    const selectChain = {
      from: () => selectChain,
      where: () => selectChain,
      limit: async () => [],
    }
    const insertChain = {
      values(value: Record<string, unknown>) {
        inserted = value
        return insertChain
      },
      returning: async () => [
        {
          ...inserted,
          responseStatus: null,
          responseHeaders: null,
          responseBodyExcerpt: null,
          finishedAt: null,
          durationMs: null,
          errorClass: null,
          errorMessage: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    }
    const db = {
      select: () => selectChain,
      insert: () => insertChain,
    } as never as PostgresJsDatabase
    const store = createAppWebhookDeliveryStore(db, {
      resolveSigningKey: vi.fn(async () => ({ id: "key_1", secret: "s".repeat(32) })),
    })

    const enqueued = await store.enqueueAttempt({
      id: newId("webhook_deliveries"),
      sourceModule: "finance",
      sourceEvent: "invoice.issued",
      sourceEntityModule: "finance",
      sourceEntityId: "inv_1",
      subscriptionId: "appws_1",
      targetUrl: "https://smartbill.example.com/webhooks/voyant",
      requestMethod: "POST",
      requestHeaders: { "content-type": "application/json" },
      requestBodyHash: "sha256:test",
      requestBodyExcerpt: "{}",
      requestPayload: {
        name: "invoice.issued",
        data: { invoiceId: "inv_1" },
        emittedAt: now.toISOString(),
        metadata: { eventId: "evt_1" },
      },
      deliveryContract: {
        eventId: "@voyant-travel/finance#event.invoice.issued",
        eventType: "invoice.issued",
        eventVersion: "1.0.0",
        payloadSchema: { type: "object", properties: { invoiceId: { type: "string" } } },
      },
      attemptNumber: 1,
      parentDeliveryId: null,
      idempotencyKey: "graph-webhook:evt_1:appws_1",
      scheduledFor: now,
    })

    expect(inserted).toMatchObject({ sourceModule: "apps" })
    expect(enqueued.attempt.sourceModule).toBe("apps")
  })

  it("fails closed when an active subscription has no confirmed signing key", async () => {
    const store = createAppWebhookDeliveryStore(
      selectionDb([{ ...subscription, signingKeyId: null }]),
      {
        resolveSigningKey: vi.fn(async () => ({ id: "key_1", secret: "s".repeat(32) })),
      },
    )

    await expect(store.listActiveSubscriptions("invoice.issued")).rejects.toThrow(
      /no confirmed signing key/,
    )
  })

  it("fails closed when host resolution returns a different key generation", async () => {
    const store = createAppWebhookDeliveryStore(selectionDb([subscription]), {
      resolveSigningKey: vi.fn(async () => ({ id: "key_2", secret: "s".repeat(32) })),
    })

    await expect(store.listActiveSubscriptions("invoice.issued")).rejects.toThrow(
      /expects signing key key_1, not key_2/,
    )
  })

  it("preserves confirmation state after a successful delivery", async () => {
    let updated: Record<string, unknown> | undefined
    const returning = vi.fn(async () => [{ ...subscription, failureCount: 0 }])
    const updateChain = {
      set(value: Record<string, unknown>) {
        updated = value
        return updateChain
      },
      where: () => updateChain,
      returning,
    }
    const db = { update: () => updateChain } as never as PostgresJsDatabase
    const store = createAppWebhookDeliveryStore(db, {
      resolveSigningKey: vi.fn(async () => ({ id: "key_1", secret: "s".repeat(32) })),
    })

    await store.recordSubscriptionOutcome("appws_1", true, new Date("2026-07-21T12:00:00Z"))

    expect(updated).toMatchObject({ failureCount: 0 })
    expect(updated).not.toHaveProperty("signingKeyId")
  })

  it("denies replay across authenticated app installations", async () => {
    const rows = [
      [
        {
          id: "whd_1",
          subscriptionId: "appws_1",
          requestPayload: {
            schema: "voyant.app-webhook.delivery.v1",
            deliveryId: "whd_1",
            installationId: "inst_other",
            appId: "app_other",
            event: {
              type: "invoice.issued",
              schemaVersion: "1.0.0",
              occurredAt: "2026-07-21T10:00:00.000Z",
              deliveredAt: "2026-07-21T10:00:01.000Z",
            },
            attempt: { number: 1, maxRetries: 5, idempotencyKey: "delivery_1" },
            payload: { invoiceId: "inv_1" },
          },
        },
      ],
      [{ id: "inst_other", appId: "app_other", status: "active" }],
    ]
    let cursor = 0
    const query = {
      from: () => query,
      where: () => query,
      limit: async () => rows[cursor++] ?? [],
    }
    const db = {
      transaction: (operation: (tx: PostgresJsDatabase) => unknown) => operation(db as never),
      select: () => query,
    } as never as PostgresJsDatabase
    const resolveSigningKey = vi.fn(async () => ({ id: "key_1", secret: "s".repeat(32) }))

    await expect(
      replayAppWebhookDelivery(db, {
        deliveryId: "whd_1",
        actorId: "app_1",
        expectedAppId: "app_1",
        expectedInstallationId: "inst_1",
        resolveSigningKey,
      }),
    ).rejects.toThrow(/does not belong to the authenticated app installation/)
    expect(resolveSigningKey).not.toHaveBeenCalled()
  })
})
