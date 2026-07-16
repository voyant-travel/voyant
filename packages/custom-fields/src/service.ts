import type {
  CustomFieldValueLifecycleRuntime,
  CustomFieldValueOperationsRuntime,
} from "@voyant-travel/core/runtime-port"
import { ApiHttpError } from "@voyant-travel/hono"
import { and, eq, inArray, isNull, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type {
  CustomFieldDefinitionInput,
  CustomFieldDefinitionListQuery,
  CustomFieldDefinitionUpdate,
} from "./contracts.js"
import { customFieldDefinitions } from "./schema.js"
import { normalizeCustomFieldVisibility } from "./target-capabilities.js"
import type { CustomFieldTarget } from "./targets.js"
import { createCustomFieldValueService } from "./value-service.js"

const PHYSICAL_NAMESPACE = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/

/**
 * Trusted caller context for definition-domain operations. HTTP inputs never
 * carry these facts: the app gateway must resolve them from its installation.
 */
export type CustomFieldDefinitionOwner =
  | {
      kind: "operator"
      namespace: "custom"
      ownerId?: undefined
      provenance?: Record<string, unknown>
    }
  | {
      kind: "platform" | "app"
      namespace: string
      ownerId: string
      provenance?: Record<string, unknown>
    }

export const operatorCustomFieldDefinitionOwner: CustomFieldDefinitionOwner = Object.freeze({
  kind: "operator",
  namespace: "custom",
  provenance: { source: "operator-settings" },
})

export function createAppCustomFieldDefinitionOwner(input: {
  appId: string
  namespace: string
  provenance?: Record<string, unknown>
}): CustomFieldDefinitionOwner {
  if (
    !input.appId ||
    !input.namespace.startsWith("app--") ||
    !PHYSICAL_NAMESPACE.test(input.namespace)
  ) {
    throw new Error("App custom-field owners require a platform-assigned physical namespace.")
  }
  return Object.freeze({
    kind: "app",
    ownerId: input.appId,
    namespace: input.namespace,
    provenance: input.provenance ?? { source: "app-api" },
  })
}

export function createPlatformCustomFieldDefinitionOwner(
  target: Pick<CustomFieldTarget, "namespace" | "ownerUnitId">,
  provenance: Record<string, unknown> = { source: "platform-module" },
): CustomFieldDefinitionOwner {
  if (
    !target.ownerUnitId ||
    !PHYSICAL_NAMESPACE.test(target.namespace) ||
    target.namespace === "custom" ||
    target.namespace.startsWith("app--")
  ) {
    throw new Error("Platform custom-field owners require a graph-assigned module namespace.")
  }
  return Object.freeze({
    kind: "platform",
    ownerId: target.ownerUnitId,
    namespace: target.namespace,
    provenance,
  })
}

export function assertCustomFieldDefinitionOwner(owner: CustomFieldDefinitionOwner): void {
  if (owner.kind === "operator") {
    if (owner.namespace !== "custom" || owner.ownerId !== undefined) {
      throw new Error("Operator custom-field definitions must use the reserved custom namespace.")
    }
    return
  }
  if (!owner.ownerId || !PHYSICAL_NAMESPACE.test(owner.namespace) || owner.namespace === "custom") {
    throw new Error("Non-operator custom-field owners require an owner id and physical namespace.")
  }
  if (owner.kind === "app" && !owner.namespace.startsWith("app--")) {
    throw new Error("App custom-field owners require a platform-assigned physical namespace.")
  }
  if (owner.kind === "platform" && owner.namespace.startsWith("app--")) {
    throw new Error("Platform custom-field owners cannot claim an app namespace.")
  }
}

function ownerWhere(owner: CustomFieldDefinitionOwner) {
  return owner.kind === "operator"
    ? and(
        eq(customFieldDefinitions.ownerKind, owner.kind),
        eq(customFieldDefinitions.namespace, owner.namespace),
        isNull(customFieldDefinitions.ownerId),
      )
    : and(
        eq(customFieldDefinitions.ownerKind, owner.kind),
        eq(customFieldDefinitions.ownerId, owner.ownerId),
        eq(customFieldDefinitions.namespace, owner.namespace),
      )
}

export function createCustomFieldsService(
  targets: ReadonlyMap<string, CustomFieldTarget>,
  valueLifecycles: readonly CustomFieldValueLifecycleRuntime[] = [],
  valueOperations: readonly CustomFieldValueOperationsRuntime[] = [],
) {
  const targetIds = [...targets.keys()]

  const valueLifecycleFor = (entityType: string) => {
    const matches = valueLifecycles.filter((candidate) => candidate.supports(entityType))
    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one custom-field value lifecycle provider for target "${entityType}", found ${matches.length}.`,
      )
    }
    return matches[0] as CustomFieldValueLifecycleRuntime
  }

  const assertAllowed = (
    target: string,
    fieldType?: CustomFieldDefinitionInput["fieldType"],
  ): CustomFieldTarget => {
    const definition = targets.get(target)
    if (!definition) {
      throw new ApiHttpError(`Unsupported custom-field target "${target}"`, {
        status: 400,
        code: "unsupported_custom_field_target",
      })
    }
    if (fieldType && !definition.fieldTypes.includes(fieldType)) {
      throw new ApiHttpError(`Field type "${fieldType}" is not supported by target "${target}"`, {
        status: 400,
        code: "unsupported_custom_field_type",
      })
    }
    return definition
  }

  const selectedTargetWhere = () =>
    targetIds.length > 0 ? inArray(customFieldDefinitions.entityType, targetIds) : undefined

  const listWhere = (query: CustomFieldDefinitionListQuery, owner?: CustomFieldDefinitionOwner) =>
    and(
      query.entityType
        ? eq(customFieldDefinitions.entityType, query.entityType)
        : selectedTargetWhere(),
      query.ownerKind ? eq(customFieldDefinitions.ownerKind, query.ownerKind) : undefined,
      eq(customFieldDefinitions.lifecycleState, query.lifecycleState ?? "active"),
      owner ? ownerWhere(owner) : undefined,
    )

  const getById = async (
    db: PostgresJsDatabase,
    id: string,
    owner?: CustomFieldDefinitionOwner,
    includeInactive = false,
    lockForUpdate = false,
  ) => {
    if (targetIds.length === 0) return null
    const query = db
      .select()
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.id, id),
          selectedTargetWhere(),
          includeInactive ? undefined : eq(customFieldDefinitions.lifecycleState, "active"),
          owner ? ownerWhere(owner) : undefined,
        ),
      )
    const [row] = lockForUpdate ? await query.for("update").limit(1) : await query.limit(1)
    return row ?? null
  }

  const list = async (
    db: PostgresJsDatabase,
    query: CustomFieldDefinitionListQuery,
    owner?: CustomFieldDefinitionOwner,
  ) => {
    if (query.entityType) assertAllowed(query.entityType)
    if (targetIds.length === 0) {
      return { data: [], total: 0, limit: query.limit, offset: query.offset }
    }
    const where = listWhere(query, owner)
    const [data, count] = await Promise.all([
      db
        .select()
        .from(customFieldDefinitions)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(
          customFieldDefinitions.entityType,
          customFieldDefinitions.namespace,
          customFieldDefinitions.label,
        ),
      db.select({ count: sql<number>`count(*)::int` }).from(customFieldDefinitions).where(where),
    ])
    return { data, total: count[0]?.count ?? 0, limit: query.limit, offset: query.offset }
  }

  const create = async (
    db: PostgresJsDatabase,
    owner: CustomFieldDefinitionOwner,
    input: CustomFieldDefinitionInput,
  ) => {
    assertCustomFieldDefinitionOwner(owner)
    const target = assertAllowed(input.entityType, input.fieldType)
    if (
      owner.kind === "platform" &&
      (owner.namespace !== target.namespace || owner.ownerId !== target.ownerUnitId)
    ) {
      throw new ApiHttpError("Platform definition owner does not control this target", {
        status: 403,
        code: "custom_field_definition_read_only",
      })
    }
    const [row] = await db
      .insert(customFieldDefinitions)
      .values({
        ...input,
        ...normalizeCustomFieldVisibility(target, input),
        namespace: owner.namespace,
        ownerKind: owner.kind,
        ownerId: owner.ownerId ?? null,
        lifecycleState: "active",
        provenance: owner.provenance ?? {},
      })
      .onConflictDoNothing({
        target: [
          customFieldDefinitions.entityType,
          customFieldDefinitions.namespace,
          customFieldDefinitions.key,
        ],
      })
      .returning()
    if (!row) {
      throw new ApiHttpError("Custom field key already exists for this target and namespace", {
        status: 409,
        code: "duplicate_custom_field_key",
      })
    }
    return row
  }

  const update = async (
    db: PostgresJsDatabase,
    id: string,
    owner: CustomFieldDefinitionOwner,
    input: CustomFieldDefinitionUpdate,
  ) => {
    assertCustomFieldDefinitionOwner(owner)
    return db.transaction(async (tx) => {
      const existing = await getById(tx, id, undefined, true, true)
      if (!existing) return null
      if (
        existing.ownerKind !== owner.kind ||
        existing.ownerId !== (owner.ownerId ?? null) ||
        existing.namespace !== owner.namespace
      ) {
        throw new ApiHttpError("Custom-field definition is controlled by another owner", {
          status: 403,
          code: "custom_field_definition_read_only",
        })
      }
      const target = assertAllowed(existing.entityType)
      const nextKey = input.key
      const valueLifecycle =
        nextKey && nextKey !== existing.key ? valueLifecycleFor(existing.entityType) : undefined
      let row: typeof existing | undefined
      try {
        ;[row] = await tx
          .update(customFieldDefinitions)
          .set({
            ...input,
            ...normalizeCustomFieldVisibility(target, input),
            updatedAt: new Date(),
          })
          .where(and(eq(customFieldDefinitions.id, id), ownerWhere(owner)))
          .returning()
      } catch (error) {
        if (isCustomFieldDefinitionKeyConflict(error)) {
          throw duplicateCustomFieldKeyError()
        }
        throw error
      }
      if (row && valueLifecycle && nextKey) {
        await valueLifecycle.renameDefinitionKey(tx, existing, nextKey)
      }
      return row ?? null
    })
  }

  const remove = async (db: PostgresJsDatabase, id: string, owner: CustomFieldDefinitionOwner) => {
    assertCustomFieldDefinitionOwner(owner)
    return db.transaction(async (tx) => {
      const existing = await getById(tx, id, undefined, true, true)
      if (!existing) return null
      if (
        existing.ownerKind !== owner.kind ||
        existing.ownerId !== (owner.ownerId ?? null) ||
        existing.namespace !== owner.namespace
      ) {
        throw new ApiHttpError("Custom-field definition is controlled by another owner", {
          status: 403,
          code: "custom_field_definition_read_only",
        })
      }
      const valueLifecycle = valueLifecycleFor(existing.entityType)
      const [row] = await tx
        .delete(customFieldDefinitions)
        .where(and(eq(customFieldDefinitions.id, id), ownerWhere(owner)))
        .returning({ id: customFieldDefinitions.id })
      if (row) {
        await valueLifecycle.deleteDefinitionValues(tx, existing)
      }
      return row ?? null
    })
  }

  return {
    /** Settings policy: only active selected-target definitions are visible. */
    list(db: PostgresJsDatabase, query: CustomFieldDefinitionListQuery) {
      return list(db, query)
    },
    get(db: PostgresJsDatabase, id: string) {
      return getById(db, id)
    },
    /** Settings creates only operator-owned definitions in the reserved namespace. */
    create(db: PostgresJsDatabase, input: CustomFieldDefinitionInput) {
      return create(db, operatorCustomFieldDefinitionOwner, input)
    },
    update(db: PostgresJsDatabase, id: string, input: CustomFieldDefinitionUpdate) {
      return update(db, id, operatorCustomFieldDefinitionOwner, input)
    },
    remove(db: PostgresJsDatabase, id: string) {
      return remove(db, id, operatorCustomFieldDefinitionOwner)
    },
    /** App/platform callers must use their server-resolved owner context. */
    listForOwner(
      db: PostgresJsDatabase,
      owner: CustomFieldDefinitionOwner,
      query: CustomFieldDefinitionListQuery,
    ) {
      assertCustomFieldDefinitionOwner(owner)
      return list(db, { ...query, ownerKind: undefined }, owner)
    },
    getForOwner(db: PostgresJsDatabase, owner: CustomFieldDefinitionOwner, id: string) {
      assertCustomFieldDefinitionOwner(owner)
      return getById(db, id, owner)
    },
    createForOwner(
      db: PostgresJsDatabase,
      owner: CustomFieldDefinitionOwner,
      input: CustomFieldDefinitionInput,
    ) {
      return create(db, owner, input)
    },
    updateForOwner(
      db: PostgresJsDatabase,
      owner: CustomFieldDefinitionOwner,
      id: string,
      input: CustomFieldDefinitionUpdate,
    ) {
      return update(db, id, owner, input)
    },
    removeForOwner(db: PostgresJsDatabase, owner: CustomFieldDefinitionOwner, id: string) {
      return remove(db, id, owner)
    },
    values: createCustomFieldValueService(valueOperations),
  }
}

function duplicateCustomFieldKeyError() {
  return new ApiHttpError("Custom field key already exists for this target and namespace", {
    status: 409,
    code: "duplicate_custom_field_key",
  })
}

function isCustomFieldDefinitionKeyConflict(error: unknown): boolean {
  return collectErrorStrings(error, new Set(), 0).some(
    (value) =>
      value.includes("23505") || value.includes("uidx_custom_field_definitions_namespace_key"),
  )
}

function collectErrorStrings(error: unknown, seen: Set<object>, depth: number): string[] {
  if (!error || typeof error !== "object" || depth > 6 || seen.has(error)) return []
  seen.add(error)
  const record = error as Record<string, unknown>
  const values = [
    record.code,
    record.sqlState,
    record.sqlstate,
    record.sql_state,
    record.constraint,
    record.constraintName,
    record.constraint_name,
    record.detail,
    record.message,
    record.stack,
  ].filter((value): value is string => typeof value === "string")
  for (const nested of [
    record.cause,
    record.originalError,
    record.original,
    record.error,
    record.queryError,
    record.sourceError,
  ]) {
    values.push(...collectErrorStrings(nested, seen, depth + 1))
  }
  if (Array.isArray(record.errors)) {
    for (const nested of record.errors) {
      values.push(...collectErrorStrings(nested, seen, depth + 1))
    }
  }
  return values
}
