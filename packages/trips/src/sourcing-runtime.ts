import {
  fanOutAvailabilitySearch,
  type OwnedAvailabilitySearchHandlerRegistry,
} from "@voyant-travel/catalog"
import type { SourceAdapterRegistry } from "@voyant-travel/catalog/booking-engine"
import type { AnyDrizzleDb } from "@voyant-travel/db"

import type { SourceRequirementCandidatesDeps } from "./service-requirements.js"

/** Build the Trips sourcing dependency from one already-selected Catalog registry. */
export function createTripRequirementSourcingDeps(
  registry: SourceAdapterRegistry,
  ownedHandlers: OwnedAvailabilitySearchHandlerRegistry,
  db: AnyDrizzleDb,
): SourceRequirementCandidatesDeps {
  return {
    search: (request) => {
      const correlationId = crypto.randomUUID()
      return fanOutAvailabilitySearch({
        adapters: [...registry.connections()].sort().map((connectionId) => ({
          connectionId,
          adapter: registry.resolveByConnectionOrThrow(connectionId),
          context: {
            correlation_id: correlationId,
          },
        })),
        ownedHandlers: [...ownedHandlers.modules()].sort().map((entityModule) => ({
          handler: ownedHandlers.resolveOrThrow(entityModule),
          context: {
            db,
            adapterContext: {
              connection_id: entityModule,
              correlation_id: correlationId,
            },
          },
        })),
        request,
        limit: request.limit,
      })
    },
  }
}
