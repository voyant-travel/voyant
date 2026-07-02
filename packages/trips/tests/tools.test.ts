import { createToolRegistry, type ToolContext } from "@voyant-travel/tools"
import { describe, expect, it } from "vitest"

import type { Trip } from "../src/service.js"
import { createTripTool, priceTripTool, type TripsToolServices, tripsTools } from "../src/tools.js"

function baseDraft(): Trip {
  return {
    envelope: {
      id: "trip_123",
      status: "draft",
      title: "AI trip",
      description: null,
      travelerParty: {},
      constraints: {},
      aggregateCurrency: null,
      aggregateSubtotalAmountCents: null,
      aggregateTaxAmountCents: null,
      aggregateTotalAmountCents: null,
      aggregatePricingSnapshot: null,
      currentPriceExpiresAt: null,
      bookingGroupId: null,
      orderId: null,
      paymentSessionId: null,
      reserveIdempotencyKey: null,
      reserveStartedAt: null,
      reservedAt: null,
      checkoutIdempotencyKey: null,
      checkoutStartedAt: null,
      createdBy: null,
      updatedBy: null,
      createdAt: new Date("2026-05-18T00:00:00.000Z"),
      updatedAt: new Date("2026-05-18T00:00:00.000Z"),
    },
    components: [],
  }
}

function ctxWith(
  services?: Partial<TripsToolServices>,
): ToolContext & { trips?: TripsToolServices } {
  return {
    db: {},
    actor: "staff",
    audience: "staff",
    tenantId: "default",
    resolverScope: { locale: "en-GB", audience: "staff", market: "default", actor: "staff" },
    trips: services as TripsToolServices | undefined,
  }
}

function makeRegistry() {
  const registry = createToolRegistry()
  registry.registerAll(tripsTools)
  return registry
}

describe("trips tools", () => {
  it("registers all four trips tools with their scopes and tiers", () => {
    const registry = makeRegistry()
    const manifest = registry.list()
    expect(manifest.map((t) => t.name).sort()).toEqual([
      "create_trip",
      "price_trip",
      "reserve_trip",
      "revise_trip",
    ])
    const reserve = manifest.find((t) => t.name === "reserve_trip")
    expect(reserve?.tier).toBe("destructive")
    expect(reserve?.requiredScopes).toEqual(["trips:write"])
    expect(reserve?.riskPolicy.destructive).toBe(true)
  })

  it("creates a deterministic trip and adds components, returning pure data", async () => {
    const calls: string[] = []
    const registry = makeRegistry()
    const result = await registry.dispatch<{ envelope: { id: string }; components: unknown[] }>(
      "create_trip",
      {
        title: "AI trip",
        components: [
          {
            kind: "manual_placeholder",
            metadata: { manualService: { name: "Transfer" }, template: "manual" },
          },
        ],
      },
      ctxWith({
        async createTrip() {
          calls.push("createTrip")
          return baseDraft()
        },
        async addComponent(input) {
          const metadata = input.metadata as { manualService?: { name?: string } }
          calls.push(`addComponent:${metadata.manualService?.name}`)
          return { id: "trcp_123", envelopeId: input.envelopeId } as never
        },
        priceTrip: async () => {
          throw new Error("not used")
        },
        reserveTrip: async () => {
          throw new Error("not used")
        },
      }),
    )

    expect(calls).toEqual(["createTrip", "addComponent:Transfer"])
    expect(result.envelope).toMatchObject({ id: "trip_123" })
    expect(result.components).toHaveLength(1)
  })

  it("throws MISSING_SERVICE when the trips service is not wired", async () => {
    const registry = makeRegistry()
    await expect(
      registry.dispatch(
        "price_trip",
        {
          envelopeId: "trip_123",
          scope: { locale: "en-GB", audience: "staff", market: "default", currency: "EUR" },
        },
        ctxWith(undefined),
      ),
    ).rejects.toMatchObject({ code: "MISSING_SERVICE" })
  })

  it("exposes tool handlers directly for unit reuse", () => {
    expect(createTripTool.name).toBe("create_trip")
    expect(priceTripTool.tier).toBe("read")
  })
})
