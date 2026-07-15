import { describe, expect, it } from "vitest"

import {
  distributionChannelPushVoyantPlugin,
  distributionVoyantModule,
} from "../../../distribution/src/voyant.js"
import { supplierDetailPaymentPolicySlot } from "../suppliers/admin/slots.js"
import {
  createDistributionAdminExtension,
  createDistributionChannelPushAdminExtension,
  createSelectedDistributionAdminExtension,
  createSelectedDistributionChannelPushAdminExtension,
} from "./index.js"

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

  it("adds only supplier navigation through the selected base factory", () => {
    const extension = createDistributionAdminExtension()
    expect(extension.id).toBe("distribution")
    expect(extension.navigation).toBeUndefined()
    expect(extension.widgets).toBeUndefined()

    const selected = createSelectedDistributionAdminExtension({
      navMessages: { suppliers: "Furnizori", channelSync: "Distributie" },
    })
    expect(
      selected.navigation?.map(({ order, items }) => ({
        order,
        ids: items.map((item) => item.id),
        titles: items.map((item) => item.title),
        urls: items.map((item) => item.url),
      })),
    ).toEqual([{ order: -80, ids: ["suppliers"], titles: ["Furnizori"], urls: ["/suppliers"] }])
    expect(selected.navigation?.every(({ items }) => items[0]?.icon)).toBe(true)
  })

  it("describes only the supplier routes in the base module", () => {
    const extension = createDistributionAdminExtension()
    const routes = extension.routes ?? []
    expect(routes).toHaveLength(2)
    expect(routes[0]?.id).toBe("suppliers-index")
    expect(routes[0]?.path).toBe("/suppliers")
    expect(routes[0]?.destination).toBe("supplier.list")
    expect(routes[1]?.id).toBe("suppliers-detail")
    expect(routes[1]?.path).toBe("/suppliers/$id")
    expect(routes[1]?.destination).toBe("supplier.detail")
  })

  it("falls back to stable English selected navigation copy", () => {
    const base = createSelectedDistributionAdminExtension({ navMessages: {} })
    const channelPush = createSelectedDistributionChannelPushAdminExtension({ navMessages: {} })
    expect(base.navigation?.[0]?.items[0]?.title).toBe("Suppliers")
    expect(channelPush.navigation?.[0]?.items[0]?.title).toBe("Channel sync")
  })

  it("keeps channel push routes and navigation extension-owned", () => {
    const extension = createDistributionChannelPushAdminExtension({
      basePath: "/sincronizare",
      label: "Distributie",
    })
    const route = extension.routes?.[0]
    expect(route?.path).toBe("/sincronizare")
    expect(route?.title).toBe("Distributie")
    expect(distributionChannelPushVoyantPlugin.admin?.routes?.map(({ path }) => path)).toEqual([
      "/channel-sync",
    ])

    const selected = createSelectedDistributionChannelPushAdminExtension({
      navMessages: { channelSync: "Distributie" },
    })
    expect(selected.navigation?.[0]?.items[0]).toMatchObject({
      id: "channel-sync",
      title: "Distributie",
      url: "/channel-sync",
    })
  })

  it("carries the channel-push route implementation as a lazy page module", async () => {
    // Packaged-admin RFC §4.8 endgame: a lazy `page` loader; no loader, no
    // search contract and no SSR override because the page fetches
    // client-side and keeps its state component-local.
    const extension = createDistributionChannelPushAdminExtension()
    const route = extension.routes?.[0]
    expect(typeof route?.page).toBe("function")
    expect(route?.component).toBeUndefined()
    expect(route?.loader).toBeUndefined()
    expect(route?.validateSearch).toBeUndefined()
    expect(route?.ssr).toBeUndefined()
    const module = await route?.page?.()
    expect(typeof module?.default).toBe("function")
  })
})
