import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ResourcesOverview } from "./components/resources-overview.js"
import {
  getResourcesUiI18n,
  ResourcesUiMessagesProvider,
  resolveResourcesUiMessages,
} from "./i18n/index.js"

describe("resources-ui i18n", () => {
  it("resolves localized package messages with fallback and overrides", () => {
    const result = resolveResourcesUiMessages({
      locale: "ro-RO",
      overrides: {
        locales: {
          ro: {
            overview: {
              filters: {
                searchPlaceholder: "Cauta active...",
              },
            },
          },
        },
      },
    })

    expect(result.overview.filters.searchPlaceholder).toBe("Cauta active...")
    expect(result.common.resourceKindLabels.guide).toBe("Ghid")
  })

  it("returns locale-aware formatters from the package helper", () => {
    const result = getResourcesUiI18n({ locale: "ro-RO" })

    expect(result.locale).toBe("ro-RO")
    expect(result.formatNumber(1200)).toBe(new Intl.NumberFormat("ro-RO").format(1200))
  })

  it("renders English copy without a provider", () => {
    const html = renderToStaticMarkup(
      <ResourcesOverview
        bookings={[]}
        products={[]}
        slots={[]}
        closeouts={[]}
        filteredResources={[]}
        filteredPools={[]}
        liveAssignments={[]}
        resourcesWithoutSupplier={[]}
        unassignedReservations={[]}
        search=""
        setSearch={() => {}}
        kindFilter="all"
        setKindFilter={() => {}}
        hasFilters={false}
        onClearFilters={() => {}}
        onOpenAssignment={() => {}}
        onOpenResource={() => {}}
      />,
    )

    expect(html).toContain("Active Resources")
    expect(html).toContain("Assignment Gaps")
    expect(html).toContain("Search resources")
  })

  it("renders Romanian copy with the package provider", () => {
    const html = renderToStaticMarkup(
      <ResourcesUiMessagesProvider locale="ro-RO">
        <ResourcesOverview
          bookings={[]}
          products={[]}
          slots={[]}
          closeouts={[]}
          filteredResources={[]}
          filteredPools={[]}
          liveAssignments={[]}
          resourcesWithoutSupplier={[]}
          unassignedReservations={[]}
          search=""
          setSearch={() => {}}
          kindFilter="all"
          setKindFilter={() => {}}
          hasFilters
          onClearFilters={() => {}}
          onOpenAssignment={() => {}}
          onOpenResource={() => {}}
        />
      </ResourcesUiMessagesProvider>,
    )

    expect(html).toContain("Resurse Active")
    expect(html).toContain("Lipsuri de Asignare")
    expect(html).toContain("Cauta resurse")
    expect(html).toContain("Sterge filtrele")
  })
})
