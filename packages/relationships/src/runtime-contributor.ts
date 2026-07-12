import {
  type BookingsRelationshipsRuntime,
  bookingsRelationshipsRuntimePort,
} from "@voyant-travel/bookings/runtime-port"
import { lazyProvider } from "@voyant-travel/hono"
import type { RelationshipsRouteRuntimeOptions } from "./route-runtime.js"
import { relationshipsRouteRuntimePort } from "./runtime-port.js"

type RelationshipsService = Pick<
  typeof import("./service/index.js").relationshipsService,
  "getPersonById" | "getOrganizationById" | "loadPersonTravelSnapshot" | "upsertPersonFromContact"
>

export interface RelationshipsRuntimeContributorHost {
  capabilities: Pick<RelationshipsRouteRuntimeOptions, "customFields">
}

/** Package-owned registration map for Relationships deployment adapters. */
export function createRelationshipsRuntimePortContribution(
  host: RelationshipsRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const relationshipsService = lazyProvider<RelationshipsService>(async () =>
    import("./service/index.js").then((module) => module.relationshipsService),
  )
  return {
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
