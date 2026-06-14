import { channelServiceOperations } from "./service/channels.js"

export type { HydratedChannel } from "./service/channels.js"

import {
  linkExternalReference,
  reconcileCounterpartyActivity,
  resolveCounterparty,
  routeCounterpartyEvent,
} from "./interface.js"
import { commercialServiceOperations } from "./service/commercial.js"
import { inventoryServiceOperations } from "./service/inventory.js"
import { settlementPolicyServiceOperations } from "./service/settlement-policies.js"
import { settlementServiceOperations } from "./service/settlements.js"

export const distributionService = {
  resolveCounterparty,
  linkExternalReference,
  routeCounterpartyEvent,
  reconcileCounterpartyActivity,
  ...channelServiceOperations,
  ...commercialServiceOperations,
  ...inventoryServiceOperations,
  ...settlementServiceOperations,
  ...settlementPolicyServiceOperations,
}
