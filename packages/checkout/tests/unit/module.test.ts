import { createContainer } from "@voyantjs/core"
import { describe, expect, it, vi } from "vitest"

import { CHECKOUT_ROUTE_RUNTIME_CONTAINER_KEY, createCheckoutHonoModule } from "../../src/index.js"

describe("createCheckoutHonoModule", () => {
  it("registers checkout route runtime during bootstrap", () => {
    const resolveProviders = vi.fn(() => [
      {
        channels: ["email"] as const,
        deliver: vi.fn(async () => ({ provider: "email" })),
      },
    ])

    const resolvePaymentStarters = vi.fn(() => ({
      card: vi.fn(async () => ({ provider: "card", sessionId: "session_123" })),
    }))

    const resolveBankTransferDetails = vi.fn(() => ({
      bankName: "Voyant Bank",
      iban: "RO49AAAA1B31007593840000",
      accountHolder: "Voyant",
    }))

    const container = createContainer()
    const bindings = { NETOPIA_SIGNATURE: "sig" }
    const module = createCheckoutHonoModule({
      resolveProviders,
      resolvePaymentStarters,
      resolveBankTransferDetails,
    }).module

    module.bootstrap?.({ bindings, container })

    expect(resolveProviders).toHaveBeenCalledTimes(2)
    expect(resolvePaymentStarters).toHaveBeenCalledTimes(1)
    expect(resolveBankTransferDetails).toHaveBeenCalledTimes(1)
    const runtime = container.resolve(CHECKOUT_ROUTE_RUNTIME_CONTAINER_KEY)

    expect(runtime?.bindings).toEqual(bindings)
    expect(runtime?.providers).toHaveLength(1)
    expect(runtime?.providers[0]?.channels).toEqual(["email"])
    expect(runtime?.paymentStarters.card).toBeTypeOf("function")
    expect(runtime?.bankTransferDetails).toEqual({
      bankName: "Voyant Bank",
      iban: "RO49AAAA1B31007593840000",
      accountHolder: "Voyant",
    })
  })
})
