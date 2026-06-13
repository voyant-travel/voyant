import { describe, expect, it, vi } from "vitest"

import { buildCheckoutRouteRuntime, createCheckoutHonoModule } from "../../src/routes.js"

describe("checkout route compatibility shim", () => {
  it("keeps the legacy checkout module name", () => {
    expect(createCheckoutHonoModule().module.name).toBe("checkout")
  })

  it("adapts legacy providers into the Finance checkout runtime", () => {
    const provider = {
      channels: ["email"] as const,
      deliver: vi.fn(async () => ({ provider: "email" })),
    }
    const paymentStarter = vi.fn()
    const bindings = { APP_URL: "https://example.com" }

    const runtime = buildCheckoutRouteRuntime(bindings, {
      resolveProviders: () => [provider],
      resolvePaymentStarters: () => ({ netopia: paymentStarter }),
      resolveBankTransferDetails: () => ({
        provider: "manual",
        beneficiary: "Program Travel",
        iban: "RO49RNCB0857180852250001",
      }),
      resolvePublicCheckoutBaseUrl: () => "https://brand.example.com",
    })

    expect(runtime.bindings).toEqual(bindings)
    expect(runtime.providers).toEqual([provider])
    expect(runtime.notificationDispatcher?.sendInvoiceNotification).toBeTypeOf("function")
    expect(runtime.notificationDispatcher?.sendPaymentSessionNotification).toBeTypeOf("function")
    expect(runtime.paymentStarters.netopia).toBe(paymentStarter)
    expect(runtime.bankTransferDetails).toEqual({
      provider: "manual",
      beneficiary: "Program Travel",
      iban: "RO49RNCB0857180852250001",
    })
    expect(runtime.publicCheckoutBaseUrl).toBe("https://brand.example.com")
  })
})
