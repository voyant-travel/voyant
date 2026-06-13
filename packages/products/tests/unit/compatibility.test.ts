import { describe, expect, it } from "vitest"

import {
  productLinkable,
  productsHonoModule,
  productsModule,
  productsService,
} from "../../src/index.js"
import { productRoutes } from "../../src/routes.js"
import { products } from "../../src/schema.js"

describe("@voyantjs/products compatibility package", () => {
  it("re-exports the Inventory-owned Product runtime under the legacy package", () => {
    expect(productsModule.name).toBe("products")
    expect(productLinkable.module).toBe("products")
    expect(productsHonoModule.module.name).toBe("products")
    expect(productRoutes).toBeDefined()
    expect(productsService).toBeDefined()
    expect(products).toBeDefined()
  })
})
