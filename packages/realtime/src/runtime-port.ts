import { definePort } from "@voyant-travel/core/project"

import type { CreateRealtimeApiModuleOptions } from "./index.js"
import type { RealtimeProvider } from "./types.js"

/** Deployment-selected realtime transport supplied before package runtime contributors execute. */
export const realtimeTransportRuntimePort = definePort<RealtimeProvider>({
  id: "realtime.transport",
  test(provider) {
    if (
      provider === null ||
      typeof provider !== "object" ||
      typeof provider.name !== "string" ||
      typeof provider.publish !== "function" ||
      typeof provider.mintClientToken !== "function"
    ) {
      throw new Error(
        "realtime.transport provider must define name and implement publish() and mintClientToken().",
      )
    }
  },
})

/** Deployment contract required by the package-owned realtime runtime factory. */
export const realtimeRuntimePort = definePort<CreateRealtimeApiModuleOptions>({
  id: "realtime.runtime",
  test(provider) {
    if (provider === null || typeof provider !== "object") {
      throw new Error("realtime.runtime provider must be an options object.")
    }
    if (provider.resolveProviders && typeof provider.resolveProviders !== "function") {
      throw new Error("realtime.runtime provider resolveProviders must be a function.")
    }
    if (provider.onPublishError && typeof provider.onPublishError !== "function") {
      throw new Error("realtime.runtime provider onPublishError must be a function.")
    }
  },
})
