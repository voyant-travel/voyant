import { createToolRegistry, type ToolContext } from "@voyant-travel/tools"
import { describe, expect, it } from "vitest"

import {
  type BookingRequirementsToolServices,
  bookingRequirementsTools,
} from "../src/requirements/tools.js"

function context(service?: BookingRequirementsToolServices): ToolContext & {
  bookingRequirements?: BookingRequirementsToolServices
} {
  return {
    db: {},
    actor: "staff",
    audience: "staff",
    tenantId: "default",
    resolverScope: { locale: "en-GB", audience: "staff", market: "default", actor: "staff" },
    bookingRequirements: service,
  }
}

function registry() {
  const registry = createToolRegistry()
  registry.registerAll(bookingRequirementsTools)
  return registry
}

describe("booking requirements tools", () => {
  it("registers complete non-destructive definition, trigger, answer, and public-read Tools", () => {
    const manifest = registry().list()
    expect(manifest).toHaveLength(33)
    expect(new Set(manifest.map((tool) => tool.name)).size).toBe(33)
    expect(manifest.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "get_public_transport_requirements",
        "list_product_contact_requirements",
        "create_product_booking_question",
        "update_booking_question_extra_trigger",
        "list_booking_answers",
        "update_booking_answer",
      ]),
    )
    for (const tool of manifest) {
      expect(tool.owner).toBe("@voyant-travel/bookings#requirements")
      expect(tool.capabilityVersion).toBe("v1")
      expect(tool.name).not.toContain("delete")
    }
    expect(
      manifest.find((tool) => tool.name === "get_public_transport_requirements"),
    ).toMatchObject({
      audience: { source: "grant", allowed: ["staff", "customer"] },
      requiredScopes: ["bookings:read"],
    })
    expect(manifest.find((tool) => tool.name === "list_booking_answers")).toMatchObject({
      audience: { source: "grant", allowed: ["staff"] },
      requiredScopes: ["bookings:read", "bookings-pii:read"],
      tier: "sensitive",
    })
  })

  it("dispatches typed answer reads and converts timestamps to JSON-safe strings", async () => {
    const result = await registry().dispatch<{ createdAt: string }>(
      "get_booking_answer",
      { id: "bans_1" },
      context({
        async execute(operation, input) {
          expect(operation).toBe("getBookingAnswerById")
          expect(input).toEqual({ id: "bans_1" })
          return {
            id: "bans_1",
            bookingId: "book_1",
            productBookingQuestionId: "pbq_1",
            bookingTravelerId: "btrav_1",
            bookingExtraId: null,
            target: "traveler",
            valueText: "Vegetarian",
            valueNumber: null,
            valueBoolean: null,
            valueJson: null,
            notes: null,
            createdAt: new Date("2026-07-15T08:00:00.000Z"),
            updatedAt: new Date("2026-07-15T08:00:00.000Z"),
          }
        },
      }),
    )
    expect(result.createdAt).toBe("2026-07-15T08:00:00.000Z")
  })

  it("fails closed when the deployment omits requirement services", async () => {
    await expect(
      registry().dispatch("get_public_transport_requirements", { productId: "prod_1" }, context()),
    ).rejects.toMatchObject({ code: "MISSING_SERVICE" })
  })
})
