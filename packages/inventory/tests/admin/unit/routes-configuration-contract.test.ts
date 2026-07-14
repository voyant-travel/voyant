import { listResponse, listResponseSchema } from "@voyant-travel/types"
import type { InferSelectModel } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import type {
  productActivationSettings,
  productCapabilities,
  productDeliveryFormats,
  productTicketSettings,
  productVisibilitySettings,
} from "../../../src/schema-settings.js"

/**
 * Response contract tests (voyant#2114 — inventory configuration sub-batch) for
 * the product operating-configuration admin routes. Each fixture is typed as the
 * real Drizzle row so column drift breaks compilation; the JSON round-trip
 * (Date → ISO string) mirrors `c.json` so a declared/actual mismatch breaks the
 * test. The schemas below mirror the response shapes declared in
 * `routes-configuration.ts`.
 */

const isoTimestamp = z.string()

const activationModeValues = ["manual", "scheduled", "channel_controlled"] as const
const ticketFulfillmentValues = ["none", "per_booking", "per_participant", "per_item"] as const
const deliveryFormatValues = [
  "service_voucher",
  "ticket",
  "pdf",
  "qr_code",
  "barcode",
  "email",
  "mobile",
  "none",
] as const
const capabilityValues = [
  "instant_confirmation",
  "on_request",
  "pickup_available",
  "dropoff_available",
  "guided",
  "private",
  "shared",
  "digital_ticket",
  "service_voucher_required",
  "external_inventory",
  "multi_day",
  "accommodation",
  "transport",
] as const

const activationSettingSchema = z.object({
  id: z.string(),
  productId: z.string(),
  activationMode: z.enum(activationModeValues),
  activateAt: isoTimestamp.nullable(),
  deactivateAt: isoTimestamp.nullable(),
  sellAt: isoTimestamp.nullable(),
  stopSellAt: isoTimestamp.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const ticketSettingSchema = z.object({
  id: z.string(),
  productId: z.string(),
  fulfillmentMode: z.enum(ticketFulfillmentValues),
  defaultDeliveryFormat: z.enum(deliveryFormatValues),
  ticketPerUnit: z.boolean(),
  barcodeFormat: z.string().nullable(),
  serviceVoucherMessage: z.string().nullable(),
  ticketMessage: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const visibilitySettingSchema = z.object({
  id: z.string(),
  productId: z.string(),
  isSearchable: z.boolean(),
  isBookable: z.boolean(),
  isFeatured: z.boolean(),
  requiresAuthentication: z.boolean(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const capabilitySchema = z.object({
  id: z.string(),
  productId: z.string(),
  capability: z.enum(capabilityValues),
  enabled: z.boolean(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const deliveryFormatSchema = z.object({
  id: z.string(),
  productId: z.string(),
  format: z.enum(deliveryFormatValues),
  isDefault: z.boolean(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-02T00:00:00.000Z")
const productId = "product_0000000000000000000000000"

const activationSettingRow: InferSelectModel<typeof productActivationSettings> = {
  id: "product_activation_settings_0000000000",
  productId,
  activationMode: "scheduled",
  activateAt: new Date("2026-05-01T00:00:00.000Z"),
  deactivateAt: null,
  sellAt: new Date("2026-04-01T00:00:00.000Z"),
  stopSellAt: null,
  createdAt,
  updatedAt,
}

const ticketSettingRow: InferSelectModel<typeof productTicketSettings> = {
  id: "product_ticket_settings_0000000000000",
  productId,
  fulfillmentMode: "per_booking",
  defaultDeliveryFormat: "service_voucher",
  ticketPerUnit: false,
  barcodeFormat: "code128",
  serviceVoucherMessage: "Show this Service Voucher at check-in.",
  ticketMessage: null,
  createdAt,
  updatedAt,
}

const visibilitySettingRow: InferSelectModel<typeof productVisibilitySettings> = {
  id: "product_visibility_settings_0000000000",
  productId,
  isSearchable: true,
  isBookable: true,
  isFeatured: false,
  requiresAuthentication: false,
  createdAt,
  updatedAt,
}

const capabilityRow: InferSelectModel<typeof productCapabilities> = {
  id: "product_capabilities_000000000000000",
  productId,
  capability: "instant_confirmation",
  enabled: true,
  notes: null,
  createdAt,
  updatedAt,
}

const deliveryFormatRow: InferSelectModel<typeof productDeliveryFormats> = {
  id: "product_delivery_formats_00000000000",
  productId,
  format: "qr_code",
  isDefault: true,
  createdAt,
  updatedAt,
}

describe("inventory configuration list response contracts", () => {
  it("the serialized activation-settings list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([activationSettingRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(activationSettingSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized ticket-settings list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([ticketSettingRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(ticketSettingSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized visibility-settings list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([visibilitySettingRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(visibilitySettingSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized capabilities list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([capabilityRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(capabilitySchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the serialized delivery-formats list satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify(listResponse([deliveryFormatRow], { total: 1, limit: 50, offset: 0 })),
    )
    const parsed = listResponseSchema(deliveryFormatSchema).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })
})

describe("inventory configuration single-entity response contracts", () => {
  it("the activation-setting { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: activationSettingRow }))
    const parsed = z.object({ data: activationSettingSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the ticket-setting { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: ticketSettingRow }))
    const parsed = z.object({ data: ticketSettingSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the visibility-setting { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: visibilitySettingRow }))
    const parsed = z.object({ data: visibilitySettingSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the capability { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: capabilityRow }))
    const parsed = z.object({ data: capabilitySchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the delivery-format { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: deliveryFormatRow }))
    const parsed = z.object({ data: deliveryFormatSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the success envelope satisfies the declared OpenAPI schema", () => {
    const parsed = z.object({ success: z.boolean() }).safeParse({ success: true })
    expect(parsed.success).toBe(true)
  })
})
