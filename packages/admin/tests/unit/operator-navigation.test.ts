import { describe, expect, it } from "vitest"

import { createOperatorAdminNavigation } from "../../src/navigation/operator-navigation.js"
import type { OperatorAdminMessages } from "../../src/providers/operator-admin-messages.js"

const navMessages: OperatorAdminMessages["nav"] = {
  availability: "Availability",
  bookings: "Bookings",
  catalog: "Catalog",
  catalogOrders: "Orders",
  categories: "Categories",
  contractNumberSeries: "Number Series",
  contractTemplates: "Contract Templates",
  contracts: "Contracts",
  dashboard: "Dashboard",
  finance: "Finance",
  flightOrders: "Orders",
  flights: "Flights",
  legal: "Legal",
  notificationDeliveries: "Deliveries",
  notificationReminderRules: "Reminder Rules",
  notificationReminderRuns: "Reminder Runs",
  notificationTemplates: "Templates",
  notifications: "Notifications",
  organizations: "Organizations",
  people: "People",
  policies: "Policies",
  products: "Products",
  resources: "Resources",
  settings: "Settings",
  suppliers: "Suppliers",
}

describe("createOperatorAdminNavigation", () => {
  it("creates the standard operator navigation order", () => {
    const items = createOperatorAdminNavigation({ messages: navMessages })

    expect(items.map((item) => item.id)).toEqual([
      "dashboard",
      "catalog",
      "flights",
      "products",
      "bookings",
      "notifications",
      "suppliers",
      "people",
      "organizations",
      "availability",
      "resources",
      "finance",
      "legal",
      "channel-sync",
      "settings",
    ])
  })

  it("keeps expected nested routes stable", () => {
    const items = createOperatorAdminNavigation({ messages: navMessages })

    expect(items.find((item) => item.id === "products")?.items).toEqual([
      {
        id: "product-categories",
        title: "Categories",
        url: "/products/categories",
      },
    ])
    expect(items.find((item) => item.id === "legal")?.items?.map((item) => item.id)).toEqual([
      "contracts",
      "contract-templates",
      "policies",
      "number-series",
    ])
  })
})
