import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import {
  getPricingUiI18n,
  PricingUiMessagesProvider,
  resolvePricingUiMessages,
  usePricingUiMessagesOrDefault,
} from "./i18n/provider.js"

describe("pricing-ui pricing-category i18n", () => {
  it("resolves localized messages with fallback and overrides", () => {
    const result = resolvePricingUiMessages({
      locale: "ro-RO",
      overrides: {
        locales: {
          ro: {
            pricingCategoryList: {
              add: "Adauga rapid",
            },
          },
        },
      },
    })

    expect(result.pricingCategoryList.add).toBe("Adauga rapid")
    expect(result.common.categoryTypeLabels.child).toBe("Copil")
  })

  it("returns locale-aware formatters from the helper", () => {
    const result = getPricingUiI18n({ locale: "ro-RO" })

    expect(result.locale).toBe("ro-RO")
    expect(result.formatNumber(1200)).toBe(new Intl.NumberFormat("ro-RO").format(1200))
  })

  it("renders English defaults without a provider", () => {
    const html = renderToStaticMarkup(<PricingUiMessageProbe />)

    expect(html).toContain("New category")
    expect(html).toContain("Adult")
  })

  it("renders Romanian copy with the provider", () => {
    const html = renderToStaticMarkup(
      <PricingUiMessagesProvider locale="ro-RO">
        <PricingUiMessageProbe />
      </PricingUiMessagesProvider>,
    )

    expect(html).toContain("Categorie noua")
    expect(html).toContain("Copil")
  })
})

function PricingUiMessageProbe() {
  const messages = usePricingUiMessagesOrDefault()

  return (
    <div>
      <span>{messages.pricingCategoryList.add}</span>
      <span>{messages.common.categoryTypeLabels.adult}</span>
      <span>{messages.common.categoryTypeLabels.child}</span>
    </div>
  )
}
