import { describe, expect, it } from "vitest"

import { createCatalogAdminExtension, productDetailSearchSchema } from "./index.js"

describe("createCatalogAdminExtension", () => {
  it("contributes no navigation (catalog nav is base-nav-owned)", () => {
    const extension = createCatalogAdminExtension()
    expect(extension.id).toBe("catalog")
    expect(extension.navigation).toBeUndefined()
  })

  it("describes one route per catalog surface page with unique ids and paths", () => {
    const extension = createCatalogAdminExtension()
    const routes = extension.routes ?? []
    expect(routes).toHaveLength(10)
    expect(new Set(routes.map((route) => route.id)).size).toBe(10)
    expect(new Set(routes.map((route) => route.path)).size).toBe(10)
    for (const surface of ["products", "excursions", "tours", "cruises", "accommodations"]) {
      expect(routes.some((route) => route.path === `/catalog/${surface}`)).toBe(true)
    }
  })

  it("honors basePath and surface labels", () => {
    const extension = createCatalogAdminExtension({
      basePath: "/shop",
      labels: { products: "Pachete" },
    })
    const index = extension.routes?.find((route) => route.id === "catalog-products-index")
    expect(index?.path).toBe("/shop/products")
    expect(index?.title).toBe("Pachete")
  })

  it("carries the packaged browse search contract", () => {
    const extension = createCatalogAdminExtension()
    const index = extension.routes?.find((route) => route.id === "catalog-products-index")
    expect(index?.validateSearch?.({ q: "rome", page: "2" })).toMatchObject({
      q: "rome",
      page: 2,
    })
  })

  it("coerces the product detail search params", () => {
    expect(productDetailSearchSchema.parse({ adults: "2", nights: "7" })).toEqual({
      adults: 2,
      nights: 7,
    })
  })
})
