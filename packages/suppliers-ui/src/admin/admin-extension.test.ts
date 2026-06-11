import { describe, expect, it } from "vitest"

import {
  createSuppliersAdminExtension,
  SupplierDetailHost,
  SupplierDetailSkeleton,
  SuppliersHost,
  SuppliersListSkeleton,
  supplierDetailPaymentPolicySlot,
} from "./index.js"

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

  it("does not attach components to contributions (hosts take route props)", () => {
    // The contribution contract renders zero-prop pages; SupplierDetailHost
    // takes the supplier id as a prop, so host route files stay the binding
    // layer until the RFC §4.2 code-based route assembly lands.
    const extension = createSuppliersAdminExtension()
    for (const route of extension.routes ?? []) {
      expect(route.component).toBeUndefined()
    }
  })
})

describe("packaged suppliers admin hosts", () => {
  // Importable + renderable component types — the operator's thin route hosts
  // bind these directly, so a broken import surface fails here, not in an app
  // build. (Behavioral rendering needs the workspace provider stack and lives
  // with the host apps.)
  it("exports the page hosts as components from the admin entrypoint", () => {
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
