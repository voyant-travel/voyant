import { definePort } from "@voyant-travel/core/project"

import type { LegalBookingContractSubscriberRuntime } from "./booking-contract-subscriber-runtime.js"

export interface LegalBookingContractSubscriberHost {
  createRuntime(
    bindings: unknown,
  ):
    | LegalBookingContractSubscriberRuntime
    | Promise<LegalBookingContractSubscriberRuntime | null>
    | null
}

export const legalBookingContractSubscriberRuntimePort =
  definePort<LegalBookingContractSubscriberHost>({
    id: "legal.booking-contract-subscriber-runtime",
    test(provider) {
      if (provider === null || typeof provider !== "object") {
        throw new Error("legal.booking-contract-subscriber-runtime provider must be an object.")
      }
      if (typeof provider.createRuntime !== "function") {
        throw new Error(
          "legal.booking-contract-subscriber-runtime provider must implement createRuntime().",
        )
      }
    },
  })
