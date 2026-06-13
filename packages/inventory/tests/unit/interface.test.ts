import { describe, expect, it } from "vitest"

import {
  inventoryInterfaceDescriptor,
  inventoryModule,
  inventoryProductLinkable,
} from "../../src/index.js"

describe("Inventory Interface", () => {
  it("declares Inventory as the operated authoring module", () => {
    expect(inventoryModule.name).toBe("inventory")
    expect(inventoryProductLinkable).toMatchObject({
      module: "inventory",
      entity: "product",
      table: "products",
    })
    expect(inventoryInterfaceDescriptor.authoringSurfaces).toContain("product-version")
    expect(inventoryInterfaceDescriptor.catalogResponsibilities).toContain("overlay")
  })
})
