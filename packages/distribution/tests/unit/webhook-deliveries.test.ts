import type { AnyDrizzleDb } from "@voyant-travel/db"
import { newId } from "@voyant-travel/db/lib/typeid"
import { describe, expect, it } from "vitest"

import {
  enqueueOutboundEnvelope,
  redactBodyPii,
  redactHeaders,
  redactStringPii,
} from "../../src/webhook-deliveries.js"

describe("enqueueOutboundEnvelope", () => {
  it("persists a redacted pending record without claiming an HTTP attempt", async () => {
    let values: Record<string, unknown> | undefined
    const db = {
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [] }) }),
      }),
      insert: () => ({
        values: (input: Record<string, unknown>) => {
          values = input
          return {
            returning: async () => [
              {
                ...input,
                createdAt: new Date(),
                updatedAt: new Date(),
                responseStatus: null,
                responseHeaders: null,
                responseBodyExcerpt: null,
                finishedAt: null,
                durationMs: null,
                errorClass: null,
                errorMessage: null,
                requestPayload: null,
                deliveryContract: null,
              },
            ],
          }
        },
      }),
    } as unknown as AnyDrizzleDb

    const delivery = await enqueueOutboundEnvelope(db, {
      sourceModule: "operator-webhooks",
      sourceEvent: "catalog.entity.updated",
      subscriptionId: newId("webhook_subscriptions"),
      targetUrl: "https://partner.example.test/hooks",
      requestMethod: "POST",
      requestHeaders: { Authorization: "Bearer private" },
      requestBody: { entity_id: "prod_1", email: "private@example.test" },
      idempotencyKey: "graph-webhook:evt_1:hksub_1",
    })

    expect(delivery.status).toBe("pending")
    expect(delivery.startedAt).toBeNull()
    expect(values).toMatchObject({
      status: "pending",
      startedAt: null,
      requestHeaders: { Authorization: "[REDACTED]" },
      idempotencyKey: "graph-webhook:evt_1:hksub_1",
    })
    expect(values?.requestBodyExcerpt).toContain("[REDACTED]")
    expect(values?.scheduledFor).toBeInstanceOf(Date)
  })
})

describe("redactHeaders", () => {
  it("returns null for undefined", () => {
    expect(redactHeaders(undefined)).toBeNull()
  })

  it("redacts well-known auth headers (case-insensitive)", () => {
    const input = {
      Authorization: "Bearer xxx",
      authorization: "Basic yyy",
      "X-Api-Key": "abc123",
      "x-api-token": "tok",
      "Set-Cookie": "session=zzz",
      cookie: "id=42",
      "Content-Type": "application/json",
      "User-Agent": "voyant-channel-push/1.0",
    }
    const out = redactHeaders(input)
    expect(out).toEqual({
      Authorization: "[REDACTED]",
      authorization: "[REDACTED]",
      "X-Api-Key": "[REDACTED]",
      "x-api-token": "[REDACTED]",
      "Set-Cookie": "[REDACTED]",
      cookie: "[REDACTED]",
      "Content-Type": "application/json",
      "User-Agent": "voyant-channel-push/1.0",
    })
  })

  it("preserves header name casing on redacted entries", () => {
    const out = redactHeaders({ AUTHORIZATION: "x" })
    expect(out).toHaveProperty("AUTHORIZATION", "[REDACTED]")
  })

  it("returns an empty object for empty input (not null)", () => {
    expect(redactHeaders({})).toEqual({})
  })
})

describe("redactBodyPii", () => {
  it("redacts known PII keys regardless of casing or separators", () => {
    const out = redactBodyPii({
      bookingId: "book_123",
      firstName: "Mihai",
      last_name: "Doe",
      email: "mihai@example.com",
      phoneNumber: "+40712345678",
      cardNumber: "4111111111111111",
      passport_number: "AB123456",
    }) as Record<string, unknown>
    expect(out.bookingId).toBe("book_123")
    expect(out.firstName).toBe("[REDACTED]")
    expect(out.last_name).toBe("[REDACTED]")
    expect(out.email).toBe("[REDACTED]")
    expect(out.phoneNumber).toBe("[REDACTED]")
    expect(out.cardNumber).toBe("[REDACTED]")
    expect(out.passport_number).toBe("[REDACTED]")
  })

  it("recurses into nested objects and arrays", () => {
    const out = redactBodyPii({
      booking: {
        travelers: [
          { firstName: "A", lastName: "B", email: "a@b.com" },
          { firstName: "C", lastName: "D", email: "c@d.com" },
        ],
      },
    }) as { booking: { travelers: Array<Record<string, unknown>> } }
    expect(out.booking.travelers).toHaveLength(2)
    expect(out.booking.travelers[0]?.firstName).toBe("[REDACTED]")
    expect(out.booking.travelers[1]?.email).toBe("[REDACTED]")
  })

  it("scrubs email and phone shapes from free-text values", () => {
    const out = redactBodyPii({
      notes: "Contact me at john@example.com or +1 555 123 4567 please",
      label: "no PII here",
    }) as Record<string, string>
    expect(out.notes).not.toContain("john@example.com")
    expect(out.notes).not.toContain("+1 555 123 4567")
    expect(out.notes).toContain("[REDACTED]")
    expect(out.label).toBe("no PII here")
  })

  it("passes through primitives untouched", () => {
    expect(redactBodyPii(42)).toBe(42)
    expect(redactBodyPii(true)).toBe(true)
    expect(redactBodyPii(null)).toBe(null)
    expect(redactBodyPii(undefined)).toBe(undefined)
  })
})

describe("redactStringPii", () => {
  it("redacts emails", () => {
    expect(redactStringPii("Send to bob+filter@a.co please")).toBe("Send to [REDACTED] please")
  })

  it("redacts phone-shaped numbers", () => {
    expect(redactStringPii("Call +40 712 345 678")).toBe("Call [REDACTED]")
  })

  it("leaves unrelated text alone", () => {
    expect(redactStringPii("booking #book_abc confirmed")).toBe("booking #book_abc confirmed")
  })
})
