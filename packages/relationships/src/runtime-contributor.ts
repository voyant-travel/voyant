import {
  type BookingsRelationshipsRuntime,
  bookingsRelationshipsRuntimePort,
} from "@voyant-travel/bookings/runtime-port"
import {
  type CustomFieldsRuntime,
  customFieldsRuntimePort,
  customFieldsVisibleIn,
} from "@voyant-travel/core/custom-fields"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { RelationshipsRouteRuntimeOptions } from "./route-runtime.js"
import {
  type RelationshipsMiceRuntime,
  relationshipsMiceRuntimePort,
  relationshipsRouteRuntimePort,
} from "./runtime-port.js"
import { loadCustomFieldRegistry } from "./service/custom-fields-registry.js"
import { relationshipsService } from "./service/index.js"
import { createStorefrontIntakePersistence } from "./storefront-intake-runtime.js"

const storefrontIntakeRuntimePortReference = {
  id: "storefront.intake.runtime",
} as const

/** Package-owned registration map for Relationships deployment adapters. */
export function createRelationshipsRuntimePortContribution(
  _host: unknown,
): Readonly<Record<string, unknown>> {
  const customFields: CustomFieldsRuntime = {
    resolveRegistry: (db) => loadCustomFieldRegistry(db as PostgresJsDatabase),
    async resolveVisibleValues(db, entity, entityId, channel) {
      const database = db as PostgresJsDatabase
      const row =
        entity === "person"
          ? await relationshipsService.getPersonById(database, entityId)
          : entity === "organization"
            ? await relationshipsService.getOrganizationById(database, entityId)
            : null
      if (!row) return {}

      const values = row.customFields ?? {}
      const definitions = customFieldsVisibleIn(
        await customFields.resolveRegistry(database),
        entity,
        channel,
      )
      return Object.fromEntries(
        definitions
          .filter((definition) => Object.hasOwn(values, definition.key))
          .map((definition) => [definition.key, values[definition.key]]),
      )
    },
  }
  return {
    [storefrontIntakeRuntimePortReference.id]: createStorefrontIntakePersistence(),
    [customFieldsRuntimePort.id]: customFields,
    [relationshipsRouteRuntimePort.id]: {
      customFields: customFields.resolveRegistry,
    } satisfies RelationshipsRouteRuntimeOptions,
    [relationshipsMiceRuntimePort.id]: {
      personExists: async (db, personId) =>
        (await relationshipsService.getPersonById(db as never, personId)) != null,
    } satisfies RelationshipsMiceRuntime,
    [bookingsRelationshipsRuntimePort.id]: {
      loadPersonTravelSnapshot: (...args) => relationshipsService.loadPersonTravelSnapshot(...args),
      upsertPersonFromContact: (...args) => relationshipsService.upsertPersonFromContact(...args),
      getPersonById: (...args) => relationshipsService.getPersonById(...args),
      getOrganizationById: (...args) => relationshipsService.getOrganizationById(...args),
    } satisfies BookingsRelationshipsRuntime,
  }
}
