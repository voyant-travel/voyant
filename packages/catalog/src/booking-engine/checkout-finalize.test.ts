import { describe, expect, it } from "vitest"

import { type CheckoutFinalizeDeps, runCheckoutFinalize } from "./checkout-finalize.js"

describe("runCheckoutFinalize", () => {
  it("forces contract generation after invoice payment linkage", async () => {
    const calls: string[] = []
    const deps: CheckoutFinalizeDeps = {
      db: {} as CheckoutFinalizeDeps["db"],
      confirmBooking: async () => {
        calls.push("confirm")
      },
      issueInvoice: async () => {
        calls.push("invoice")
        return { invoiceId: "inv_1" }
      },
      linkPaymentToInvoice: async () => {
        calls.push("link")
        return { paymentId: "pay_1", sessionsLinked: 1 }
      },
      generateContractPdf: async ({ force }) => {
        calls.push(`contract:${force === true ? "force" : "cached"}`)
        return { contractId: "ctr_1", attachmentId: "atta_1" }
      },
    }

    await runCheckoutFinalize({ bookingId: "bk_1", paymentSessionId: "ps_1" }, deps)

    expect(calls).toEqual(["confirm", "invoice", "link", "contract:force"])
  })
})
