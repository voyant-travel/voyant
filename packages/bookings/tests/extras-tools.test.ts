import { createToolRegistry, type ToolContext } from "@voyant-travel/tools"
import { describe, expect, it, vi } from "vitest"

import {
  type BookingsExtrasToolServices,
  bookingsExtrasTools,
  createBookingExtraTool,
} from "../src/extras/tools.js"

function context(service?: BookingsExtrasToolServices): ToolContext & {
  bookingsExtras?: BookingsExtrasToolServices
} {
  return {
    db: {},
    actor: "staff",
    audience: "staff",
    tenantId: "default",
    resolverScope: { locale: "en-GB", audience: "staff", market: "default", actor: "staff" },
    bookingsExtras: service,
  }
}

function registry() {
  const registry = createToolRegistry()
  registry.registerAll(bookingsExtrasTools)
  return registry
}

describe("booking extras tools", () => {
  it("registers the bounded non-destructive extra and departure-manifest surface", () => {
    const manifest = registry().list()
    expect(manifest.map((tool) => tool.name).sort()).toEqual([
      "bulk_set_slot_extra_selections",
      "bulk_update_slot_extra_collections",
      "create_booking_extra",
      "get_booking_extra",
      "get_slot_extra_manifest",
      "list_booking_extras",
      "set_slot_extra_selection",
      "update_booking_extra",
    ])
    for (const tool of manifest) {
      expect(tool.owner).toBe("@voyant-travel/bookings#extras")
      expect(tool.capabilityVersion).toBe("v1")
      expect(tool.audience).toEqual({ source: "grant", allowed: ["staff"] })
      expect(tool.name).not.toContain("delete")
    }
    expect(manifest.find((tool) => tool.name === "get_slot_extra_manifest")).toMatchObject({
      requiredScopes: ["bookings:read", "bookings-pii:read"],
      tier: "sensitive",
    })
    expect(manifest.find((tool) => tool.name === "set_slot_extra_selection")?.riskPolicy).toEqual(
      expect.objectContaining({ confirmationRequired: true, reversible: true }),
    )
  })

  it("dispatches to the injected service and serializes database timestamps", async () => {
    const calls: Array<{ operation: string; input: unknown }> = []
    const result = await registry().dispatch<{ data: Array<{ updatedAt: string }> }>(
      "list_booking_extras",
      { bookingId: "book_1", limit: 10 },
      context({
        async execute(operation, input) {
          calls.push({ operation, input })
          return {
            data: [
              {
                id: "bext_1",
                bookingId: "book_1",
                productExtraId: null,
                optionExtraConfigId: null,
                name: "Airport pickup",
                description: null,
                status: "selected",
                pricingMode: "per_booking",
                pricedPerPerson: false,
                quantity: 1,
                sellCurrency: "EUR",
                unitSellAmountCents: 2_500,
                totalSellAmountCents: 2_500,
                costCurrency: null,
                unitCostAmountCents: null,
                totalCostAmountCents: null,
                notes: null,
                metadata: null,
                createdAt: new Date("2026-07-15T08:00:00.000Z"),
                updatedAt: new Date("2026-07-15T09:00:00.000Z"),
              },
            ],
            total: 1,
            limit: 10,
            offset: 0,
          }
        },
      }),
    )
    expect(calls).toEqual([
      {
        operation: "listBookingExtras",
        input: expect.objectContaining({ bookingId: "book_1", limit: 10, offset: 0 }),
      },
    ])
    expect(result.data[0]?.updatedAt).toBe("2026-07-15T09:00:00.000Z")
  })

  it("fails closed when the deployment omits the extras service", async () => {
    await expect(registry().dispatch("list_booking_extras", {}, context())).rejects.toMatchObject({
      code: "MISSING_SERVICE",
    })
  })

  it("rejects missing generated-child policy before calling the service", async () => {
    const execute = vi.fn()
    const ctx = context({ execute })

    await expect(createBookingExtraTool.handler({} as never, ctx)).rejects.toMatchObject({
      code: "ACTION_POLICY_REQUIRED",
    })
    expect(execute).not.toHaveBeenCalled()
  })
})
