import { createToolRegistry, type ToolContext } from "@voyant-travel/tools"
import { describe, expect, it } from "vitest"

import type { TripComponent } from "../src/schema.js"
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
  overrides: Partial<ToolContext> = {},
): ToolContext & { trips?: TripsToolServices } {
  const actor = overrides.actor ?? "staff"
  const audience = overrides.audience ?? actor
  return {
    db: {},
    actor,
    audience,
    tenantId: "default",
    resolverScope: {
      locale: "en-GB",
      audience,
      market: "default",
      actor,
      ...overrides.resolverScope,
    },
    ...overrides,
    trips: services as TripsToolServices | undefined,
  }
}

function makeRegistry() {
  const registry = createToolRegistry()
  registry.registerAll(tripsTools)
  return registry
}

function sourcedCandidates() {
  const now = new Date("2026-07-15T10:00:00.000Z")
  return {
    requirement: {
      id: "trrq_1",
      envelopeId: "trip_123",
      sequence: 0,
      status: "candidates_ready",
      title: "Three-night stay",
      description: null,
      vertical: "accommodations",
      criteria: { nights: 3 },
      criteriaVersion: "v1",
      required: true,
      selectedCandidateId: null,
      resolvedComponentId: null,
      lastSourcedAt: now,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    },
    candidates: [
      {
        id: "trcd_1",
        requirementId: "trrq_1",
        envelopeId: "trip_123",
        rank: 0,
        status: "ranked",
        candidateRef: "provider-result-1",
        entityModule: "accommodations",
        entityId: "hotel_1",
        sourceKind: "sourced",
        sourceConnectionId: "conn_1",
        sourceModule: null,
        selection: { room: "double" },
        priceCurrency: "EUR",
        priceAmount: "450.00",
        expiresAt: new Date("2026-07-15T10:30:00.000Z"),
        providerData: { confidentialNetRate: "250.00" },
        createdAt: now,
        updatedAt: now,
      },
    ],
  }
}

describe("trips tools", () => {
  it("registers trip composition and candidate workflow tools with exact posture", () => {
    const registry = makeRegistry()
    const manifest = registry.list()
    expect(manifest.map((t) => t.name).sort()).toEqual([
      "add_trip_requirement",
      "create_trip",
      "price_trip",
      "reserve_trip",
      "reshop_trip",
      "reshop_trip_requirement",
      "revise_trip",
      "select_trip_candidate",
      "source_trip_requirement_candidates",
    ])
    const reserve = manifest.find((t) => t.name === "reserve_trip")
    expect(reserve?.tier).toBe("destructive")
    expect(reserve?.requiredScopes).toEqual(["trips:write"])
    expect(reserve?.riskPolicy.destructive).toBe(true)
    const price = manifest.find((t) => t.name === "price_trip")
    expect(price).toMatchObject({
      tier: "write",
      requiredScopes: ["trips:write"],
      deploymentRisk: "medium",
    })
    expect(price?.riskPolicy).toMatchObject({
      confirmationRequired: true,
      sideEffects: ["data-write"],
    })
    const reshop = manifest.find((t) => t.name === "reshop_trip")
    expect(reshop).toMatchObject({ tier: "destructive", audience: { allowed: ["staff"] } })
    expect(reshop?.riskPolicy).toMatchObject({
      destructive: true,
      reversible: true,
      confirmationRequired: true,
    })
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
          const now = new Date("2026-05-18T00:00:00.000Z")
          return {
            id: "trcp_123",
            envelopeId: input.envelopeId,
            sequence: input.sequence,
            kind: input.kind,
            status: "draft",
            title: metadata.manualService?.name ?? null,
            description: input.description ?? null,
            entityModule: null,
            entityId: null,
            sourceKind: null,
            sourceConnectionId: null,
            sourceRef: null,
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
            pricingSnapshot: input.estimatedPricing ?? null,
            taxLines: [],
            cancellationSnapshot: null,
            holdToken: null,
            holdExpiresAt: null,
            priceExpiresAt: null,
            warningCodes: [],
            metadata: input.metadata,
            createdAt: now,
            updatedAt: now,
          } satisfies TripComponent
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

  it("rejects non-staff price requests for a different audience", async () => {
    const registry = makeRegistry()
    await expect(
      registry.dispatch(
        "price_trip",
        {
          envelopeId: "trip_123",
          scope: { locale: "en-GB", audience: "staff", market: "default", currency: "EUR" },
        },
        ctxWith(
          {
            async createTrip() {
              return baseDraft()
            },
            async addComponent() {
              throw new Error("not used")
            },
            async priceTrip() {
              throw new Error("not used")
            },
            async reserveTrip() {
              throw new Error("not used")
            },
          },
          { actor: "customer", audience: "customer" },
        ),
      ),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_DENIED" })
  })

  it("rejects non-staff reserve refresh scopes for a different audience", async () => {
    const registry = makeRegistry()
    await expect(
      registry.dispatch(
        "reserve_trip",
        {
          envelopeId: "trip_123",
          refreshScope: { locale: "en-GB", audience: "staff", market: "default" },
        },
        ctxWith(
          {
            async createTrip() {
              return baseDraft()
            },
            async addComponent() {
              throw new Error("not used")
            },
            async priceTrip() {
              throw new Error("not used")
            },
            async reserveTrip() {
              throw new Error("not used")
            },
          },
          { actor: "customer", audience: "customer" },
        ),
      ),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_DENIED" })
  })

  it("exposes tool handlers directly for unit reuse", () => {
    expect(createTripTool.name).toBe("create_trip")
    expect(priceTripTool.tier).toBe("write")
  })

  it("sources requirement candidates through the injected provider-neutral service", async () => {
    let forwarded: unknown
    const result = await makeRegistry().dispatch<{
      candidates: Array<Record<string, unknown>>
    }>(
      "source_trip_requirement_candidates",
      {
        requirementId: "trrq_1",
        scope: { locale: "en-GB", audience: "staff", market: "RO" },
        limit: 10,
      },
      ctxWith({
        async sourceRequirementCandidates(input) {
          forwarded = input
          return sourcedCandidates()
        },
      }),
    )
    expect(forwarded).toMatchObject({ requirementId: "trrq_1", limit: 10 })
    expect(result.candidates[0]).not.toHaveProperty("providerData")
    expect(result.candidates[0]).toMatchObject({ entityModule: "accommodations" })
  })

  it("rejects candidate sourcing across a non-staff grant audience", async () => {
    await expect(
      makeRegistry().dispatch(
        "source_trip_requirement_candidates",
        {
          requirementId: "trrq_1",
          scope: { locale: "en-GB", audience: "staff", market: "RO" },
        },
        ctxWith(
          {
            async sourceRequirementCandidates() {
              return sourcedCandidates()
            },
          },
          { actor: "customer", audience: "customer" },
        ),
      ),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_DENIED" })
  })
})
