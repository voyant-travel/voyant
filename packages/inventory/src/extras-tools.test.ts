import { createToolRegistry } from "@voyant-travel/tools"
import { describe, expect, it, vi } from "vitest"
import { type InventoryExtrasToolContext, inventoryExtrasTools } from "./extras-tools.js"
import {
  createProductExtraTool,
  listProductExtrasTool,
  updateOptionExtraConfigTool,
} from "./tools.js"

const now = "2026-07-15T00:00:00.000Z"
const productExtra = {
  id: "extra_1",
  productId: "product_1",
  supplierId: null,
  code: "TRANSFER",
  name: "Airport transfer",
  description: null,
  selectionType: "optional" as const,
  pricingMode: "per_booking" as const,
  pricedPerPerson: false,
  collectionMode: "booking_total" as const,
  showOnSlotManifest: true,
  minQuantity: null,
  maxQuantity: null,
  defaultQuantity: null,
  active: true,
  sortOrder: 0,
  metadata: null,
  createdAt: now,
  updatedAt: now,
}

function context(): InventoryExtrasToolContext {
  return {
    db: {},
    actor: "staff",
    audience: "staff",
    tenantId: "tenant-1",
    resolverScope: {
      locale: "en",
      audience: "staff",
      market: "default",
      actor: "staff",
    },
    inventoryExtras: {
      listProductExtras: vi.fn(async () => ({
        data: [{ ...productExtra, createdAt: new Date(now), updatedAt: new Date(now) }],
        total: 1,
        limit: 50,
        offset: 0,
      })),
      getProductExtraById: vi.fn(async () => productExtra),
      createProductExtra: vi.fn(async () => productExtra),
      updateProductExtra: vi.fn(async () => productExtra),
      listOptionExtraConfigs: vi.fn(async () => ({ data: [], total: 0, limit: 50, offset: 0 })),
      getOptionExtraConfigById: vi.fn(async () => null),
      createOptionExtraConfig: vi.fn(async () => null),
      updateOptionExtraConfig: vi.fn(async () => null),
    },
  }
}

describe("inventory extras tools", () => {
  it("publishes all non-destructive product and option-extra capabilities", () => {
    expect(inventoryExtrasTools).toHaveLength(8)
    expect(new Set(inventoryExtrasTools.map((tool) => tool.capabilityId)).size).toBe(8)
    expect(() => createToolRegistry().registerAll(inventoryExtrasTools)).not.toThrow()
  })

  it("returns JSON-safe product-extra pages", async () => {
    await expect(
      listProductExtrasTool.handler({ limit: 50, offset: 0 }, context()),
    ).resolves.toEqual({ data: [productExtra], total: 1, limit: 50, offset: 0 })
  })

  it("guards authoring writes", () => {
    for (const tool of [createProductExtraTool, updateOptionExtraConfigTool]) {
      expect(tool.requiredScopes).toEqual(["extras:write"])
      expect(tool.tier).toBe("sensitive")
      expect(tool.riskPolicy).toMatchObject({
        destructive: false,
        sideEffects: ["data-write"],
      })
    }
    expect(createProductExtraTool.riskPolicy.reversible).toBe(false)
    expect(updateOptionExtraConfigTool.riskPolicy.reversible).toBe(true)
  })

  it("rejects missing created-child policy before calling the service", async () => {
    const ctx = context()
    const create = vi.mocked(ctx.inventoryExtras!.createProductExtra)

    await expect(createProductExtraTool.handler({} as never, ctx)).rejects.toMatchObject({
      code: "ACTION_POLICY_REQUIRED",
    })
    expect(create).not.toHaveBeenCalled()
  })
})
