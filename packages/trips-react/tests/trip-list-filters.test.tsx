// @vitest-environment jsdom

import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TRIP_STATUS_ALL, TripListFiltersPopover } from "../src/admin/trip-list-filters.js"

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("@voyant-travel/admin", () => ({
  useOperatorAdminMessages: () => ({
    trips: {
      statuses: {
        draft: "Draft",
        priced: "Priced",
        reserve_in_progress: "Reserve in progress",
        reserved: "Reserved",
        checkout_started: "Checkout started",
        booked: "Booked",
        failed: "Failed",
        cancelled: "Cancelled",
      },
      filters: {
        trigger: "Filters",
        allStatuses: "All statuses",
        status: "Status",
        products: "Products",
        anyProduct: "Any product",
        noProducts: "No products",
        stays: "Stays",
        anyStay: "Any stay",
        noStays: "No stays",
        cruises: "Cruises",
        anyCruise: "Any cruise",
        noCruises: "No cruises",
        hasFlight: "Has flight",
        total: "Total",
        min: "Min",
        max: "Max",
        totalMinAria: "Total minimum",
        totalMaxAria: "Total maximum",
        createdAt: "Created at",
        anyDate: "Any date",
      },
    },
  }),
}))

vi.mock("@voyant-travel/catalog-react", () => ({
  useCatalogSearch: () => ({ data: { hits: [] } }),
}))

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) {
    act(() => root?.unmount())
  }
  container?.remove()
  root = null
  container = null
})

describe("TripListFiltersPopover", () => {
  it("renders total amount filters without a spinbutton max bound", () => {
    renderFilters()

    const totalMinimum = document.querySelector<HTMLInputElement>(
      'input[aria-label="Total minimum"]',
    )
    const totalMaximum = document.querySelector<HTMLInputElement>(
      'input[aria-label="Total maximum"]',
    )

    expect(totalMinimum).not.toBeNull()
    expect(totalMaximum).not.toBeNull()
    expect(totalMinimum).toMatchObject({ type: "text", inputMode: "decimal" })
    expect(totalMaximum).toMatchObject({ type: "text", inputMode: "decimal" })
    expect(totalMinimum?.hasAttribute("max")).toBe(false)
    expect(totalMaximum?.hasAttribute("max")).toBe(false)
    expect(totalMinimum?.hasAttribute("aria-valuemax")).toBe(false)
    expect(totalMaximum?.hasAttribute("aria-valuemax")).toBe(false)
  })
})

function renderFilters() {
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)

  act(() => {
    root?.render(
      <TripListFiltersPopover
        open
        onOpenChange={() => undefined}
        activeFilterCount={0}
        status={TRIP_STATUS_ALL}
        onStatusChange={() => undefined}
        productId={null}
        onProductIdChange={() => undefined}
        accommodationId={null}
        onAccommodationIdChange={() => undefined}
        cruiseId={null}
        onCruiseIdChange={() => undefined}
        hasFlight={false}
        onHasFlightChange={() => undefined}
        totalMin=""
        onTotalMinChange={() => undefined}
        totalMax=""
        onTotalMaxChange={() => undefined}
        createdRange={null}
        onCreatedRangeChange={() => undefined}
        onFiltersChanged={() => undefined}
      />,
    )
  })
}
