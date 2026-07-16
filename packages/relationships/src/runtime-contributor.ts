import {
  type BookingsRelationshipsRuntime,
  bookingsRelationshipsRuntimePort,
} from "@voyant-travel/bookings/runtime-port"
import {
  type CustomFieldsRuntime,
  type CustomFieldValueReaderRuntime,
  customFieldsRuntimePort,
  customFieldsVisibleIn,
  customFieldValueReaderRuntimePort,
} from "@voyant-travel/core/custom-fields"
import type { VoyantPort } from "@voyant-travel/core/project"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { RelationshipsRouteRuntimeOptions } from "./route-runtime.js"
import {
  type RelationshipsMiceRuntime,
  relationshipsMiceRuntimePort,
  relationshipsRouteRuntimePort,
} from "./runtime-port.js"
import { relationshipsService } from "./service/index.js"
import { createStorefrontIntakePersistence } from "./storefront-intake-runtime.js"

const storefrontIntakeRuntimePortReference = {
  id: "storefront.intake.runtime",
} as const

interface RelationshipsRuntimeContributorHost {
  getRuntimePort<T>(port: Pick<VoyantPort<T>, "id">): T | Promise<T>
}

/** Package-owned registration map for Relationships deployment adapters. */
export function createRelationshipsRuntimePortContribution(
  host: RelationshipsRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const customFieldsRuntime = Promise.resolve(
    host.getRuntimePort<CustomFieldsRuntime>(customFieldsRuntimePort),
  )
  const customFields: CustomFieldValueReaderRuntime = {
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
        await (await customFieldsRuntime).resolveRegistry(database),
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
    [customFieldValueReaderRuntimePort.id]: customFields,
    [relationshipsRouteRuntimePort.id]: {
      customFields: async (db) =>
        (await customFieldsRuntime).resolveRegistry(db as PostgresJsDatabase),
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
