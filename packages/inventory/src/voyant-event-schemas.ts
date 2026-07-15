export const productIdentityEventPayloadSchema = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "string" } },
  additionalProperties: false,
} as const

export const productContentChangedPayloadSchema = {
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "string" },
    axis: {
      enum: [
        "product",
        "itinerary",
        "option",
        "day",
        "media",
        "feature",
        "faq",
        "location",
        "destination",
        "category",
        "tag",
        "translation",
      ],
    },
  },
  additionalProperties: false,
} as const
