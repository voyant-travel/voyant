import { definePort } from "@voyant-travel/core/project"

import type { ContractDocumentRoutesOptions } from "./contract-document-routes.js"

export const legalContractDocumentRuntimePort = definePort<ContractDocumentRoutesOptions>({
  id: "legal.contract-document.runtime",
  test(provider) {
    if (provider === null || typeof provider !== "object") {
      throw new Error("legal.contract-document.runtime provider must be an options object.")
    }
    for (const method of [
      "generateContract",
      "previewContract",
      "resolveStorage",
      "guessMimeType",
    ] as const) {
      if (typeof provider[method] !== "function") {
        throw new Error(`legal.contract-document.runtime ${method} must be a function.`)
      }
    }
  },
})
