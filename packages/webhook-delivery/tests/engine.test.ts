import { createHmac } from "node:crypto"
import type { EventEnvelope } from "@voyant-travel/core"
import { newId } from "@voyant-travel/db/lib/typeid"
import type { InfraWebhookDelivery } from "@voyant-travel/db/schema/infra"
import { describe, expect, it, vi } from "vitest"

import { createWebhookDeliveryEngine } from "../src/engine.js"
import { createSelectedExternalWebhookDeliveryEngine } from "../src/selected-engine.js"
import type {
  CompleteWebhookAttemptInput,
  EnqueueWebhookAttemptInput,
  WebhookDeliveryStore,
  WebhookSubscription,
} from "../src/types.js"

const EVENT: EventEnvelope = {
  name: "booking.created",
  data: {
    entityModule: "bookings",
    entityId: "book_1",
    email: "private@example.test",
  },
  metadata: {
    eventId: "evt_1",
    category: "domain",
    source: "workflow",
  },
  emittedAt: "2026-07-11T12:00:00.000Z",
}

const SUBSCRIPTION: WebhookSubscription = {
  id: newId("webhook_subscriptions"),
  url: "https://partner.example.test/hooks",
  secret: "a-secret-that-is-at-least-thirty-two-characters",
  headers: { Authorization: "Bearer private", "x-partner": "voyant" },
  maxRetries: 2,
}

describe("createWebhookDeliveryEngine", () => {
  it("projects selected external payloads before the canonical signed delivery path", async () => {
    const store = new MemoryWebhookDeliveryStore([SUBSCRIPTION])
    const onAudit = vi.fn()
    const request = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      expect(JSON.parse(String(init?.body))).toMatchObject({
        data: { entityModule: "bookings", entityId: "book_1" },
      })
      expect(String(init?.body)).not.toContain("private@example.test")
      expect(headers.get("x-voyant-event-contract")).toBe("@acme/bookings#event.created")
      expect(headers.get("x-voyant-event-version")).toBe("1.0.0")
      expect(headers.get("x-voyant-signature")).toMatch(/^sha256=[a-f0-9]{64}$/)
      return new Response(null, { status: 204 })
    })
    const engine = createSelectedExternalWebhookDeliveryEngine({
      contracts: [
        {
          eventId: "@acme/bookings#event.created",
          eventType: "booking.created",
          eventVersion: "1.0.0",
          payloadSchema: {
            type: "object",
            required: ["entityModule", "entityId"],
            properties: {
              entityModule: { type: "string" },
              entityId: { type: "string" },
            },
          },
        },
      ],
      store,
      fetch: request as typeof fetch,
      onAudit,
    })

    await engine.enqueue({
      ...EVENT,
      metadata: {
        ...EVENT.metadata,
        graphEventId: "@acme/bookings#event.created",
        graphEventVersion: "1.0.0",
      },
    })

    expect(request).toHaveBeenCalledOnce()
    expect(onAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: "@acme/bookings#event.created",
        contractVersion: "1.0.0",
        outcome: "succeeded",
      }),
    )
  })

  it("signs and delivers a policy-approved event while persisting redacted audit data", async () => {
    const store = new MemoryWebhookDeliveryStore([SUBSCRIPTION])
    const request = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      const body = String(init?.body)
      const timestamp = headers.get("x-voyant-timestamp") ?? ""
      expect(headers.get("authorization")).toBe("Bearer private")
      expect(headers.get("x-voyant-signature")).toBe(
        `sha256=${createHmac("sha256", SUBSCRIPTION.secret)
          .update(`${timestamp}.${body}`)
          .digest("hex")}`,
      )
      return new Response("accepted", { status: 202, headers: { "x-request-id": "req_1" } })
    }) as typeof fetch
    const engine = createWebhookDeliveryEngine({
      store,
      fetch: request,
      visibilityPolicy: { authorize: () => ({ allowed: true }) },
      now: () => new Date("2026-07-11T12:00:00.000Z"),
    })

    await expect(engine.enqueue(EVENT)).resolves.toMatchObject([
      { status: "succeeded", attempts: 1, subscriptionId: SUBSCRIPTION.id },
    ])
    expect(request).toHaveBeenCalledOnce()
    expect(store.inputs[0]?.requestHeaders.Authorization).toBe("[REDACTED]")
    expect(store.inputs[0]?.requestHeaders["x-voyant-signature"]).toBe("[REDACTED]")
    expect(store.inputs[0]?.requestBodyHash).toMatch(/^[a-f0-9]{64}$/)
    expect(store.inputs[0]?.requestBodyExcerpt).not.toContain("private@example.test")
    expect(store.outcomes).toEqual([{ subscriptionId: SUBSCRIPTION.id, succeeded: true }])
  })

  it("passes event visibility inputs to a deny-by-default policy without dispatching", async () => {
    const store = new MemoryWebhookDeliveryStore([SUBSCRIPTION])
    const request = vi.fn()
    const authorize = vi.fn(() => ({ allowed: false as const, reason: "internal event" }))
    const engine = createWebhookDeliveryEngine({
      store,
      fetch: request as typeof fetch,
      visibilityPolicy: { authorize },
    })

    await expect(engine.enqueue(EVENT)).resolves.toEqual([
      { status: "filtered", subscriptionId: SUBSCRIPTION.id, reason: "internal event" },
    ])
    expect(authorize).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "evt_1",
        category: "domain",
        source: "workflow",
        subscription: expect.not.objectContaining({ secret: expect.anything() }),
      }),
    )
    expect(request).not.toHaveBeenCalled()
    expect(store.inputs).toHaveLength(0)
  })

  it("persists bounded exponential retries and succeeds without duplicating attempts", async () => {
    const store = new MemoryWebhookDeliveryStore([SUBSCRIPTION])
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response("down", { status: 503 }))
      .mockResolvedValueOnce(new Response("limited", { status: 429 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }))
    let clock = new Date("2026-07-11T12:00:00.000Z").getTime()
    const sleep = vi.fn(async (milliseconds: number) => {
      clock += milliseconds
    })
    const engine = createWebhookDeliveryEngine({
      store,
      fetch: request as typeof fetch,
      visibilityPolicy: { authorize: () => ({ allowed: true }) },
      retry: { baseDelayMs: 10, maxDelayMs: 15 },
      sleep,
      now: () => new Date(clock),
    })

    await expect(engine.enqueue(EVENT)).resolves.toMatchObject([
      { status: "succeeded", attempts: 3 },
    ])
    expect(store.inputs.map((input) => input.attemptNumber)).toEqual([1, 2, 3])
    expect(store.records.map((record) => record.status)).toEqual(["failed", "failed", "succeeded"])
    expect(sleep).toHaveBeenNthCalledWith(1, 10)
    expect(sleep).toHaveBeenNthCalledWith(2, 15)

    await expect(engine.enqueue(EVENT)).resolves.toMatchObject([
      { status: "already_completed", attempts: 3 },
    ])
    expect(request).toHaveBeenCalledTimes(3)
    expect(store.records).toHaveLength(3)
  })

  it("dead-letters a non-retryable response and records the failed subscription outcome", async () => {
    const store = new MemoryWebhookDeliveryStore([SUBSCRIPTION])
    const request = vi.fn(async () => new Response("invalid", { status: 422 }))
    const engine = createWebhookDeliveryEngine({
      store,
      fetch: request as typeof fetch,
      visibilityPolicy: { authorize: () => ({ allowed: true }) },
    })

    await expect(engine.enqueue(EVENT)).resolves.toMatchObject([
      {
        status: "dead_lettered",
        attempts: 1,
        delivery: { status: "abandoned", errorClass: "4xx", responseStatus: 422 },
      },
    ])
    expect(request).toHaveBeenCalledOnce()
    expect(store.outcomes).toEqual([{ subscriptionId: SUBSCRIPTION.id, succeeded: false }])
  })

  it("reclaims an abandoned in-flight attempt after the claim lease expires", async () => {
    const store = new MemoryWebhookDeliveryStore([SUBSCRIPTION])
    const seeded = await store.enqueueAttempt({
      sourceModule: "graph-outbound-webhooks",
      sourceEvent: EVENT.name,
      sourceEntityModule: "bookings",
      sourceEntityId: "book_1",
      subscriptionId: SUBSCRIPTION.id,
      targetUrl: SUBSCRIPTION.url,
      requestMethod: "POST",
      requestHeaders: {},
      requestBodyHash: "stale",
      requestBodyExcerpt: null,
      attemptNumber: 1,
      parentDeliveryId: null,
      idempotencyKey: `graph-webhook:evt_1:${SUBSCRIPTION.id}`,
      scheduledFor: new Date("2026-07-11T12:00:00.000Z"),
    })
    seeded.attempt.status = "in_flight"
    seeded.attempt.startedAt = new Date("2026-07-11T12:00:00.000Z")
    const request = vi.fn(async () => new Response("ok", { status: 200 }))
    const engine = createWebhookDeliveryEngine({
      store,
      fetch: request as typeof fetch,
      visibilityPolicy: { authorize: () => ({ allowed: true }) },
      retry: { claimTimeoutMs: 30_000 },
      now: () => new Date("2026-07-11T12:01:00.000Z"),
    })

    await expect(engine.enqueue(EVENT)).resolves.toMatchObject([{ status: "succeeded" }])
    expect(request).toHaveBeenCalledOnce()
  })

  it("bounds response reads before persisting excerpts", async () => {
    const store = new MemoryWebhookDeliveryStore([SUBSCRIPTION])
    const engine = createWebhookDeliveryEngine({
      store,
      fetch: vi.fn(async () => new Response("x".repeat(100_000), { status: 200 })) as typeof fetch,
      visibilityPolicy: { authorize: () => ({ allowed: true }) },
    })

    await engine.enqueue(EVENT)

    expect(
      Buffer.byteLength(store.records[0]?.responseBodyExcerpt ?? "", "utf8"),
    ).toBeLessThanOrEqual(4 * 1024)
  })

  it("requires a stable event id before subscription lookup", async () => {
    const store = new MemoryWebhookDeliveryStore([SUBSCRIPTION])
    const engine = createWebhookDeliveryEngine({
      store,
      visibilityPolicy: { authorize: () => ({ allowed: true }) },
    })

    await expect(engine.enqueue({ ...EVENT, metadata: {} })).rejects.toThrow(
      /requires metadata\.eventId/,
    )
  })
})

class MemoryWebhookDeliveryStore implements WebhookDeliveryStore {
  readonly inputs: EnqueueWebhookAttemptInput[] = []
  readonly records: InfraWebhookDelivery[] = []
  readonly outcomes: Array<{ subscriptionId: string; succeeded: boolean }> = []

  constructor(private readonly subscriptions: WebhookSubscription[]) {}

  async listActiveSubscriptions(): Promise<WebhookSubscription[]> {
    return this.subscriptions
  }

  async enqueueAttempt(input: EnqueueWebhookAttemptInput) {
    const existing = this.records.find(
      (record) =>
        record.idempotencyKey === input.idempotencyKey &&
        record.attemptNumber === input.attemptNumber,
    )
    if (existing) return { attempt: existing, created: false }
    this.inputs.push(input)
    const timestamp = new Date()
    const attempt: InfraWebhookDelivery = {
      id: newId("webhook_deliveries"),
      sourceModule: input.sourceModule,
      sourceEvent: input.sourceEvent,
      sourceEntityModule: input.sourceEntityModule,
      sourceEntityId: input.sourceEntityId,
      subscriptionId: input.subscriptionId,
      targetUrl: input.targetUrl,
      targetKind: "subscription",
      targetRef: input.subscriptionId,
      requestMethod: input.requestMethod,
      requestHeaders: input.requestHeaders,
      requestBodyHash: input.requestBodyHash,
      requestBodyExcerpt: input.requestBodyExcerpt,
      responseStatus: null,
      responseHeaders: null,
      responseBodyExcerpt: null,
      attemptNumber: input.attemptNumber,
      parentDeliveryId: input.parentDeliveryId,
      idempotencyKey: input.idempotencyKey,
      status: "pending",
      scheduledFor: input.scheduledFor,
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      errorClass: null,
      errorMessage: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    this.records.push(attempt)
    return { attempt, created: true }
  }

  async claimAttempt(id: string, now: Date, staleBefore: Date) {
    const attempt = this.records.find((record) => record.id === id)
    const pending = attempt?.status === "pending"
    const stale =
      attempt?.status === "in_flight" &&
      attempt.startedAt !== null &&
      attempt.startedAt.getTime() <= staleBefore.getTime()
    if ((!pending && !stale) || (attempt.scheduledFor?.getTime() ?? 0) > now.getTime()) {
      return null
    }
    attempt.status = "in_flight"
    attempt.startedAt = now
    return attempt
  }

  async completeAttempt(input: CompleteWebhookAttemptInput) {
    const attempt = this.records.find((record) => record.id === input.id)
    if (!attempt) throw new Error("missing attempt")
    Object.assign(attempt, input)
    return attempt
  }

  async recordSubscriptionOutcome(subscriptionId: string, succeeded: boolean) {
    this.outcomes.push({ subscriptionId, succeeded })
  }
}
