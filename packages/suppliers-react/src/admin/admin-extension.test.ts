import { describe, expect, it } from "vitest"

import {
  createSuppliersAdminExtension,
  SupplierDetailSkeleton,
  SuppliersListSkeleton,
  supplierDetailPaymentPolicySlot,
} from "./index.js"
import { SupplierDetailHost } from "./supplier-detail-host.js"
import { SuppliersHost } from "./suppliers-host.js"

describe("createSuppliersAdminExtension", () => {
  it("contributes no navigation (suppliers nav is base-nav-owned)", () => {
    const extension = createSuppliersAdminExtension()
    expect(extension.id).toBe("suppliers")
    expect(extension.navigation).toBeUndefined()
  })

  it("describes the list and detail routes with unique ids and paths", () => {
    const extension = createSuppliersAdminExtension()
    const routes = extension.routes ?? []
    expect(routes).toHaveLength(2)
    expect(new Set(routes.map((route) => route.id)).size).toBe(2)
    expect(routes.map((route) => route.path)).toEqual(["/suppliers", "/suppliers/$id"])
  })

  it("honors basePath and labels", () => {
    const extension = createSuppliersAdminExtension({
      basePath: "/vendors",
      labels: { suppliers: "Furnizori" },
    })
    const index = extension.routes?.find((route) => route.id === "suppliers-index")
    expect(index?.path).toBe("/vendors")
    expect(index?.title).toBe("Furnizori")
    const detail = extension.routes?.find((route) => route.id === "suppliers-detail")
    expect(detail?.path).toBe("/vendors/$id")
    expect(detail?.title).toBe("Furnizori")
  })

  it("carries no search contracts (the list keeps its filters local)", () => {
    const extension = createSuppliersAdminExtension()
    for (const route of extension.routes ?? []) {
      expect(route.validateSearch).toBeUndefined()
    }
  })

  it("carries lazy page loaders instead of eager components", async () => {
    // The full route implementation lives on the contribution (RFC §4.8):
    // `page` resolves the page module lazily so it stays code-split; no
    // eager `component` reference pins it into the workspace-chrome chunk.
    const extension = createSuppliersAdminExtension()
    for (const route of extension.routes ?? []) {
      expect(route.component).toBeUndefined()
      expect(typeof route.page).toBe("function")
      const module = await route.page?.()
      expect(typeof module?.default).toBe("function")
    }
  })

  it("attaches data loaders and pending skeletons to every route", () => {
    const extension = createSuppliersAdminExtension()
    expect(extension.routes).toHaveLength(2)
    for (const route of extension.routes ?? []) {
      expect(typeof route.loader).toBe("function")
      expect(typeof route.pendingComponent).toBe("function")
    }
  })

  it("marks the list route data-only for SSR and leaves the detail route default", () => {
    const extension = createSuppliersAdminExtension()
    const ssrById = new Map(extension.routes?.map((route) => [route.id, route.ssr]))
    expect(ssrById.get("suppliers-index")).toBe("data-only")
    expect(ssrById.get("suppliers-detail")).toBeUndefined()
  })
})

describe("packaged suppliers admin hosts", () => {
  // Importable + renderable component types — host apps bind these from
  // their SPECIFIC modules (the admin barrel re-exports types only, so the
  // workspace-chrome chunk that evaluates the factory never pins the heavy
  // hosts). A broken import surface fails here, not in an app build.
  it("exports the page hosts as components from their specific modules", () => {
    for (const host of [
      SupplierDetailHost,
      SupplierDetailSkeleton,
      SuppliersHost,
      SuppliersListSkeleton,
    ]) {
      expect(typeof host).toBe("function")
    }
  })

  it("exposes the payment-policy widget slot for finance-ui's contribution", () => {
    expect(supplierDetailPaymentPolicySlot).toBe("supplier.details.payment-policy")
  })
})
