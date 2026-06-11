import { describe, expect, it } from "vitest"

import {
  BookingDetailHost,
  BookingDetailSkeleton,
  BookingInvoiceSheet,
  BookingsHost,
  BookingsListSkeleton,
  bookingDetailSearchSchema,
  bookingsFiltersToSearch,
  bookingsIndexSearchSchema,
  bookingsSearchToFilters,
  createBookingsAdminExtension,
} from "./index.js"

describe("createBookingsAdminExtension", () => {
  it("contributes no navigation (bookings nav is base-nav-owned)", () => {
    const extension = createBookingsAdminExtension()
    expect(extension.id).toBe("bookings")
    expect(extension.navigation).toBeUndefined()
  })

  it("describes the list and detail routes with unique ids and paths", () => {
    const extension = createBookingsAdminExtension()
    const routes = extension.routes ?? []
    expect(routes).toHaveLength(2)
    expect(new Set(routes.map((route) => route.id)).size).toBe(2)
    expect(routes.map((route) => route.path)).toEqual(["/bookings", "/bookings/$id"])
  })

  it("honors basePath and label", () => {
    const extension = createBookingsAdminExtension({
      basePath: "/reservations",
      label: "Rezervări",
    })
    const index = extension.routes?.find((route) => route.id === "bookings-index")
    expect(index?.path).toBe("/reservations")
    expect(index?.title).toBe("Rezervări")
    const detail = extension.routes?.find((route) => route.id === "bookings-detail")
    expect(detail?.path).toBe("/reservations/$id")
  })

  it("carries the packaged search contracts", () => {
    const extension = createBookingsAdminExtension()
    const index = extension.routes?.find((route) => route.id === "bookings-index")
    expect(index?.validateSearch?.({ status: "confirmed", offset: "20" })).toMatchObject({
      status: "confirmed",
      offset: 20,
    })
    const detail = extension.routes?.find((route) => route.id === "bookings-detail")
    expect(detail?.validateSearch?.({ tab: "finance" })).toMatchObject({ tab: "finance" })
  })

  it("does not attach components to contributions (hosts take route props)", () => {
    // The contribution contract renders zero-prop pages; both bookings hosts
    // take route params/search as props, so host route files stay the
    // binding layer until the RFC §4.2 code-based route assembly lands.
    const extension = createBookingsAdminExtension()
    for (const route of extension.routes ?? []) {
      expect(route.component).toBeUndefined()
    }
  })

  it("contributes the person-bookings widget on crm-ui's bookings-tab slot", () => {
    // The crm-ui ↔ bookings-ui cycle resolution (RFC §4.7): crm-ui's
    // PersonDetailHost mounts its Bookings tab off this contribution.
    const extension = createBookingsAdminExtension()
    const widget = extension.widgets?.find((entry) => entry.id === "bookings-person-bookings")
    expect(widget?.slot).toBe("person.details.bookings-tab")
    expect(typeof widget?.component).toBe("function")
  })
})

describe("bookings list search contract", () => {
  it("round-trips a filter snapshot through the URL projection", () => {
    const search = bookingsIndexSearchSchema.parse({
      search: "smith",
      status: "confirmed",
      sortBy: "startDate",
      sortDir: "asc",
      offset: "40",
    })
    const filters = bookingsSearchToFilters(search)
    expect(filters).toMatchObject({
      search: "smith",
      status: "confirmed",
      sortBy: "startDate",
      sortDir: "asc",
      offset: 40,
    })
  })

  it("drops defaults so the unfiltered list keeps a clean URL", () => {
    const projected = bookingsFiltersToSearch({
      search: "",
      status: "all",
      productId: null,
      optionId: null,
      supplierId: null,
      productCategoryId: null,
      personId: null,
      organizationId: null,
      availabilitySlotId: null,
      dateFrom: null,
      dateTo: null,
      paxMin: "",
      paxMax: "",
      sortBy: "createdAt",
      sortDir: "desc",
      offset: 0,
    })
    expect(Object.values(projected).every((value) => value === undefined)).toBe(true)
  })

  it("rejects unknown tabs on the detail contract", () => {
    expect(() => bookingDetailSearchSchema.parse({ tab: "nope" })).toThrow()
    expect(bookingDetailSearchSchema.parse({})).toEqual({})
  })
})

describe("packaged bookings admin hosts", () => {
  // Importable + renderable component types — the operator's thin route hosts
  // bind these directly, so a broken import surface fails here, not in an app
  // build. (Behavioral rendering needs the workspace provider stack and lives
  // with the host apps.)
  it("exports the page hosts as components from the admin entrypoint", () => {
    for (const host of [
      BookingDetailHost,
      BookingDetailSkeleton,
      BookingInvoiceSheet,
      BookingsHost,
      BookingsListSkeleton,
    ]) {
      expect(typeof host).toBe("function")
    }
  })
})
