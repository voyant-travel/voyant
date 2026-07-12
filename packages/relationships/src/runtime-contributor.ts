import {
  type BookingsRelationshipsRuntime,
  bookingsRelationshipsRuntimePort,
} from "@voyant-travel/bookings/runtime-port"
import { storefrontIntakeRuntimePort } from "@voyant-travel/storefront"
import type { RelationshipsRouteRuntimeOptions } from "./route-runtime.js"
import { relationshipsRouteRuntimePort } from "./runtime-port.js"
import { relationshipsService } from "./service/index.js"
import { createStorefrontIntakePersistence } from "./storefront-intake-runtime.js"

export interface RelationshipsRuntimeContributorHost {
  capabilities: Pick<RelationshipsRouteRuntimeOptions, "customFields">
}

/** Package-owned registration map for Relationships deployment adapters. */
export function createRelationshipsRuntimePortContribution(
  host: RelationshipsRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  return {
    [storefrontIntakeRuntimePort.id]: createStorefrontIntakePersistence(),
    [relationshipsRouteRuntimePort.id]: {
      customFields: host.capabilities.customFields,
    } satisfies RelationshipsRouteRuntimeOptions,
    [bookingsRelationshipsRuntimePort.id]: {
      loadPersonTravelSnapshot: (...args) => relationshipsService.loadPersonTravelSnapshot(...args),
      upsertPersonFromContact: (...args) => relationshipsService.upsertPersonFromContact(...args),
      getPersonById: (...args) => relationshipsService.getPersonById(...args),
      getOrganizationById: (...args) => relationshipsService.getOrganizationById(...args),
    } satisfies BookingsRelationshipsRuntime,
  }
}
