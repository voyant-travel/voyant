// @vitest-environment jsdom

import type { PublicPaymentSession } from "@voyant-travel/finance/public-validation"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { VoyantFetcher } from "../client.js"
import { VoyantFinanceProvider } from "../provider.js"
import { PaymentLinkLandingPage } from "./payment-link-landing-page.js"

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const baseSession: PublicPaymentSession = {
  id: "ps_123",
  target: null,
  provenance: null,
  targetType: "booking",
  targetId: null,
  bookingId: "book_123",
  legacyOrderId: null,
  invoiceId: null,
  bookingPaymentScheduleId: null,
  bookingGuaranteeId: null,
  status: "requires_redirect",
  provider: "netopia",
  providerConnectionId: null,
  providerSessionId: "provider_session_123",
  providerPaymentId: null,
  externalReference: null,
  clientReference: null,
  currency: "EUR",
  amountCents: 1234,
  paymentMethod: "credit_card",
  payerEmail: "traveler@example.com",
  payerName: "Traveler",
  redirectUrl: "https://pay.example.com/stale",
  returnUrl: null,
  cancelUrl: null,
  expiresAt: null,
  completedAt: null,
  failureCode: null,
  failureMessage: null,
  notes: null,
}

describe("PaymentLinkLandingPage", () => {
  let container: HTMLDivElement
  let root: Root
  let fetcher: ReturnType<typeof vi.fn<VoyantFetcher>>

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    fetcher = vi.fn<VoyantFetcher>(async () => Response.json({ data: { redirectUrl: null } }))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it("starts active card sessions instead of following a stored redirect", async () => {
    await act(async () => {
      root.render(
        <VoyantFinanceProvider baseUrl="https://api.example.test/api/" fetcher={fetcher}>
          <PaymentLinkLandingPage session={baseSession} />
        </VoyantFinanceProvider>,
      )
    })

    await act(async () => {
      container.querySelector<HTMLButtonElement>("button")?.click()
    })

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/public/payment-link/ps_123/start-card",
      {
        method: "POST",
        headers: { Accept: "application/json" },
      },
    )
  })
})
