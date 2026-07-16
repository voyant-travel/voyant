import {
  type BookingsRelationshipsRuntime,
  bookingsRelationshipsRuntimePort,
} from "@voyant-travel/bookings/runtime-port"
import {
  type CustomFieldsRuntime,
  type CustomFieldValueLifecycleRuntime,
  type CustomFieldValueReaderRuntime,
  customFieldsRuntimePort,
  customFieldsVisibleIn,
  customFieldValueLifecycleRuntimePort,
  customFieldValueReaderRuntimePort,
} from "@voyant-travel/core/custom-fields"
import type { VoyantPort } from "@voyant-travel/core/project"
import { sql } from "drizzle-orm"
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

const relationshipCustomFieldTables = {
  person: "people",
  organization: "organizations",
  activity: "activities",
} as const

const relationshipCustomFieldValues: CustomFieldValueLifecycleRuntime = {
  supports: (entityType) => entityType in relationshipCustomFieldTables,
  async renameDefinitionKey(db, definition, nextKey) {
    const table =
      relationshipCustomFieldTables[
        definition.entityType as keyof typeof relationshipCustomFieldTables
      ]
    if (!table) return
    const database = db as PostgresJsDatabase
    await database.execute(
      sql`UPDATE ${sql.identifier(table)}
          SET custom_fields = jsonb_set(
            custom_fields,
            ARRAY[${definition.namespace}]::text[],
            (COALESCE(custom_fields -> ${definition.namespace}, '{}'::jsonb) - ${definition.key})
              || jsonb_build_object(
                ${nextKey}::text,
                custom_fields #> ARRAY[${definition.namespace}, ${definition.key}]::text[]
              ),
            true
          ),
          updated_at = now()
          WHERE custom_fields -> ${definition.namespace} ? ${definition.key}`,
    )
  },
  async deleteDefinitionValues(db, definition) {
    const table =
      relationshipCustomFieldTables[
        definition.entityType as keyof typeof relationshipCustomFieldTables
      ]
    if (!table) return
    const database = db as PostgresJsDatabase
    await database.execute(
      sql`UPDATE ${sql.identifier(table)}
          SET custom_fields = custom_fields #- ARRAY[${definition.namespace}, ${definition.key}]::text[],
              updated_at = now()
          WHERE custom_fields -> ${definition.namespace} ? ${definition.key}`,
    )
  },
}

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
      const visible: Record<string, Record<string, unknown>> = {}
      for (const definition of definitions) {
        const value = values[definition.namespace]?.[definition.key]
        if (value !== undefined) {
          const namespaceValues = visible[definition.namespace] ?? {}
          namespaceValues[definition.key] = value
          visible[definition.namespace] = namespaceValues
        }
      }
      return visible
    },
  }
  return {
    [storefrontIntakeRuntimePortReference.id]: createStorefrontIntakePersistence(),
    [customFieldValueReaderRuntimePort.id]: customFields,
    [customFieldValueLifecycleRuntimePort.id]: relationshipCustomFieldValues,
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
