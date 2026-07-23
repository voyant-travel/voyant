import { describe, expect, it } from "vitest"
import { z } from "zod"

import { generateWebhookTestPayload } from "../src/test-payload.js"

const now = new Date("2026-07-23T10:00:00.000Z")

describe("webhook test payload generation", () => {
  it("satisfies const discriminators and selects exactly one oneOf branch", () => {
    const schema = {
      type: "object",
      required: ["event", "target"],
      properties: {
        event: { const: "booking.created" },
        target: {
          oneOf: [
            {
              type: "object",
              required: ["kind", "bookingId"],
              properties: {
                kind: { const: "booking" },
                bookingId: { type: "string" },
              },
              additionalProperties: false,
            },
            {
              type: "object",
              required: ["kind", "quoteId"],
              properties: {
                kind: { const: "quote" },
                quoteId: { type: "string" },
              },
              additionalProperties: false,
            },
          ],
        },
      },
      additionalProperties: false,
    } as const

    const payload = generateWebhookTestPayload(schema, now)

    expect(payload).toEqual({
      event: "booking.created",
      target: { kind: "booking", bookingId: "test" },
    })
    expect(z.fromJSONSchema(schema).safeParse(payload).success).toBe(true)
  })

  it("samples a valid anyOf branch for nullable graph fields", () => {
    const schema = {
      type: "object",
      required: ["invoiceId"],
      properties: {
        invoiceId: {
          anyOf: [{ type: "string", minLength: 1 }, { type: "null" }],
        },
      },
    } as const

    const payload = generateWebhookTestPayload(schema, now)

    expect(payload).toEqual({ invoiceId: "test" })
    expect(z.fromJSONSchema(schema).safeParse(payload).success).toBe(true)
  })

  it("satisfies nested string, number, object, and array constraints", () => {
    const schema = {
      type: "object",
      required: ["details"],
      properties: {
        details: {
          type: "object",
          minProperties: 3,
          required: ["reference", "travelers", "amount"],
          properties: {
            reference: { type: "string", minLength: 8, maxLength: 8 },
            travelers: {
              type: "array",
              minItems: 2,
              items: {
                type: "object",
                required: ["role"],
                properties: { role: { const: "adult" } },
              },
            },
            amount: { type: "integer", minimum: 100, multipleOf: 25 },
          },
        },
      },
    } as const

    const payload = generateWebhookTestPayload(schema, now)

    expect(payload).toEqual({
      details: {
        reference: "testxxxx",
        travelers: [{ role: "adult" }, { role: "adult" }],
        amount: 100,
      },
    })
    expect(z.fromJSONSchema(schema).safeParse(payload).success).toBe(true)
  })
})
