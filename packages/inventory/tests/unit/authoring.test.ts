import { describe, expect, it } from "vitest"
import { productAuthoringRequests } from "../../src/authoring/schema.js"
import {
  inventoryAuthoringExtension,
  inventoryAuthoringModule,
  productGraphSpecSchema,
} from "../../src/authoring.js"

describe("Inventory authoring owner path", () => {
  it("exposes operated product graph authoring from Inventory", () => {
    expect(inventoryAuthoringModule.name).toBe("inventory-authoring")
    expect(inventoryAuthoringExtension.extension).toMatchObject({
      name: "inventory-authoring",
      module: "products",
      requiresTransactionalDb: true,
    })
    expect(inventoryAuthoringExtension.adminRoutes).toBeDefined()
  })

  it("keeps the product graph spec and idempotency table on the owner path", () => {
    expect(productGraphSpecSchema.shape.product).toBeDefined()
    expect(productAuthoringRequests).toBeDefined()
  })
})
