import { describe, expect, it } from "vitest"

import {
  type AdminExtension,
  defineAdminExtension,
  findAdminRouteContribution,
  requireImplementedAdminRoute,
  resolveAdminNavigation,
  resolveAdminWidgets,
} from "../../src/extensions.js"

describe("admin extensions", () => {
  it("keeps the extension object shape intact", () => {
    const extension = defineAdminExtension({
      id: "finance-sync",
      routes: [{ id: "finance-sync-route", path: "/finance/sync", title: "Finance sync" }],
    })

    expect(extension.id).toBe("finance-sync")
    expect(extension.routes?.[0]?.path).toBe("/finance/sync")
  })

  it("appends navigation contributions after the base items in order", () => {
    const baseItems = [{ id: "dashboard", title: "Dashboard", url: "/" }]
    const extensions: AdminExtension[] = [
      defineAdminExtension({
        id: "late",
        navigation: [{ order: 20, items: [{ id: "reports", title: "Reports", url: "/reports" }] }],
      }),
      defineAdminExtension({
        id: "early",
        navigation: [{ order: 10, items: [{ id: "sync", title: "Sync", url: "/sync" }] }],
      }),
    ]

    const items = resolveAdminNavigation({ baseItems, extensions })

    expect(items.map((item) => item.id)).toEqual(["dashboard", "sync", "reports"])
  })

  it("returns widgets for one slot in order", () => {
    function BookingStatusCard() {
      return null
    }

    function BookingAuditCard() {
      return null
    }

    const extensions: AdminExtension[] = [
      defineAdminExtension({
        id: "booking-status",
        widgets: [
          {
            id: "status",
            slot: "booking.details.sidebar",
            order: 20,
            component: BookingStatusCard,
          },
          {
            id: "ignored",
            slot: "finance.invoice.sidebar",
            order: 5,
            component: BookingStatusCard,
          },
        ],
      }),
      defineAdminExtension({
        id: "booking-audit",
        widgets: [
          { id: "audit", slot: "booking.details.sidebar", order: 10, component: BookingAuditCard },
        ],
      }),
    ]

    const widgets = resolveAdminWidgets({ slot: "booking.details.sidebar", extensions })

    expect(widgets.map((widget) => widget.id)).toEqual(["audit", "status"])
  })

  it("accepts a redirect contribution as implemented", () => {
    const extension = defineAdminExtension({
      id: "catalog",
      routes: [
        {
          id: "catalog-index",
          path: "/catalog",
          title: "Catalog",
          redirectTo: "/catalog/products",
        },
      ],
    })

    const route = requireImplementedAdminRoute(extension, "catalog-index")

    expect(route.redirectTo).toBe("/catalog/products")
  })

  it("rejects a contribution without page, component, or redirectTo", () => {
    const extension = defineAdminExtension({
      id: "catalog",
      routes: [{ id: "catalog-index", path: "/catalog", title: "Catalog" }],
    })

    expect(() => requireImplementedAdminRoute(extension, "catalog-index")).toThrow(
      /carries no implementation/,
    )
  })

  it("resolves nested child contributions by id", () => {
    const extension = defineAdminExtension({
      id: "core",
      routes: [
        {
          id: "core-settings",
          path: "/settings",
          title: "Settings",
          page: () => Promise.resolve({ default: () => null }),
          children: [
            { id: "core-settings-index", path: "/", title: "Settings", redirectTo: "/x" },
            {
              id: "core-settings-team",
              path: "/team",
              title: "Team",
              page: () => Promise.resolve({ default: () => null }),
            },
          ],
        },
      ],
    })

    expect(findAdminRouteContribution(extension.routes, "core-settings-team")?.path).toBe("/team")
    expect(requireImplementedAdminRoute(extension, "core-settings-index").redirectTo).toBe("/x")
  })
})
