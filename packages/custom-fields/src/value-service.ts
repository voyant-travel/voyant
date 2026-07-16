import type {
  CustomFieldValueDefinitionContext,
  CustomFieldValueOperationsRuntime,
  CustomFieldValueOwnerContext,
} from "@voyant-travel/core/runtime-port"
import { ApiHttpError, RequestValidationError } from "@voyant-travel/hono"
import { and, eq, isNull } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { customFieldDefinitions } from "./schema.js"
import { assertCustomFieldDefinitionOwner, type CustomFieldDefinitionOwner } from "./service.js"
import type { CustomFieldValueListQuery, UpsertCustomFieldValueInput } from "./value-contracts.js"
import {
  jsonbValueFromTypedCustomFieldValue,
  parseSyntheticCustomFieldValueId,
  syntheticCustomFieldValueId,
  type TypedCustomFieldValueColumns,
  typedCustomFieldValueFromJsonb,
} from "./value-mapping.js"

function ownerWhere(owner: CustomFieldDefinitionOwner) {
  return owner.kind === "operator"
    ? and(
        eq(customFieldDefinitions.ownerKind, "operator"),
        eq(customFieldDefinitions.namespace, "custom"),
        isNull(customFieldDefinitions.ownerId),
      )
    : and(
        eq(customFieldDefinitions.ownerKind, owner.kind),
        eq(customFieldDefinitions.namespace, owner.namespace),
        eq(customFieldDefinitions.ownerId, owner.ownerId),
      )
}

function ownerContext(owner: CustomFieldDefinitionOwner): CustomFieldValueOwnerContext {
  return {
    kind: owner.kind,
    namespace: owner.namespace,
    ...(owner.ownerId ? { ownerId: owner.ownerId } : {}),
  }
}

function definitionContext(
  definition: typeof customFieldDefinitions.$inferSelect,
): CustomFieldValueDefinitionContext {
  return {
    id: definition.id,
    entityType: definition.entityType,
    namespace: definition.namespace,
    key: definition.key,
    fieldType: definition.fieldType,
  }
}

function operationFor(
  operations: readonly CustomFieldValueOperationsRuntime[],
  entityType: string,
): CustomFieldValueOperationsRuntime {
  const matches = operations.filter((operation) => operation.supports(entityType))
  if (matches.length !== 1) {
    throw new ApiHttpError(`No unique custom-field value provider owns target "${entityType}".`, {
      status: 400,
      code: "unsupported_custom_field_target",
    })
  }
  return matches[0] as CustomFieldValueOperationsRuntime
}

function namespaceValues(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export type CustomFieldValueRow = {
  id: string
  definitionId: string
  entityType: string
  entityId: string
  namespace: string
  key: string
} & TypedCustomFieldValueColumns

/**
 * Generic value orchestration. It owns definition authorization and locking,
 * while additive runtime providers own only queries against their entity tables.
 */
export function createCustomFieldValueService(
  operations: readonly CustomFieldValueOperationsRuntime[],
) {
  const listForOwner = async (
    db: PostgresJsDatabase,
    owner: CustomFieldDefinitionOwner,
    query: CustomFieldValueListQuery,
  ) => {
    assertCustomFieldDefinitionOwner(owner)
    if (!query.entityType) {
      return {
        data: [] as CustomFieldValueRow[],
        total: 0,
        limit: query.limit,
        offset: query.offset,
      }
    }
    const operation = operationFor(operations, query.entityType)
    const definitions = await db
      .select()
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.entityType, query.entityType),
          eq(customFieldDefinitions.lifecycleState, "active"),
          ownerWhere(owner),
        ),
      )
    const definitionsByIdentity = new Map(
      definitions.map((definition) => [
        `${definition.namespace}\u0000${definition.key}`,
        definition,
      ]),
    )
    const entities = await operation.list(db, ownerContext(owner), {
      entityType: query.entityType,
      ...(query.entityId ? { entityId: query.entityId } : {}),
    })
    const data: CustomFieldValueRow[] = []
    for (const entity of entities) {
      for (const [namespace, rawValues] of Object.entries(entity.customFields)) {
        const values = namespaceValues(rawValues)
        if (!values) continue
        for (const [key, value] of Object.entries(values)) {
          const definition = definitionsByIdentity.get(`${namespace}\u0000${key}`)
          if (!definition || (query.definitionId && definition.id !== query.definitionId)) continue
          data.push({
            id: syntheticCustomFieldValueId(
              definition.entityType,
              entity.entityId,
              definition.namespace,
              definition.id,
            ),
            definitionId: definition.id,
            entityType: definition.entityType,
            entityId: entity.entityId,
            namespace: definition.namespace,
            key: definition.key,
            ...typedCustomFieldValueFromJsonb(definition.fieldType, value),
          })
        }
      }
    }
    return {
      data: data.slice(query.offset, query.offset + query.limit),
      total: data.length,
      limit: query.limit,
      offset: query.offset,
    }
  }

  const upsertForOwner = async (
    db: PostgresJsDatabase,
    owner: CustomFieldDefinitionOwner,
    definitionId: string,
    input: UpsertCustomFieldValueInput,
  ): Promise<CustomFieldValueRow> => {
    assertCustomFieldDefinitionOwner(owner)
    return db.transaction(async (tx) => {
      const [definition] = await tx
        .select()
        .from(customFieldDefinitions)
        .where(
          and(
            eq(customFieldDefinitions.id, definitionId),
            eq(customFieldDefinitions.lifecycleState, "active"),
            ownerWhere(owner),
          ),
        )
        .for("update")
        .limit(1)
      if (!definition) {
        throw new ApiHttpError(`no custom-field definition "${definitionId}"`, {
          status: 404,
          code: "not_found",
        })
      }
      if (input.entityType !== definition.entityType) {
        throw new RequestValidationError(
          `custom field "${definition.key}" belongs to ${definition.entityType}, not ${input.entityType}`,
        )
      }
      const value = jsonbValueFromTypedCustomFieldValue(definition.fieldType, input)
      const updated = await operationFor(operations, definition.entityType).upsert(
        tx,
        ownerContext(owner),
        { definition: definitionContext(definition), entityId: input.entityId, value },
      )
      if (!updated) {
        throw new ApiHttpError(`${definition.entityType} "${input.entityId}" not found`, {
          status: 404,
          code: "not_found",
        })
      }
      return {
        id: syntheticCustomFieldValueId(
          definition.entityType,
          input.entityId,
          definition.namespace,
          definition.id,
        ),
        definitionId: definition.id,
        entityType: definition.entityType,
        entityId: input.entityId,
        namespace: definition.namespace,
        key: definition.key,
        ...typedCustomFieldValueFromJsonb(definition.fieldType, value),
      }
    })
  }

  const deleteForOwner = async (
    db: PostgresJsDatabase,
    owner: CustomFieldDefinitionOwner,
    id: string,
  ) => {
    assertCustomFieldDefinitionOwner(owner)
    const parsed = parseSyntheticCustomFieldValueId(id)
    if (!parsed || parsed.namespace !== owner.namespace) return null
    return db.transaction(async (tx) => {
      const [definition] = await tx
        .select()
        .from(customFieldDefinitions)
        .where(
          and(
            eq(customFieldDefinitions.id, parsed.definitionId),
            eq(customFieldDefinitions.lifecycleState, "active"),
            ownerWhere(owner),
          ),
        )
        .for("update")
        .limit(1)
      if (
        !definition ||
        definition.entityType !== parsed.entityType ||
        definition.namespace !== parsed.namespace
      ) {
        return null
      }
      const deleted = await operationFor(operations, definition.entityType).delete(
        tx,
        ownerContext(owner),
        { definition: definitionContext(definition), entityId: parsed.entityId },
      )
      return deleted ? { id } : null
    })
  }

  return { listForOwner, upsertForOwner, deleteForOwner }
}
