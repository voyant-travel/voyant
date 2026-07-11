import { definePort } from "@voyant-travel/core/project"

import type { ResolveMiceDelegatePersonById } from "./route-runtime.js"

/** Node-host behavior required by the package-owned MICE runtime factory. */
export interface MiceRuntime {
  resolveDelegatePersonById: ResolveMiceDelegatePersonById
}

export const miceRuntimePort = definePort<MiceRuntime>({
  id: "mice.runtime",
  test(provider) {
    if (provider === null || typeof provider !== "object") {
      throw new Error("mice.runtime provider must be an options object.")
    }
    if (typeof provider.resolveDelegatePersonById !== "function") {
      throw new Error("mice.runtime provider must implement resolveDelegatePersonById().")
    }
  },
})
