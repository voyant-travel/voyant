import { describe, expect, it } from "vitest"

import {
  insertProductCapabilitySchema,
  insertProductDeliveryFormatSchema,
  insertProductTicketSettingSchema,
} from "./validation-config.js"

describe("Service Voucher product configuration", () => {
  it("accepts the canonical delivery, capability, and message vocabulary", () => {
    expect(insertProductDeliveryFormatSchema.parse({ format: "service_voucher" })).toMatchObject({
      format: "service_voucher",
    })
    expect(
      insertProductCapabilitySchema.parse({ capability: "service_voucher_required" }),
    ).toMatchObject({ capability: "service_voucher_required" })
    expect(
      insertProductTicketSettingSchema.parse({
        serviceVoucherMessage: "Show this Service Voucher at check-in.",
      }),
    ).toMatchObject({ serviceVoucherMessage: "Show this Service Voucher at check-in." })
  })

  it("rejects the legacy voucher machine vocabulary", () => {
    expect(insertProductDeliveryFormatSchema.safeParse({ format: "voucher" }).success).toBe(false)
    expect(
      insertProductCapabilitySchema.safeParse({ capability: "voucher_required" }).success,
    ).toBe(false)
    expect(
      insertProductTicketSettingSchema.safeParse({ voucherMessage: "Legacy field" }).success,
    ).toBe(false)
  })
})
