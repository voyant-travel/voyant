import { describe, expect, it } from "vitest"

import {
  insertChannelProductMappingSchema,
  updateChannelProductMappingSchema,
} from "../../src/validation.js"

describe("distribution validation schemas", () => {
  it("defaults channel-push product mapping flags on create", () => {
    expect(
      insertChannelProductMappingSchema.parse({
        channelId: "channel_1",
        productId: "product_1",
        externalProductId: "EXT-1",
      }),
    ).toMatchObject({
      active: true,
      pushBookings: true,
      pushAvailability: true,
      pushContent: true,
    })
  })

  it("does not inject create defaults into product mapping patches", () => {
    expect(updateChannelProductMappingSchema.parse({ sourceKind: "demo" })).toEqual({
      sourceKind: "demo",
    })
  })
})
