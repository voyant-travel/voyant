import { describe, expect, it } from "vitest"

import { distributionVoyantModule } from "../../../distribution/src/voyant.js"
import { supplierDetailPaymentPolicySlot } from "../suppliers/admin/slots.js"
import { createDistributionAdminExtension } from "./index.js"

describe("createDistributionAdminExtension", () => {
  it("keeps the package-owned deployment facets aligned with the admin extension", () => {
    const extension = createDistributionAdminExtension()
    expect(distributionVoyantModule.admin?.routes?.map((route) => route.path)).toEqual(
      extension.routes?.map((route) => route.path),
    )
    expect(distributionVoyantModule.admin?.routes?.map((route) => route.runtime)).toEqual(
      extension.routes?.map(() => ({
        entry: "@voyant-travel/distribution-react/admin",
        export: "createDistributionAdminExtension",
      })),
    )
    expect(distributionVoyantModule.admin?.copy?.[0]?.runtime).toEqual({
      entry: "@voyant-travel/distribution-react/i18n",
      export: "distributionUiMessageDefinitions",
    })
    expect(distributionVoyantModule.admin?.slots).toEqual([
      {
        id: supplierDetailPaymentPolicySlot,
        routeId: "@voyant-travel/distribution#admin.route.suppliers-detail",
        contract: { supplierId: "string" },
      },
    ])
  })

  it("contributes no navigation (the channel-sync item is base-nav-owned)", () => {
    const extension = createDistributionAdminExtension()
    expect(extension.id).toBe("distribution")
    expect(extension.navigation).toBeUndefined()
    expect(extension.widgets).toBeUndefined()
  })

  it("describes the channel-sync and supplier routes", () => {
    const extension = createDistributionAdminExtension()
    const routes = extension.routes ?? []
    expect(routes).toHaveLength(3)
    expect(routes[0]?.id).toBe("distribution-channel-sync")
    expect(routes[0]?.path).toBe("/channel-sync")
    expect(routes[0]?.title).toBe("Distribution")
    expect(routes[1]?.id).toBe("suppliers-index")
    expect(routes[1]?.path).toBe("/suppliers")
    expect(routes[1]?.destination).toBe("supplier.list")
    expect(routes[2]?.id).toBe("suppliers-detail")
    expect(routes[2]?.path).toBe("/suppliers/$id")
    expect(routes[2]?.destination).toBe("supplier.detail")
  })

  it("honors basePath and labels", () => {
    const extension = createDistributionAdminExtension({
      basePath: "/sincronizare",
      labels: { channelSync: "Distributie" },
    })
    const route = extension.routes?.find(
      (candidate) => candidate.id === "distribution-channel-sync",
    )
    expect(route?.path).toBe("/sincronizare")
    expect(route?.title).toBe("Distributie")
    const suppliers = extension.routes?.find((candidate) => candidate.id === "suppliers-index")
    expect(suppliers?.title).toBe("Suppliers")
  })

  it("carries the full route implementation as a lazy page module", async () => {
    // Packaged-admin RFC §4.8 endgame: a lazy `page` loader; no loader, no
    // search contract and no SSR override because the page fetches
    // client-side and keeps its state component-local.
    const extension = createDistributionAdminExtension()
    const route = extension.routes?.find(
      (candidate) => candidate.id === "distribution-channel-sync",
    )
    expect(typeof route?.page).toBe("function")
    expect(route?.component).toBeUndefined()
    expect(route?.loader).toBeUndefined()
    expect(route?.validateSearch).toBeUndefined()
    expect(route?.ssr).toBeUndefined()
    const module = await route?.page?.()
    expect(typeof module?.default).toBe("function")
  })
})
