import { createToolRegistry, type ToolContext } from "@voyant-travel/tools"
import { describe, expect, it } from "vitest"

import { type InventoryToolServices, inventoryTools } from "../src/tools.js"

function ctxWith(
  services?: Partial<InventoryToolServices>,
): ToolContext & { inventory?: InventoryToolServices } {
  return {
    db: {},
    actor: "customer",
    audience: "customer",
    tenantId: "default",
    resolverScope: { locale: "en-GB", audience: "customer", market: "default", actor: "customer" },
    inventory: services as InventoryToolServices | undefined,
  }
}

function makeRegistry() {
  const registry = createToolRegistry()
  registry.registerAll(inventoryTools)
  return registry
}

describe("inventory tools", () => {
  it("registers read-only products tools gated on products:read", () => {
    const manifest = makeRegistry().list()
    expect(manifest.map((t) => t.name).sort()).toEqual(["get_product", "list_products"])
    for (const tool of manifest) {
      expect(tool.tier).toBe("read")
      expect(tool.requiredScopes).toEqual(["products:read"])
      expect(tool.riskPolicy.destructive).toBe(false)
    }
  })

  it("lists products through the injected service", async () => {
    const registry = makeRegistry()
    const result = await registry.dispatch<{ data: unknown[]; total: number }>(
      "list_products",
      { limit: 10 },
      ctxWith({
        async listProducts() {
          return { data: [{ id: "prod_1" }, { id: "prod_2" }], total: 2, limit: 10, offset: 0 }
        },
        async getProductById() {
          return null
        },
      }),
    )
    expect(result.data).toHaveLength(2)
    expect(result.total).toBe(2)
  })

  it("reads a single product and normalizes not-found to null", async () => {
    const registry = makeRegistry()
    const result = await registry.dispatch<{ product: unknown }>(
      "get_product",
      { id: "missing" },
      ctxWith({
        async listProducts() {
          return { data: [], total: 0, limit: 24, offset: 0 }
        },
        async getProductById() {
          return null
        },
      }),
    )
    expect(result.product).toBeNull()
  })

  it("throws MISSING_SERVICE when inventory is not wired", async () => {
    const registry = makeRegistry()
    await expect(
      registry.dispatch("list_products", { limit: 10 }, ctxWith(undefined)),
    ).rejects.toMatchObject({ code: "MISSING_SERVICE" })
  })
})
