import { newId } from "@voyant-travel/db/lib/typeid"
import type { InfraWebhookDelivery, InfraWebhookSubscription } from "@voyant-travel/db/schema/infra"
import { describe, expect, it, vi } from "vitest"
import {
  webhookSubscriptionCreateSchema,
  webhookSubscriptionUpdateSchema,
} from "../src/admin-contracts.js"
import {
  createOperatorWebhookAdminService,
  type OperatorWebhookAdminStore,
} from "../src/admin-service.js"

const contract = {
  eventId: "@acme/bookings#event.created",
  eventType: "booking.created",
  eventVersion: "1.0.0",
  payloadSchema: {
    type: "object",
    required: ["bookingId"],
    properties: { bookingId: { type: "string" } },
  },
} as const

function subscription(secret: string): InfraWebhookSubscription {
  const now = new Date("2026-07-23T10:00:00.000Z")
  return {
    id: newId("webhook_subscriptions"),
    url: "https://partner.example.test/voyant",
    events: ["booking.created"],
    secret,
    active: true,
    maxRetries: 5,
    headers: null,
    description: "Booking sync",
    createdAt: now,
    updatedAt: now,
    lastDeliveryAt: null,
    failureCount: 0,
  }
}

function memoryStore(): OperatorWebhookAdminStore & {
  rows: InfraWebhookSubscription[]
  deliveries: InfraWebhookDelivery[]
} {
  const rows: InfraWebhookSubscription[] = []
  const deliveries: InfraWebhookDelivery[] = []
  return {
    rows,
    deliveries,
    listSubscriptions: vi.fn(async () => rows),
    getSubscription: vi.fn(async (id) => rows.find((row) => row.id === id) ?? null),
    createSubscription: vi.fn(async (input) => {
      const row = { ...subscription(input.secret), ...input }
      rows.push(row)
      return row
    }),
    updateSubscription: vi.fn(async (id, input) => {
      const row = rows.find((candidate) => candidate.id === id)
      if (!row) return null
      Object.assign(row, input)
      return row
    }),
    deleteSubscription: vi.fn(async () => false),
    listDeliveries: vi.fn(async () => deliveries),
    getDelivery: vi.fn(async (id) => deliveries.find((row) => row.id === id) ?? null),
    enqueueAttempt: vi.fn(async (input) => {
      const row = delivery({
        id: input.id,
        subscriptionId: input.subscriptionId,
        sourceEvent: input.sourceEvent,
        requestPayload: input.requestPayload,
        deliveryContract: input.deliveryContract,
        parentDeliveryId: input.parentDeliveryId,
      })
      deliveries.push(row)
      return row
    }),
  }
}

describe("operator webhook admin service", () => {
  it("reveals generated secrets only for creation and rotation", async () => {
    const store = memoryStore()
    const secrets = ["whsec_create", "whsec_rotate"]
    const service = createOperatorWebhookAdminService({
      contracts: [contract],
      store,
      generateSecret: () => secrets.shift() ?? "whsec_fallback",
    })

    const created = await service.createSubscription({
      url: "https://partner.example.test/voyant",
      events: ["booking.created"],
      active: true,
      maxRetries: 5,
      description: null,
    })

    expect(created.secret).toBe("whsec_create")
    expect(created.subscription).not.toHaveProperty("secret")
    expect(store.rows[0]?.secret).toBe("whsec_create")
    await expect(service.listSubscriptions()).resolves.toEqual([
      expect.not.objectContaining({ secret: expect.anything() }),
    ])
    await expect(service.getSubscription(created.subscription.id)).resolves.not.toHaveProperty(
      "secret",
    )

    const rotated = await service.rotateSubscriptionSecret(created.subscription.id)
    expect(rotated?.secret).toBe("whsec_rotate")
    expect(rotated?.subscription).not.toHaveProperty("secret")
    expect(store.rows[0]?.secret).toBe("whsec_rotate")
  })

  it("rejects events outside the graph-selected outbound catalog before persistence", async () => {
    const store = memoryStore()
    const service = createOperatorWebhookAdminService({ contracts: [contract], store })

    await expect(
      service.createSubscription({
        url: "https://partner.example.test/voyant",
        events: ["booking.cancelled"],
        active: true,
        maxRetries: 5,
        description: null,
      }),
    ).rejects.toMatchObject({ code: "invalid_subscription" })
    expect(store.createSubscription).not.toHaveBeenCalled()
  })

  it("does not admit caller-provided secrets in create or update contracts", () => {
    const create = webhookSubscriptionCreateSchema.safeParse({
      url: "https://partner.example.test/voyant",
      events: ["booking.created"],
      secret: "caller-controlled",
    })
    const update = webhookSubscriptionUpdateSchema.safeParse({
      description: "Updated",
      secret: "caller-controlled",
    })

    expect(create.success).toBe(false)
    expect(update.success).toBe(false)
  })

  it("prohibits all caller-provided custom headers", () => {
    for (const header of [
      "Authorization",
      "x-api-key",
      "x-voyant-signature",
      "X-Webhook-Token",
      "X-Partner-Secret",
      "x-partner-id",
    ]) {
      expect(
        webhookSubscriptionCreateSchema.safeParse({
          url: "https://partner.example.test/voyant",
          events: ["booking.created"],
          headers: { [header]: "private" },
        }).success,
      ).toBe(false)
    }
  })

  it("never returns persisted legacy headers or raw delivery audit data", async () => {
    const store = memoryStore()
    const row = subscription("whsec_private")
    row.headers = {
      Authorization: "Bearer private",
      "X-Webhook-Token": "webhook-private",
      "X-Partner-Secret": "partner-private",
    }
    store.rows.push(row)
    const deliveryRow = delivery({
      subscriptionId: row.id,
      requestHeaders: {
        Authorization: "Bearer private",
        "X-Webhook-Token": "webhook-private",
        "X-Partner-Secret": "partner-private",
      },
      responseHeaders: { "set-cookie": "private", "x-request-id": "request-private" },
    })
    store.deliveries.push(deliveryRow)
    const service = createOperatorWebhookAdminService({ contracts: [contract], store })

    const returnedSubscription = await service.getSubscription(row.id)
    const returnedDelivery = await service.getDelivery(deliveryRow.id)

    expect(returnedSubscription).not.toHaveProperty("headers")
    expect(returnedSubscription).not.toHaveProperty("secret")
    expect(returnedDelivery).not.toHaveProperty("requestHeaders")
    expect(returnedDelivery).not.toHaveProperty("responseHeaders")
    expect(returnedDelivery).not.toHaveProperty("requestPayload")
    expect(JSON.stringify([returnedSubscription, returnedDelivery])).not.toMatch(
      /private|X-Webhook-Token|X-Partner-Secret/i,
    )
  })

  it("does not send tests or replays for inactive subscriptions", async () => {
    const store = memoryStore()
    const row = subscription("whsec_private")
    row.active = false
    store.rows.push(row)
    const original = delivery({ subscriptionId: row.id })
    store.deliveries.push(original)
    const service = createOperatorWebhookAdminService({ contracts: [contract], store })

    await expect(service.testSubscription(row.id, {})).rejects.toMatchObject({
      code: "inactive_subscription",
    })
    await expect(service.replayDelivery(original.id)).rejects.toMatchObject({
      code: "inactive_subscription",
    })
    expect(store.enqueueAttempt).not.toHaveBeenCalled()
  })

  it("replays only events still selected by the current subscription", async () => {
    const store = memoryStore()
    const row = subscription("whsec_private")
    row.events = ["booking.cancelled"]
    store.rows.push(row)
    const original = delivery({ subscriptionId: row.id })
    store.deliveries.push(original)
    const service = createOperatorWebhookAdminService({ contracts: [contract], store })

    await expect(service.replayDelivery(original.id)).rejects.toMatchObject({
      code: "replay_not_allowed",
    })
    expect(store.enqueueAttempt).not.toHaveBeenCalled()
  })

  it("does not replay events removed from the current graph catalog", async () => {
    const store = memoryStore()
    const row = subscription("whsec_private")
    store.rows.push(row)
    const original = delivery({ subscriptionId: row.id })
    store.deliveries.push(original)
    const service = createOperatorWebhookAdminService({ contracts: [], store })

    await expect(service.replayDelivery(original.id)).rejects.toMatchObject({
      code: "replay_not_allowed",
    })
    expect(store.enqueueAttempt).not.toHaveBeenCalled()
  })

  it("rebuilds a replay against the current graph-selected contract", async () => {
    const store = memoryStore()
    const row = subscription("whsec_private")
    store.rows.push(row)
    const original = delivery({ subscriptionId: row.id })
    store.deliveries.push(original)
    const service = createOperatorWebhookAdminService({ contracts: [contract], store })

    await expect(service.replayDelivery(original.id)).resolves.toBeTruthy()
    expect(store.enqueueAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        parentDeliveryId: original.id,
        deliveryContract: contract,
        requestPayload: expect.objectContaining({ name: contract.eventType }),
      }),
    )
  })
})

function delivery(
  input: Partial<InfraWebhookDelivery> & {
    requestPayload?: Record<string, unknown>
    deliveryContract?: Record<string, unknown>
  } = {},
): InfraWebhookDelivery {
  const now = new Date("2026-07-23T10:00:00.000Z")
  return {
    id: input.id ?? newId("webhook_deliveries"),
    sourceModule: input.sourceModule ?? "bookings",
    sourceEvent: input.sourceEvent ?? "booking.created",
    sourceEntityModule: input.sourceEntityModule ?? "bookings",
    sourceEntityId: input.sourceEntityId ?? "booking_1",
    subscriptionId: input.subscriptionId ?? null,
    targetUrl: input.targetUrl ?? "https://partner.example.test/voyant",
    targetKind: input.targetKind ?? "subscription",
    targetRef: input.targetRef ?? input.subscriptionId ?? null,
    requestMethod: input.requestMethod ?? "POST",
    requestHeaders: input.requestHeaders ?? {},
    requestBodyHash: input.requestBodyHash ?? "hash",
    requestBodyExcerpt: input.requestBodyExcerpt ?? null,
    requestPayload:
      input.requestPayload ??
      ({
        name: "booking.created",
        data: { bookingId: "booking_1" },
        emittedAt: now.toISOString(),
        metadata: {
          eventId: "evt_1",
          graphEventId: contract.eventId,
          graphEventVersion: contract.eventVersion,
        },
      } as Record<string, unknown>),
    deliveryContract: input.deliveryContract ?? contract,
    responseStatus: input.responseStatus ?? null,
    responseHeaders: input.responseHeaders ?? null,
    responseBodyExcerpt: input.responseBodyExcerpt ?? null,
    attemptNumber: input.attemptNumber ?? 1,
    parentDeliveryId: input.parentDeliveryId ?? null,
    idempotencyKey: input.idempotencyKey ?? "operator-webhook:evt_1",
    status: input.status ?? "succeeded",
    scheduledFor: input.scheduledFor ?? now,
    startedAt: input.startedAt ?? now,
    finishedAt: input.finishedAt ?? now,
    durationMs: input.durationMs ?? 10,
    errorClass: input.errorClass ?? null,
    errorMessage: input.errorMessage ?? null,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  }
}
