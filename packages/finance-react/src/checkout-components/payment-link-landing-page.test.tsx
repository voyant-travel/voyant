// @vitest-environment jsdom

import type { PublicPaymentSession } from "@voyant-travel/finance/public-validation"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { redirectUrl: null } }),
    }))
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it("starts active card sessions instead of following a stored redirect", async () => {
    await act(async () => {
      root.render(<PaymentLinkLandingPage session={baseSession} />)
    })

    await act(async () => {
      container.querySelector<HTMLButtonElement>("button")?.click()
    })

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/public/payment-link/ps_123/start-card", {
      method: "POST",
      headers: { Accept: "application/json" },
    })
  })
})
