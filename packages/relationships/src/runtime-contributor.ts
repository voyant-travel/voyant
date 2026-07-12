import {
  type BookingsRelationshipsRuntime,
  bookingsRelationshipsRuntimePort,
} from "@voyant-travel/bookings/runtime-port"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { CustomFieldRegistryResolver } from "@voyant-travel/core/custom-fields"
import { storefrontIntakeRuntimePort } from "@voyant-travel/storefront"
import type { RelationshipsRouteRuntimeOptions } from "./route-runtime.js"
import { relationshipsMiceRuntimePort, relationshipsRouteRuntimePort } from "./runtime-port.js"
import { relationshipsService } from "./service/index.js"
import { createStorefrontIntakePersistence } from "./storefront-intake-runtime.js"

export interface RelationshipsRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Package-owned registration map for Relationships deployment adapters. */
export function createRelationshipsRuntimePortContribution(
  host: RelationshipsRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const customFields: CustomFieldRegistryResolver = (db) => {
    const resolver = host.primitives.config.read(db, "customFields")
    if (typeof resolver !== "function") {
      throw new Error("Relationships customFields config must be a resolver function.")
    }
    return resolver(db)
  }
  return {
    [storefrontIntakeRuntimePort.id]: createStorefrontIntakePersistence(),
    [relationshipsRouteRuntimePort.id]: {
      customFields,
    } satisfies RelationshipsRouteRuntimeOptions,
    [relationshipsMiceRuntimePort.id]: {
      personExists: async (db, personId) =>
        (await relationshipsService.getPersonById(db as never, personId)) != null,
    },
    [bookingsRelationshipsRuntimePort.id]: {
      loadPersonTravelSnapshot: (...args) => relationshipsService.loadPersonTravelSnapshot(...args),
      upsertPersonFromContact: (...args) => relationshipsService.upsertPersonFromContact(...args),
      getPersonById: (...args) => relationshipsService.getPersonById(...args),
      getOrganizationById: (...args) => relationshipsService.getOrganizationById(...args),
    } satisfies BookingsRelationshipsRuntime,
  }
}
