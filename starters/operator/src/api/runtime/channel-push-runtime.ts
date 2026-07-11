import type { ChannelPushRuntime } from "@voyant-travel/distribution"

import { getBookingEngineRegistryFromContext } from "../lib/booking-engine-runtime"
import { registerDistributionWorkflowService } from "./operator-workflow-services"

/** Generic Node-host providers consumed by the Distribution channel-push runtime port. */
export const operatorChannelPushRuntime: ChannelPushRuntime = {
  resolveRegistry: getBookingEngineRegistryFromContext,
  registerWorkflowService: ({ container, bindings }) =>
    registerDistributionWorkflowService(container, bindings as AppBindings | NodeJS.ProcessEnv),
}
