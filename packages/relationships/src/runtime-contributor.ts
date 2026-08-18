import {
  type BookingsRelationshipsRuntime,
  bookingsRelationshipsRuntimePort,
} from "@voyant-travel/bookings/runtime-port"
import { normalizeE164, normalizeEmailAddress } from "@voyant-travel/conversations-contracts"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
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
import {
  type CustomFieldValueOperationsRuntime,
  customFieldValueOperationsRuntimePort,
} from "@voyant-travel/core/runtime-port"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import {
  type FinanceStoredInstrumentRuntime,
  financeStoredInstrumentRuntimePort,
} from "@voyant-travel/finance/runtime-port"
import { sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { createPublicApiIntakePersistence } from "./public-api-intake-runtime.js"
import type { RelationshipsRouteRuntimeOptions } from "./route-runtime.js"
import {
  type RelationshipsBookingEnrichmentDatabaseRuntime,
  type RelationshipsMiceRuntime,
  type RelationshipsPersonConversationsRuntime,
  type RelationshipsPersonNotificationsRuntime,
  relationshipsBookingEnrichmentDatabaseRuntimePort,
  relationshipsMiceRuntimePort,
  relationshipsPersonConversationsRuntimePort,
  relationshipsPersonNotificationsRuntimePort,
  relationshipsRouteRuntimePort,
} from "./runtime-port.js"
import {
  findPersonContactPointAddress,
  listPersonContactPointMatches,
} from "./service/accounts-resolve.js"
import { relationshipsService } from "./service/index.js"

interface ConversationsPersonDirectory {
  resolveEmail(db: unknown, address: string): Promise<DirectoryResolution>
  resolvePhone(db: unknown, address: string): Promise<DirectoryResolution>
  resolvePersonContactPoint(
    db: unknown,
    input: { personRef: string; contactPointRef: string; channel?: "email" | "sms" },
  ): Promise<{ address: string } | null>
}

const publicApiIntakeRuntimePortReference = {
  id: "public-api.intake.runtime",
} as const
const conversationsPersonDirectoryPortReference = { id: "conversations.person-directory" } as const

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

const relationshipCustomFieldValueOperations: CustomFieldValueOperationsRuntime = {
  supports: (entityType) => entityType in relationshipCustomFieldTables,
  async list(db, _owner, input) {
    const table =
      relationshipCustomFieldTables[input.entityType as keyof typeof relationshipCustomFieldTables]
    if (!table) return []
    const database = db as PostgresJsDatabase
    const rows = input.entityId
      ? await database.execute(
          sql`SELECT id, custom_fields FROM ${sql.identifier(table)} WHERE id = ${input.entityId}`,
        )
      : await database.execute(
          sql`SELECT id, custom_fields FROM ${sql.identifier(table)} WHERE custom_fields <> '{}'::jsonb ORDER BY updated_at DESC`,
        )
    return Array.from(rows, (row) => ({
      entityId: String(row.id),
      customFields: (row.custom_fields as Record<string, unknown> | null) ?? {},
    }))
  },
  async upsert(db, _owner, input) {
    const table =
      relationshipCustomFieldTables[
        input.definition.entityType as keyof typeof relationshipCustomFieldTables
      ]
    if (!table) return false
    const database = db as PostgresJsDatabase
    const updated = Array.from(
      await database.execute(
        sql`UPDATE ${sql.identifier(table)}
            SET custom_fields = jsonb_set(
                  custom_fields,
                  ARRAY[${input.definition.namespace}]::text[],
                  COALESCE(custom_fields -> ${input.definition.namespace}, '{}'::jsonb)
                    || jsonb_build_object(
                      ${input.definition.key}::text,
                      ${JSON.stringify(input.value)}::jsonb
                    ),
                  true
                ),
                updated_at = now()
            WHERE id = ${input.entityId}
            RETURNING id`,
      ),
    )
    return updated.length > 0
  },
  async delete(db, _owner, input) {
    const table =
      relationshipCustomFieldTables[
        input.definition.entityType as keyof typeof relationshipCustomFieldTables
      ]
    if (!table) return false
    const database = db as PostgresJsDatabase
    const deleted = Array.from(
      await database.execute(
        sql`UPDATE ${sql.identifier(table)}
            SET custom_fields = custom_fields #- ARRAY[${input.definition.namespace}, ${input.definition.key}]::text[],
                updated_at = now()
            WHERE id = ${input.entityId}
              AND custom_fields -> ${input.definition.namespace} ? ${input.definition.key}
            RETURNING id`,
      ),
    )
    return deleted.length > 0
  },
}

interface RelationshipsRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
  hasRuntimePort?(port: Pick<VoyantPort<unknown>, "id">): boolean
  getRuntimePort<T>(port: Pick<VoyantPort<T>, "id">): T | Promise<T>
}

/**
 * Notifications is optional. A deployment that selects CRM without it keeps a
 * Communications tab listing only hand-logged entries, which is what it showed
 * before this seam existed.
 */
async function resolvePersonNotifications(
  host: RelationshipsRuntimeContributorHost,
): Promise<RelationshipsPersonNotificationsRuntime | undefined> {
  if (host.hasRuntimePort?.(relationshipsPersonNotificationsRuntimePort) === false) return undefined
  try {
    return await host.getRuntimePort<RelationshipsPersonNotificationsRuntime>(
      relationshipsPersonNotificationsRuntimePort,
    )
  } catch {
    return undefined
  }
}

async function resolvePersonConversations(
  host: RelationshipsRuntimeContributorHost,
): Promise<RelationshipsPersonConversationsRuntime | undefined> {
  if (host.hasRuntimePort?.(relationshipsPersonConversationsRuntimePort) === false) return undefined
  try {
    return await host.getRuntimePort(relationshipsPersonConversationsRuntimePort)
  } catch {
    return undefined
  }
}

type DirectoryResolution =
  | { kind: "none" }
  | { kind: "ambiguous" }
  | {
      kind: "unique"
      personRef: string
      contactPointRef: string
      address: string
      channel: "email" | "sms"
    }

function normalizeDirectoryAddress(channel: "email" | "sms", value: string): string {
  return channel === "email" ? normalizeEmailAddress(value) : normalizeE164(value)
}

export function classifyDirectoryRows(
  rows: readonly { id: string; personRef: string; address: string }[],
  channel: "email" | "sms",
): DirectoryResolution {
  const people = new Set(rows.map((row) => row.personRef))
  if (people.size === 0) return { kind: "none" }
  if (people.size > 1 || rows.length > 1) return { kind: "ambiguous" }
  const row = rows[0]!
  return {
    kind: "unique",
    personRef: row.personRef,
    contactPointRef: row.id,
    address: normalizeDirectoryAddress(channel, row.address),
    channel,
  }
}

async function resolveDirectoryAddress(
  db: unknown,
  channel: "email" | "sms",
  address: string,
): Promise<DirectoryResolution> {
  const database = db as PostgresJsDatabase
  const normalized = normalizeDirectoryAddress(channel, address)
  const kinds = channel === "email" ? (["email"] as const) : (["phone", "mobile", "sms"] as const)
  const rows = await listPersonContactPointMatches(database, { kinds, normalized, limit: 3 })
  return classifyDirectoryRows(rows, channel)
}

/** Package-owned registration map for Relationships deployment adapters. */
export function createRelationshipsRuntimePortContribution(
  host: RelationshipsRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const customFieldsRuntime = Promise.resolve(
    host.getRuntimePort<CustomFieldsRuntime>(customFieldsRuntimePort),
  )
  const personNotifications = resolvePersonNotifications(host)
  const personConversations = resolvePersonConversations(host)
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
    [publicApiIntakeRuntimePortReference.id]: createPublicApiIntakePersistence(),
    [customFieldValueReaderRuntimePort.id]: customFields,
    [customFieldValueLifecycleRuntimePort.id]: relationshipCustomFieldValues,
    [customFieldValueOperationsRuntimePort.id]: relationshipCustomFieldValueOperations,
    [relationshipsRouteRuntimePort.id]: {
      customFields: async (db) =>
        (await customFieldsRuntime).resolveRegistry(db as PostgresJsDatabase),
      customFieldsForWrite: async (db, entity) =>
        (await customFieldsRuntime).resolveRegistryForWrite(db as PostgresJsDatabase, entity),
      // Resolved per call, not folded into this object: routes read the route
      // runtime synchronously, so awaiting an optional port to build it would
      // hand them a promise where they expect the options. Answers with an
      // empty list when no notifications module is selected.
      personNotifications: {
        listPersonDeliveries: async (db, personId, query) =>
          (await personNotifications)?.listPersonDeliveries(db, personId, query) ?? [],
        getDeliveryTruth: async (db, deliveryIds) =>
          (await personNotifications)?.getDeliveryTruth(db, deliveryIds) ?? {},
      },
      personConversations: {
        listPersonParts: async (db, personId, query) =>
          (await personConversations)?.listPersonParts(db, personId, query) ?? [],
        findLinkedDeliveryIds: async (db, personId, deliveryIds, actorUserId) =>
          (await personConversations)?.findLinkedDeliveryIds(
            db,
            personId,
            deliveryIds,
            actorUserId,
          ) ?? [],
        mergePersonHistory: async (db, survivorPersonId, mergedPersonId) =>
          (await personConversations)?.mergePersonHistory(db, survivorPersonId, mergedPersonId),
      },
    } satisfies RelationshipsRouteRuntimeOptions,
    [relationshipsMiceRuntimePort.id]: {
      personExists: async (db, personId) =>
        (await relationshipsService.getPersonById(db as never, personId)) != null,
    } satisfies RelationshipsMiceRuntime,
    [conversationsPersonDirectoryPortReference.id]: {
      resolveEmail: (db: unknown, address: string) => resolveDirectoryAddress(db, "email", address),
      resolvePhone: (db: unknown, address: string) => resolveDirectoryAddress(db, "sms", address),
      async resolvePersonContactPoint(
        db: unknown,
        input: { personRef: string; contactPointRef: string; channel?: "email" | "sms" },
      ) {
        const database = db as PostgresJsDatabase
        const channel = input.channel ?? "email"
        const kinds =
          channel === "email" ? (["email"] as const) : (["phone", "mobile", "sms"] as const)
        const address = await findPersonContactPointAddress(database, {
          personRef: input.personRef,
          contactPointRef: input.contactPointRef,
          kinds,
        })
        if (!address) return null
        return {
          address: channel === "sms" ? normalizeE164(address) : normalizeEmailAddress(address),
        }
      },
    } satisfies ConversationsPersonDirectory,
    [relationshipsBookingEnrichmentDatabaseRuntimePort.id]: {
      withDb: <T>(bindings: unknown, operation: (db: AnyDrizzleDb) => Promise<T>) =>
        host.primitives.database.transaction(bindings, (database) =>
          operation(database as AnyDrizzleDb),
        ),
    } satisfies RelationshipsBookingEnrichmentDatabaseRuntime,
    [bookingsRelationshipsRuntimePort.id]: {
      loadPersonTravelSnapshot: (...args) => relationshipsService.loadPersonTravelSnapshot(...args),
      upsertPersonFromContact: (...args) => relationshipsService.upsertPersonFromContact(...args),
      getPersonById: (...args) => relationshipsService.getPersonById(...args),
      getOrganizationById: (...args) => relationshipsService.getOrganizationById(...args),
    } satisfies BookingsRelationshipsRuntime,
    /**
     * Where an instrument a payment provider stored becomes a row on the
     * person who paid. Finance owns the payment and knows the instrument; it
     * does not know what a person is, so this is the seam it hands the fact
     * across.
     */
    [financeStoredInstrumentRuntimePort.id]: {
      async recordStoredInstrument(db, instrument) {
        const { personId, ...rest } = instrument
        await relationshipsService.recordProjectedPersonPaymentMethod(db, personId, rest)
      },
    } satisfies FinanceStoredInstrumentRuntime,
  }
}
