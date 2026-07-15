import { createToolRegistry, type ToolContext } from "@voyant-travel/tools"
import { describe, expect, it } from "vitest"

import { type OperationsToolServices, operationsTools } from "../src/tools.js"

function contextWith(overrides: Partial<OperationsToolServices>): ToolContext & {
  operations: OperationsToolServices
} {
  const unavailable = async () => {
    throw new Error("Unexpected Operations tool service call")
  }
  return {
    db: {},
    actor: "staff",
    audience: "staff",
    tenantId: "default",
    resolverScope: {
      locale: "en-GB",
      audience: "staff",
      market: "default",
      actor: "staff",
    },
    operations: {
      getAvailabilityOverview: unavailable,
      getAvailabilityAggregates: unavailable,
      listAvailabilityRules: unavailable,
      getAvailabilityRule: unavailable,
      listAvailabilityStartTimes: unavailable,
      listDepartures: unavailable,
      getDeparture: unavailable,
      listAvailabilityCloseouts: unavailable,
      ...overrides,
    },
  }
}

function registry() {
  const registry = createToolRegistry()
  registry.registerAll(operationsTools)
  return registry
}

describe("Operations tools", () => {
  it("registers stable staff-only read capabilities with serializable outputs", () => {
    const manifest = registry().list()
    expect(manifest.map((tool) => tool.name).sort()).toEqual([
      "get_availability_aggregates",
      "get_availability_overview",
      "get_availability_rule",
      "get_departure",
      "list_availability_closeouts",
      "list_availability_rules",
      "list_availability_start_times",
      "list_departures",
    ])
    for (const tool of manifest) {
      expect(tool.capabilityId).toBe(
        `@voyant-travel/operations#tool.${tool.name.replaceAll("_", "-")}`,
      )
      expect(tool.owner).toBe("@voyant-travel/operations")
      expect(tool.capabilityVersion).toBe("v1")
      expect(tool.requiredScopes).toEqual(["operations:read"])
      expect(tool.audience).toEqual({ source: "grant", allowed: ["staff"] })
      expect(tool.tier).toBe("read")
      expect(tool.deploymentRisk).toBe("low")
      expect(tool.outputSchema).toMatchObject({ type: "object" })
      expect(tool.outputSchema).not.toHaveProperty("x-voyant-schema-quality")
    }
    expect(manifest.find((tool) => tool.name === "list_departures")?.aliases).toEqual([
      "departures_list_by_product",
    ])
  })

  it("dispatches the hosted overview alias through the domain service", async () => {
    let forwarded: unknown
    const result = await registry().dispatch(
      "availability_overview",
      { productId: "prod_1", attentionLimit: 3 },
      contextWith({
        async getAvailabilityOverview(query) {
          forwarded = query
          return {
            openSlotsCount: 4,
            constrainedSlotsCount: 0,
            activeRulesCount: 2,
            activePickupPointsCount: 1,
            productsWithoutUpcomingDeparturesCount: 0,
            productsWithoutUpcomingDepartures: [],
            constrainedSlots: [],
          }
        },
      }),
    )
    expect(forwarded).toEqual({ productId: "prod_1", attentionLimit: 3 })
    expect(result).toMatchObject({ openSlotsCount: 4, activeRulesCount: 2 })
  })

  it("normalizes legacy departure filters and emits JSON-safe typed rows", async () => {
    let forwarded: unknown
    const createdAt = new Date("2026-08-01T08:00:00.000Z")
    const result = await registry().dispatch<{ data: Array<Record<string, unknown>> }>(
      "departures_list_by_product",
      {
        productId: "prod_1",
        date: "2026-09-10",
        startsAtFrom: "2026-09-01T00:00:00+03:00",
        startsAtUntil: "2026-10-01T00:00:00+03:00",
      },
      contextWith({
        async listDepartures(query) {
          forwarded = query
          return {
            data: [
              {
                id: "avsl_1",
                productId: "prod_1",
                itineraryId: null,
                optionId: null,
                facilityId: null,
                availabilityRuleId: null,
                startTimeId: null,
                dateLocal: "2026-09-10",
                startsAt: new Date("2026-09-10T06:00:00.000Z"),
                endsAt: null,
                timezone: "Europe/Bucharest",
                status: "open",
                unlimited: false,
                initialPax: 20,
                remainingPax: 12,
                initialPickups: null,
                remainingPickups: null,
                remainingResources: null,
                pastCutoff: false,
                tooEarly: false,
                nights: null,
                days: null,
                notes: null,
                createdAt,
                updatedAt: createdAt,
                endDateLocal: null,
                productName: "Danube Day Trip",
              },
            ],
            total: 1,
            limit: query.limit,
            offset: query.offset,
          }
        },
      }),
    )

    expect(forwarded).toMatchObject({
      productId: "prod_1",
      dateLocal: "2026-09-10",
      startsAtFrom: "2026-08-31T21:00:00.000Z",
      startsAtUntil: "2026-09-30T21:00:00.000Z",
      limit: 50,
      offset: 0,
    })
    expect(forwarded).not.toHaveProperty("date")
    expect(result.data[0]).toMatchObject({
      startsAt: "2026-09-10T06:00:00.000Z",
      createdAt: createdAt.toISOString(),
      productName: "Danube Day Trip",
    })
  })

  it("returns null for missing departures and rules", async () => {
    const ctx = contextWith({
      async getDeparture() {
        return null
      },
      async getAvailabilityRule() {
        return null
      },
    })
    await expect(registry().dispatch("get_departure", { id: "missing" }, ctx)).resolves.toEqual({
      departure: null,
    })
    await expect(
      registry().dispatch("availability_rule_get", { id: "missing" }, ctx),
    ).resolves.toEqual({ rule: null })
  })

  it("reads the framework-only availability dashboard projection", async () => {
    const result = await registry().dispatch(
      "get_availability_aggregates",
      { from: "2026-09-01T00:00:00.000Z", to: "2026-10-01T00:00:00.000Z" },
      contextWith({
        async getAvailabilityAggregates() {
          return {
            total: 3,
            countsByStatus: [
              { status: "open", count: 2 },
              { status: "closed", count: 1 },
              { status: "sold_out", count: 0 },
              { status: "cancelled", count: 0 },
            ],
            upcomingSlots: 2,
            upcomingPax: 31,
            monthlyDepartures: [{ yearMonth: "2026-09", count: 3 }],
          }
        },
      }),
    )
    expect(result).toMatchObject({ total: 3, upcomingSlots: 2, upcomingPax: 31 })
  })
})
