import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import {
  CheckoutUiMessagesProvider,
  getCheckoutUiI18n,
  resolveCheckoutUiMessages,
  useCheckoutUiMessagesOrDefault,
} from "./i18n/index.js"

describe("checkout-ui i18n", () => {
  it("resolves romanian messages with fallback", () => {
    const messages = getCheckoutUiI18n({ locale: "ro-RO" }).messages

    expect(messages.paymentStep.title).toBe("Plata")
    expect(messages.collectPaymentDialog.generateLink).toBe("Genereaza link")
  })

  it("applies overrides", () => {
    const messages = resolveCheckoutUiMessages({
      locale: "ro",
      overrides: {
        locales: {
          ro: {
            paymentLinkLandingPage: {
              cardTab: "Card",
            },
          },
        },
      },
    })

    expect(messages.paymentLinkLandingPage.cardTab).toBe("Card")
  })

  it("falls back to english outside a provider", () => {
    expect(renderToStaticMarkup(<MessageProbe />)).toContain("Payment")
  })

  it("provides romanian messages through the provider", () => {
    const html = renderToStaticMarkup(
      <CheckoutUiMessagesProvider locale="ro-RO">
        <MessageProbe />
      </CheckoutUiMessagesProvider>,
    )

    expect(html).toContain("Plata")
  })
})

function MessageProbe() {
  const messages = useCheckoutUiMessagesOrDefault()
  return <span>{messages.paymentStep.title}</span>
}
