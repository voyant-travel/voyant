import { definePort } from "@voyant-travel/core/project"

import type { SmartbillRuntimeHost } from "./graph-runtime.js"

export const SMARTBILL_RUNTIME_HOST_KEY = "providers.smartbill.host"

/** Node-host dependencies consumed by the package-owned SmartBill graph runtime. */
export const smartbillRuntimeHostPort = definePort<SmartbillRuntimeHost>({
  id: "smartbill.runtime-host",
  test(provider) {
    if (provider === null || typeof provider !== "object") {
      throw new Error("smartbill.runtime-host provider must be an options object.")
    }
    for (const method of ["resolveDatabase", "resolveConfig"] as const) {
      if (typeof provider[method] !== "function") {
        throw new Error(`smartbill.runtime-host provider must implement ${method}().`)
      }
    }
    if (
      provider.resolveDocumentStorage !== undefined &&
      typeof provider.resolveDocumentStorage !== "function"
    ) {
      throw new Error(
        "smartbill.runtime-host provider resolveDocumentStorage must be a function when set.",
      )
    }
  },
})
