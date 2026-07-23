import { createToolRegistry, type ToolContext } from "@voyant-travel/tools"
import { describe, expect, it } from "vitest"

import { type DistributionToolServices, distributionTools } from "../src/tools.js"

function ctx(services?: Partial<DistributionToolServices>): ToolContext & {
  distribution?: DistributionToolServices
} {
  return {
    db: {},
    actor: "staff",
    audience: "staff",
    tenantId: "default",
    resolverScope: { locale: "en-GB", audience: "staff", market: "default", actor: "staff" },
    distribution: services as DistributionToolServices | undefined,
  }
}

function registry() {
  const registry = createToolRegistry()
  registry.registerAll(distributionTools)
  return registry
}

describe("distribution tools", () => {
  it("registers supplier, channel, and external-reference capabilities", () => {
    const tools = registry().list()
    expect(tools.map(({ name }) => name).sort()).toEqual([
      "create_distribution_channel",
      "create_external_reference",
      "create_supplier",
      "get_distribution_channel",
      "get_external_reference",
      "get_supplier",
      "get_supplier_aggregates",
      "list_distribution_channels",
      "list_external_references",
      "list_suppliers",
      "update_distribution_channel",
      "update_external_reference",
      "update_supplier",
    ])
    expect(tools.every(({ audience }) => audience.allowed?.includes("staff"))).toBe(true)
    expect(
      tools.filter(({ name }) => name.startsWith("create_") || name.startsWith("update_")),
    ).toHaveLength(6)
    expect(
      tools
        .filter(({ name }) => name.startsWith("create_"))
        .every(({ riskPolicy }) => !riskPolicy.reversible && !riskPolicy.destructive),
    ).toBe(true)
    expect(
      tools
        .filter(({ name }) => name.startsWith("update_"))
        .every(({ riskPolicy }) => riskPolicy.reversible && !riskPolicy.destructive),
    ).toBe(true)
  })

  it("routes reads through the injected service and normalizes dates", async () => {
    const timestamp = new Date("2026-07-15T10:00:00.000Z")
    const services = ctx({
      async getSupplierById() {
        return null
      },
      async getExternalRefById(id) {
        return {
          id,
          entityType: "supplier",
          entityId: "supp_1",
          sourceSystem: "partner",
          objectType: "supplier",
          namespace: "default",
          externalId: "EXT-1",
          externalParentId: null,
          isPrimary: true,
          status: "active",
          lastSyncedAt: null,
          metadata: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
      },
    })

    await expect(
      registry().dispatch("get_supplier", { id: "supp_1" }, services),
    ).resolves.toBeNull()
    await expect(
      registry().dispatch<Record<string, unknown>>(
        "get_external_reference",
        { id: "exrf_00000000000000000000000000" },
        services,
      ),
    ).resolves.toMatchObject({
      id: "exrf_00000000000000000000000000",
      createdAt: timestamp.toISOString(),
    })
  })

  it("fails closed when runtime wiring is missing", async () => {
    await expect(registry().dispatch("list_suppliers", {}, ctx())).rejects.toMatchObject({
      code: "MISSING_SERVICE",
    })
  })
})
