import type { BootstrapContext } from "@voyant-travel/core"
import { definePort } from "@voyant-travel/core/project"

import type { ChannelPushExtensionOptions } from "./extension.js"

/** Deployment dependencies consumed by the package-owned channel-push runtime. */
export interface ChannelPushRuntime {
  resolveRegistry: ChannelPushExtensionOptions["resolveRegistry"]
  registerWorkflowService(context: BootstrapContext): Promise<void> | void
}

export const channelPushRuntimePort = definePort<ChannelPushRuntime>({
  id: "distribution.channel-push-runtime",
  test(provider) {
    if (provider === null || typeof provider !== "object") {
      throw new Error("distribution.channel-push-runtime provider must be an object.")
    }
    for (const method of ["resolveRegistry", "registerWorkflowService"] as const) {
      if (typeof provider[method] !== "function") {
        throw new Error(`distribution.channel-push-runtime provider must implement ${method}().`)
      }
    }
  },
})
