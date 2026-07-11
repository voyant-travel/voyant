import { definePort } from "@voyant-travel/core/project"

import type { CreateRealtimeHonoModuleOptions } from "./index.js"

/** Deployment contract required by the package-owned realtime runtime factory. */
export const realtimeRuntimePort = definePort<CreateRealtimeHonoModuleOptions>({
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
