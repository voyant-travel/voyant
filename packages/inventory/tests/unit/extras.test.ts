import { describe, expect, it } from "vitest"

import {
  extrasCatalogPolicy,
  inventoryExtrasService,
  optionExtraConfigs,
  productExtraListQuerySchema,
  productExtras,
} from "../../src/extras.js"

describe("Inventory extras facade", () => {
  it("exposes operated add-on authoring tables and service methods", () => {
    expect(productExtras).toBeDefined()
    expect(optionExtraConfigs).toBeDefined()
    expect(inventoryExtrasService.createProductExtra).toBeTypeOf("function")
    expect(inventoryExtrasService.createOptionExtraConfig).toBeTypeOf("function")
  })

  it("keeps product extra query validation and catalog policy on the Inventory path", () => {
    expect(productExtraListQuerySchema.parse({ active: "false" }).active).toBe(false)
    expect(extrasCatalogPolicy.length).toBeGreaterThan(0)
  })
})
