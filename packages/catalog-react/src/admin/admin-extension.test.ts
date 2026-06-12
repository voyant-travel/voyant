import { describe, expect, it } from "vitest"

import { CatalogVerticalHost } from "./catalog-vertical-host.js"
import { CruiseDetailHost } from "./cruise-detail-host.js"
import { DynamicCatalogHost } from "./dynamic-catalog-host.js"
import { createCatalogAdminExtension, productDetailSearchSchema } from "./index.js"
import { ProductDetailHost } from "./product-detail-host.js"
import { ScheduledCatalogHost } from "./scheduled-catalog-host.js"
import { VerticalDetailHost } from "./vertical-detail-host.js"

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

  it("attaches a lazy page loader (and no eager component) to every contribution", () => {
    // Route implementations are package-owned (packaged-admin RFC §4.8):
    // each contribution carries a lazy `page` module loader the host binder
    // wraps into a code-based route, keeping every page in its own chunk.
    // No contribution attaches an eager `component` — that would pin the
    // page into the chunk that evaluates the extension factory.
    const extension = createCatalogAdminExtension()
    for (const route of extension.routes ?? []) {
      expect(typeof route.page).toBe("function")
      expect(route.component).toBeUndefined()
    }
  })

  it("resolves page loaders to modules default-exporting a page component", async () => {
    const extension = createCatalogAdminExtension()
    const detail = extension.routes?.find((route) => route.id === "catalog-cruises-detail")
    const pageModule = await detail?.page?.()
    expect(typeof pageModule?.default).toBe("function")
  })
})

describe("packaged catalog admin hosts", () => {
  // Importable + renderable component types — the operator's thin route hosts
  // bind these directly, so a broken import surface fails here, not in an app
  // build. (Behavioral rendering needs the workspace provider stack and lives
  // with the host apps.)
  it("exports the page hosts as components from their specific modules", () => {
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
