import { describe, expect, it } from "vitest"
import { createMcpToolRegistry } from "../src/mcp-registry.js"
import { createTripTool, priceTripTool, type TripComposerMcpServices } from "../src/mcp-tools.js"
import type { Trip } from "../src/service.js"

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

function makeRegistry(services?: Partial<TripComposerMcpServices>) {
  const registry = createMcpToolRegistry({
    context: {
      actor: "staff",
      tenantId: "default",
      defaultScope: { locale: "en-GB", audience: "staff", market: "default", actor: "staff" },
      tripComposer: services,
    } as never,
  })
  registry.register(createTripTool)
  registry.register(priceTripTool)
  return registry
}

describe("trip composer MCP tools", () => {
  it("creates a deterministic trip before pricing or reserve", async () => {
    const calls: string[] = []
    const registry = makeRegistry({
      async createTrip() {
        calls.push("createTrip")
        return baseDraft()
      },
      async addComponent(input) {
        const metadata = input.metadata as { manualService?: { name?: string } }
        calls.push(`addComponent:${metadata.manualService?.name}`)
        return {
          id: "trcp_123",
          envelopeId: input.envelopeId,
          sequence: input.sequence,
          kind: input.kind,
          status: "draft",
          title: null,
          description: input.description ?? null,
          entityModule: input.catalogRef?.entityModule ?? null,
          entityId: input.catalogRef?.entityId ?? null,
          sourceKind: input.catalogRef?.sourceKind ?? null,
          sourceConnectionId: input.catalogRef?.sourceConnectionId ?? null,
          sourceRef: input.catalogRef?.sourceRef ?? null,
          bookingDraftId: null,
          catalogQuoteId: null,
          bookingId: null,
          bookingGroupId: null,
          orderId: null,
          paymentSessionId: null,
          providerRef: null,
          supplierRef: null,
          componentCurrency: null,
          componentSubtotalAmountCents: null,
          componentTaxAmountCents: null,
          componentTotalAmountCents: null,
          pricingSnapshot: null,
          taxLines: [],
          cancellationSnapshot: null,
          holdToken: null,
          holdExpiresAt: null,
          priceExpiresAt: null,
          warningCodes: [],
          metadata: input.metadata,
          createdAt: new Date("2026-05-18T00:00:00.000Z"),
          updatedAt: new Date("2026-05-18T00:00:00.000Z"),
        }
      },
      priceTrip: async () => {
        throw new Error("not used")
      },
      reserveTrip: async () => {
        throw new Error("not used")
      },
    })

    const result = await registry.dispatchTool("create_trip", {
      title: "AI trip",
      components: [
        {
          kind: "manual_placeholder",
          metadata: { manualService: { name: "Transfer" }, template: "manual" },
        },
      ],
    })

    expect(result.isError).toBeUndefined()
    expect(calls).toEqual(["createTrip", "addComponent:Transfer"])
    expect(result.structuredContent?.envelope).toMatchObject({ id: "trip_123" })
  })

  it("returns a structured missing-service error when composer services are not wired", async () => {
    const registry = makeRegistry(undefined)
    const result = await registry.dispatchTool("price_trip", {
      envelopeId: "trip_123",
      scope: { locale: "en-GB", audience: "staff", market: "default", currency: "EUR" },
    })

    expect(result.isError).toBe(true)
    expect(result.structuredContent?.error).toMatchObject({
      code: "MISSING_SERVICE",
      service: "tripComposer",
    })
  })
})
