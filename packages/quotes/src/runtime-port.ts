import { definePort } from "@voyant-travel/core/project"
import type {
  QuoteProposalRoutesOptions,
  QuoteVersionSnapshotRoutesOptions,
} from "./proposal-routes.js"
import type { ResolveQuoteParticipantPersonById } from "./route-runtime.js"

/** Node-host behavior required by the package-owned Quotes module factory. */
export interface QuotesRuntime {
  resolveParticipantPersonById: ResolveQuoteParticipantPersonById
}

/** Deployment behavior required by the proposal extension. */
export type QuotesProposalRuntime = QuoteProposalRoutesOptions

/** Deployment behavior required by the quote-version snapshot extension. */
export type QuotesSnapshotRuntime = QuoteVersionSnapshotRoutesOptions

function requireFunctions(id: string, provider: object, methods: readonly string[]): void {
  const candidate = provider as Record<string, unknown>
  for (const method of methods) {
    if (typeof candidate[method] !== "function") {
      throw new Error(`${id} provider must implement ${method}().`)
    }
  }
}

function requireObject(id: string, provider: unknown): asserts provider is object {
  if (provider === null || typeof provider !== "object") {
    throw new Error(`${id} provider must be an options object.`)
  }
}

export const quotesRuntimePort = definePort<QuotesRuntime>({
  id: "quotes.runtime",
  test(provider) {
    requireObject("quotes.runtime", provider)
    requireFunctions("quotes.runtime", provider, ["resolveParticipantPersonById"])
  },
})

export const quotesProposalRuntimePort = definePort<QuotesProposalRuntime>({
  id: "quotes.proposal-runtime",
  test(provider) {
    requireObject("quotes.proposal-runtime", provider)
    requireFunctions("quotes.proposal-runtime", provider, [
      "resolveDb",
      "resolvePublicProposalBaseUrl",
      "reserveTripDeps",
      "startCheckoutDeps",
      "cancelTripComponentsDeps",
      "resolveOperatorProfile",
    ])
    const feedback = Reflect.get(provider, "recordPublicProposalFeedback")
    if (feedback !== undefined && typeof feedback !== "function") {
      throw new Error(
        "quotes.proposal-runtime provider recordPublicProposalFeedback must be a function.",
      )
    }
  },
})

export const quotesSnapshotRuntimePort = definePort<QuotesSnapshotRuntime>({
  id: "quotes.snapshot-runtime",
  test(provider) {
    requireObject("quotes.snapshot-runtime", provider)
    requireFunctions("quotes.snapshot-runtime", provider, ["resolveDb"])
  },
})
