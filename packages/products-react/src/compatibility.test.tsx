import { describe, expect, it } from "vitest"

import { productsQueryKeys, VoyantProductsProvider } from "./index.js"
import { ProductCombobox } from "./ui.js"

describe("@voyantjs/products-react compatibility package", () => {
  it("re-exports Inventory React runtime helpers under the legacy package", () => {
    expect(ProductCombobox).toBeDefined()
    expect(productsQueryKeys).toBeDefined()
    expect(VoyantProductsProvider).toBeDefined()
  })
})
