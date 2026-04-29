import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { PaginationFooter } from "./components/pagination-footer"
import {
  getHospitalityUiI18n,
  HospitalityUiMessagesProvider,
  resolveHospitalityUiMessages,
  useHospitalityUiMessagesOrDefault,
} from "./i18n"

describe("hospitality-ui i18n", () => {
  it("resolves localized package messages with fallback and overrides", () => {
    const result = resolveHospitalityUiMessages({
      locale: "ro-RO",
      overrides: {
        locales: {
          ro: {
            mealPlansTab: {
              add: "Adauga plan",
            },
          },
        },
      },
    })

    expect(result.mealPlansTab.add).toBe("Adauga plan")
    expect(result.common.inventoryModeLabels.pooled).toBe("Comun")
  })

  it("returns locale-aware formatters from the package helper", () => {
    const result = getHospitalityUiI18n({ locale: "ro-RO" })

    expect(result.locale).toBe("ro-RO")
    expect(result.formatNumber(1200)).toBe(new Intl.NumberFormat("ro-RO").format(1200))
  })

  it("renders English defaults without a provider", () => {
    const html = renderToStaticMarkup(
      <div>
        <PaginationFooter pageIndex={0} pageSize={25} total={60} onPageIndexChange={() => {}} />
        <HospitalityMessageProbe />
      </div>,
    )

    expect(html).toContain("Showing 1-25 of 60")
    expect(html).toContain("Previous")
    expect(html).toContain("Add Meal Plan")
  })

  it("renders Romanian copy with the package provider", () => {
    const html = renderToStaticMarkup(
      <HospitalityUiMessagesProvider locale="ro-RO">
        <div>
          <PaginationFooter pageIndex={0} pageSize={25} total={60} onPageIndexChange={() => {}} />
          <HospitalityMessageProbe />
        </div>
      </HospitalityUiMessagesProvider>,
    )

    expect(html).toContain("Afisezi 1-25 din 60")
    expect(html).toContain("Anterior")
    expect(html).toContain("Adauga Plan de Masa")
  })
})

function HospitalityMessageProbe() {
  const messages = useHospitalityUiMessagesOrDefault()

  return (
    <div>
      <span>{messages.mealPlansTab.add}</span>
      <span>{messages.roomTypesTab.add}</span>
      <span>{messages.common.mealInclusions.breakfast}</span>
    </div>
  )
}
