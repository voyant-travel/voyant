import { describe, expect, it } from "vitest"

import {
  CatalogVerticalHost,
  CruiseDetailHost,
  createCatalogAdminExtension,
  DynamicCatalogHost,
  ProductDetailHost,
  productDetailSearchSchema,
  ScheduledCatalogHost,
  VerticalDetailHost,
} from "./index.js"

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

  it("does not attach components to contributions (hosts take route props)", () => {
    // The contribution contract renders zero-prop pages; every catalog host
    // takes route params/search as props, so host route files stay the
    // binding layer until the RFC §4.2 code-based route assembly lands.
    const extension = createCatalogAdminExtension()
    for (const route of extension.routes ?? []) {
      expect(route.component).toBeUndefined()
    }
  })
})

describe("packaged catalog admin hosts", () => {
  // Importable + renderable component types — the operator's thin route hosts
  // bind these directly, so a broken import surface fails here, not in an app
  // build. (Behavioral rendering needs the workspace provider stack and lives
  // with the host apps.)
  it("exports the page hosts as components from the admin entrypoint", () => {
    for (const host of [
      CatalogVerticalHost,
      CruiseDetailHost,
      DynamicCatalogHost,
      ProductDetailHost,
      ScheduledCatalogHost,
      VerticalDetailHost,
    ]) {
      expect(typeof host).toBe("function")
    }
  })
})
