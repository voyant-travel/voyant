const nullableStringSchema = {
  anyOf: [{ type: "string" }, { type: "null" }],
} as const

export const bookingFullyPaidEventPayloadSchema = {
  type: "object",
  required: ["bookingId", "paymentSessionId", "invoiceId", "amountCents", "currency", "provider"],
  properties: {
    bookingId: { type: "string" },
    paymentSessionId: { type: "string" },
    invoiceId: nullableStringSchema,
    amountCents: { type: "number" },
    currency: { type: "string" },
    provider: { type: "string" },
  },
  additionalProperties: false,
} as const

export const bookingDocumentsSentEventPayloadSchema = {
  type: "object",
  required: ["bookingId", "recipient", "deliveryId", "provider", "documentKeys"],
  properties: {
    bookingId: { type: "string" },
    recipient: { type: "string" },
    deliveryId: { type: "string" },
    provider: nullableStringSchema,
    documentKeys: { type: "array", items: { type: "string" } },
  },
  additionalProperties: false,
} as const
