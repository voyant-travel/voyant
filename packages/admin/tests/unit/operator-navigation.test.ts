import { describe, expect, it } from "vitest"

import {
  createOperatorAdminNavigation,
  filterAdminNavigationByModules,
} from "../../src/navigation/operator-navigation.js"
import type { OperatorAdminMessages } from "../../src/providers/operator-admin-messages.js"

const navMessages: OperatorAdminMessages["nav"] = {
  availability: "Availability",
  bookings: "Bookings",
  catalog: "Catalog",
  catalogAccommodations: "Accommodations",
  catalogCharters: "Charters",
  catalogCruises: "Cruises",
  catalogOrders: "Orders",
  catalogProducts: "Products",
  catalogProductsTagline: "Packages tagline",
  catalogExcursions: "Excursions",
  catalogExcursionsTagline: "Excursions tagline",
  catalogTours: "Tours",
  catalogToursTagline: "Tours tagline",
  categories: "Categories",
  actionLedger: "Logs",
  allTrips: "All trips",
  channelSync: "Distribution",
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
  newTrip: "New trip",
  organizations: "Organizations",
  people: "People",
  policies: "Policies",
  products: "Products",
  promotions: "Promotions",
  resources: "Resources",
  settings: "Settings",
  suppliers: "Suppliers",
  trips: "Trips",
}

describe("createOperatorAdminNavigation", () => {
  it("creates the standard operator navigation order", () => {
    const items = createOperatorAdminNavigation({ messages: navMessages })

    expect(items.map((item) => item.id)).toEqual([
      "dashboard",
      "catalog",
      "flights",
      "products",
      "availability",
      "bookings",
      "notifications",
      "suppliers",
      "people",
      "organizations",
      "resources",
      "finance",
      "legal",
      "channel-sync",
    ])
  })

  it("keeps expected nested routes stable", () => {
    const items = createOperatorAdminNavigation({ messages: navMessages })

    expect(items.find((item) => item.id === "catalog")).toMatchObject({
      url: "/catalog/products",
      items: [
        {
          id: "catalog-products",
          title: "Products",
          url: "/catalog/products",
        },
        {
          id: "catalog-excursions",
          title: "Excursions",
          url: "/catalog/excursions",
        },
        {
          id: "catalog-tours",
          title: "Tours",
          url: "/catalog/tours",
        },
        {
          id: "catalog-cruises",
          title: "Cruises",
          url: "/catalog/cruises",
        },
        {
          id: "catalog-accommodations",
          title: "Accommodations",
          url: "/catalog/accommodations",
        },
      ],
    })
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

describe("filterAdminNavigationByModules (voyant#3063)", () => {
  const nav = createOperatorAdminNavigation({ messages: navMessages })
  const ids = (items: ReturnType<typeof createOperatorAdminNavigation>) =>
    items.map((item) => item.id)

  it("gates the real base nav down to a deployment's active module set", () => {
    // The `[bookings, catalog]` subset resolves (server-side) to include the
    // required foundational modules — here we assert the nav gating for that set.
    const gated = filterAdminNavigationByModules(nav, [
      "action-ledger",
      "relationships",
      "identity",
      "commerce",
      "catalog",
      "bookings",
    ])

    expect(ids(gated)).toEqual(["dashboard", "catalog", "bookings", "people", "organizations"])
    // Inactive modules' base entries are gone — no dead links to unmounted APIs.
    for (const gone of ["flights", "products", "availability", "suppliers", "finance", "legal"]) {
      expect(ids(gated)).not.toContain(gone)
    }
  })

  it("maps non-identity nav ids to their backing module", () => {
    // products → inventory, availability/resources → operations,
    // suppliers/channel-sync → distribution, people/organizations → relationships.
    const withInventory = ids(filterAdminNavigationByModules(nav, ["inventory"]))
    expect(withInventory).toContain("products")
    expect(withInventory).not.toContain("availability")

    const withDistribution = ids(filterAdminNavigationByModules(nav, ["distribution"]))
    expect(withDistribution).toContain("suppliers")
    expect(withDistribution).toContain("channel-sync")
  })

  it("fails open when no active set is provided", () => {
    expect(ids(filterAdminNavigationByModules(nav, undefined))).toEqual(ids(nav))
  })

  it("keeps only unmapped items (e.g. dashboard) when the active set is empty", () => {
    expect(ids(filterAdminNavigationByModules(nav, []))).toEqual(["dashboard"])
  })
})
