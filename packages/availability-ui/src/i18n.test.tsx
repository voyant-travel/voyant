import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import {
  AvailabilityUiMessagesProvider,
  getAvailabilityUiI18n,
  resolveAvailabilityUiMessages,
  useAvailabilityUiMessagesOrDefault,
} from "./i18n/index.js"

describe("availability-ui i18n", () => {
  it("resolves localized package messages with fallback and overrides", () => {
    const result = resolveAvailabilityUiMessages({
      locale: "ro-RO",
      overrides: {
        locales: {
          ro: {
            page: {
              filters: {
                productSearchEmpty: "Niciun rezultat.",
              },
            },
          },
        },
      },
    })

    expect(result.page.filters.productSearchEmpty).toBe("Niciun rezultat.")
    expect(result.title).toBe("Disponibilitate")
    expect(result.tabSlots).toBe("Sloturi")
  })

  it("returns locale-aware formatters from the package helper", () => {
    const result = getAvailabilityUiI18n({ locale: "ro-RO" })

    expect(result.locale).toBe("ro-RO")
    expect(result.formatNumber(1200)).toBe(new Intl.NumberFormat("ro-RO").format(1200))
  })

  it("renders English copy without a provider", () => {
    const html = renderToStaticMarkup(<AvailabilityMessageProbe />)

    expect(html).toContain("Availability")
    expect(html).toContain("Calendar")
    expect(html).toContain("All statuses")
  })

  it("renders Romanian copy with the package provider", () => {
    const html = renderToStaticMarkup(
      <AvailabilityUiMessagesProvider locale="ro-RO">
        <AvailabilityMessageProbe />
      </AvailabilityUiMessagesProvider>,
    )

    expect(html).toContain("Disponibilitate")
    expect(html).toContain("Calendar")
    expect(html).toContain("Toate statusurile")
  })
})

function AvailabilityMessageProbe() {
  const messages = useAvailabilityUiMessagesOrDefault()

  return (
    <div>
      <span>{messages.title}</span>
      <span>{messages.page.calendarTab}</span>
      <span>{messages.page.filters.allStatuses}</span>
    </div>
  )
}
