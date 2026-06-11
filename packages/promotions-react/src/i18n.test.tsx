import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import {
  getPromotionsUiI18n,
  PromotionsUiMessagesProvider,
  resolvePromotionsUiMessages,
  usePromotionsUiMessagesOrDefault,
} from "./i18n/index.js"

describe("promotions-ui i18n", () => {
  it("resolves romanian messages with fallback", () => {
    const messages = getPromotionsUiI18n({ locale: "ro-RO" }).messages

    expect(messages.common.cancel).toBe("Anuleaza")
    expect(messages.promotionsPage.title).toBe("Promotii")
  })

  it("applies overrides", () => {
    const messages = resolvePromotionsUiMessages({
      locale: "ro",
      overrides: {
        locales: {
          ro: {
            promotionsPage: {
              newPromotion: "Oferta noua",
            },
          },
        },
      },
    })

    expect(messages.promotionsPage.newPromotion).toBe("Oferta noua")
  })

  it("falls back to english outside a provider", () => {
    expect(renderToStaticMarkup(<MessageProbe />)).toContain("Promotions")
  })

  it("provides romanian messages through the provider", () => {
    const html = renderToStaticMarkup(
      <PromotionsUiMessagesProvider locale="ro-RO">
        <MessageProbe />
      </PromotionsUiMessagesProvider>,
    )

    expect(html).toContain("Promotii")
  })
})

function MessageProbe() {
  const messages = usePromotionsUiMessagesOrDefault()
  return <span>{messages.promotionsPage.title}</span>
}
