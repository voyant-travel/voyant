import { describe, expect, it } from "vitest"

import { resolveAdminNavigationPreferences } from "../../src/navigation/preferences.js"
import type { NavItem } from "../../src/types.js"

const navigation: NavItem[] = [
  { id: "dashboard", title: "Dashboard", url: "/" },
  {
    id: "finance",
    title: "Finance",
    url: "/finance/invoices",
    items: [
      { id: "invoices", title: "Invoices", url: "/finance/invoices" },
      { id: "payments", title: "Payments", url: "/finance/payments" },
    ],
  },
]

describe("resolveAdminNavigationPreferences", () => {
  it("lets member values override organization values while absence inherits", () => {
    const items = resolveAdminNavigationPreferences({
      items: navigation,
      organization: { dashboard: false, finance: false, invoices: false },
      member: { dashboard: true, invoices: true },
    })

    expect(items).toEqual([
      { id: "dashboard", title: "Dashboard", url: "/" },
      {
        id: "finance",
        title: "Finance",
        url: "/finance/invoices",
        structural: true,
        items: [
          { id: "invoices", title: "Invoices", url: "/finance/invoices" },
          { id: "payments", title: "Payments", url: "/finance/payments" },
        ],
      },
    ])
  })

  it("keeps hidden parents as structural containers for visible children", () => {
    const [finance] = resolveAdminNavigationPreferences({
      items: navigation,
      organization: { dashboard: false, finance: false, payments: false },
      member: {},
    })

    expect(finance).toMatchObject({ id: "finance", structural: true })
    expect(finance?.items?.map((item) => item.id)).toEqual(["invoices"])
  })

  it("ignores unknown preference ids and cannot add ineligible items", () => {
    const items = resolveAdminNavigationPreferences({
      items: [navigation[0]!],
      organization: { unauthorized: true, removed_module: false },
      member: { another_unknown: true },
    })

    expect(items.map((item) => item.id)).toEqual(["dashboard"])
  })
})
