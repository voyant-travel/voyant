import type { Module } from "@voyantjs/core"

import { availabilityHonoModule, availabilityLinkable } from "./availability/index.js"
import { groundHonoModule } from "./ground/index.js"
import { placesHonoModule } from "./places/index.js"
import { resourcesHonoModule } from "./resources/index.js"
import {
  checkOperationalAvailability,
  confirmResourceHold,
  createResourceHold,
  operationsService,
  releaseResourceHold,
} from "./service.js"

export const operationsModule: Module = {
  name: "operations",
  requiresTransactionalDb: true,
  linkable: availabilityLinkable,
}

export const operationsHonoModules = [
  availabilityHonoModule,
  resourcesHonoModule,
  groundHonoModule,
  placesHonoModule,
] as const

export type {
  CheckOperationalAvailabilityInput,
  CheckOperationalAvailabilityOutcome,
  ConfirmResourceHoldInput,
  ConfirmResourceHoldOutcome,
  CreateResourceHoldInput,
  CreateResourceHoldOutcome,
  ReleaseResourceHoldInput,
} from "./service.js"
export {
  checkOperationalAvailability,
  confirmResourceHold,
  createResourceHold,
  operationsService,
  releaseResourceHold,
}
