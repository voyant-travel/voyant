import { and, eq, ne } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { type ExternalRef, externalRefs } from "./external-refs/schema.js"
import type {
  DistributionCounterpartyEntityType,
  DistributionCounterpartyRecord,
  DistributionCounterpartyReference,
  DistributionCounterpartyRole,
  DistributionExternalReferenceInput,
  LinkExternalReferenceInput,
  LinkExternalReferenceOutcome,
  ReconcileCounterpartyActivityInput,
  ReconcileCounterpartyActivityOutcome,
  ResolveCounterpartyOutcome,
  RouteCounterpartyEventInput,
  RouteCounterpartyEventOutcome,
} from "./interface-types.js"
import type { ChannelReconciliationItem } from "./schema.js"
import { channelReconciliationItems, channels, channelWebhookEvents } from "./schema.js"
import { suppliers } from "./suppliers/schema.js"

export type * from "./interface-types.js"

export function counterpartyRoleToEntityType(
  role: DistributionCounterpartyRole,
): DistributionCounterpartyEntityType {
  return role
}

export function counterpartyEntityTypeToRole(
  entityType: string,
): DistributionCounterpartyRole | null {
  if (entityType === "supplier" || entityType === "channel") {
    return entityType
  }
  return null
}

export async function resolveCounterparty(
  db: PostgresJsDatabase,
  input: DistributionCounterpartyReference,
): Promise<ResolveCounterpartyOutcome> {
  const externalRef = input.externalRef
    ? await findExternalRef(db, {
        ...input.externalRef,
        entityType: input.role ? counterpartyRoleToEntityType(input.role) : undefined,
        entityId: input.id,
      })
    : null

  const role =
    input.role ?? (externalRef ? counterpartyEntityTypeToRole(externalRef.entityType) : null)
  if (!role) {
    return input.id
      ? { status: "ambiguous", reason: "role_required_for_id_lookup" }
      : { status: "not_found", reason: "external_ref_not_found" }
  }

  const id = input.id ?? externalRef?.entityId
  if (!id) {
    return { status: "not_found", reason: "external_ref_not_found" }
  }

  const counterparty = await getCounterpartyByRole(db, role, id, externalRef)
  if (!counterparty) {
    return externalRef
      ? { status: "not_found", reason: "counterparty_not_found" }
      : {
          status: "not_found",
          reason: input.externalRef ? "external_ref_not_found" : "counterparty_not_found",
        }
  }

  return { status: "resolved", counterparty }
}

export async function linkExternalReference(
  db: PostgresJsDatabase,
  input: LinkExternalReferenceInput,
): Promise<LinkExternalReferenceOutcome> {
  const resolved = await resolveCounterparty(db, input.counterparty)
  if (resolved.status !== "resolved") {
    return resolved
  }

  const entityType = resolved.counterparty.entityType
  const namespace = input.namespace ?? "default"

  if (input.isPrimary) {
    await clearPrimaryExternalRefs(db, {
      entityType,
      entityId: resolved.counterparty.id,
      sourceSystem: input.sourceSystem,
    })
  }

  const existing = await findExternalRef(db, {
    entityType,
    entityId: resolved.counterparty.id,
    sourceSystem: input.sourceSystem,
    objectType: input.objectType,
    namespace,
    externalId: input.externalId,
  })

  if (existing) {
    const [externalRef] = await db
      .update(externalRefs)
      .set({
        externalParentId: input.externalParentId,
        isPrimary: input.isPrimary,
        status: input.status,
        lastSyncedAt: toDate(input.lastSyncedAt),
        metadata: input.metadata,
        updatedAt: new Date(),
      })
      .where(eq(externalRefs.id, existing.id))
      .returning()

    return {
      status: "linked",
      counterparty: resolved.counterparty,
      externalRef: externalRef ?? existing,
      created: false,
    }
  }

  const [externalRef] = await db
    .insert(externalRefs)
    .values({
      entityType,
      entityId: resolved.counterparty.id,
      sourceSystem: input.sourceSystem,
      objectType: input.objectType,
      namespace,
      externalId: input.externalId,
      externalParentId: input.externalParentId ?? null,
      isPrimary: input.isPrimary ?? false,
      status: input.status ?? "active",
      lastSyncedAt: toDate(input.lastSyncedAt),
      metadata: input.metadata,
    })
    .returning()

  if (!externalRef) {
    throw new Error("Failed to link external reference")
  }

  return {
    status: "linked",
    counterparty: resolved.counterparty,
    externalRef,
    created: true,
  }
}

export async function routeCounterpartyEvent(
  db: PostgresJsDatabase,
  input: RouteCounterpartyEventInput,
): Promise<RouteCounterpartyEventOutcome> {
  const resolved = await resolveCounterparty(db, input.counterparty)
  if (resolved.status !== "resolved") {
    return resolved
  }

  if (resolved.counterparty.role === "supplier") {
    return {
      status: "routed",
      counterparty: resolved.counterparty,
      destination: "supplier_adapter",
      event: null,
    }
  }

  const [event] = await db
    .insert(channelWebhookEvents)
    .values({
      channelId: resolved.counterparty.id,
      eventType: input.eventType,
      externalEventId: input.externalEventId ?? null,
      payload: input.payload ?? {},
      receivedAt: toDate(input.receivedAt) ?? new Date(),
      status: input.status ?? "pending",
    })
    .returning()

  if (!event) {
    throw new Error("Failed to route channel event")
  }

  return {
    status: "routed",
    counterparty: resolved.counterparty,
    destination: "channel_webhook_events",
    event,
  }
}

export async function reconcileCounterpartyActivity(
  db: PostgresJsDatabase,
  input: ReconcileCounterpartyActivityInput,
): Promise<ReconcileCounterpartyActivityOutcome> {
  const expected = input.counterparty ? await resolveCounterparty(db, input.counterparty) : null
  if (expected && expected.status !== "resolved") {
    return expected
  }

  const externalRef = await findExternalRef(db, input.externalRef)
  if (!externalRef) {
    if (!expected || !input.createExternalReference) {
      return {
        status: "unmatched",
        reason: expected ? "external_ref_not_found" : "counterparty_required_to_create_link",
      }
    }

    const linked = await linkExternalReference(db, {
      counterparty: {
        role: expected.counterparty.role,
        id: expected.counterparty.id,
      },
      ...input.externalRef,
      metadata: input.metadata,
      lastSyncedAt: new Date(),
    })
    if (linked.status !== "linked") {
      return linked
    }

    return {
      status: "linked",
      counterparty: linked.counterparty,
      externalRef: linked.externalRef,
      reconciliationItem: await maybeCreateChannelReconciliationItem(
        db,
        linked.counterparty,
        input.channelReconciliation,
      ),
    }
  }

  const actualRole = counterpartyEntityTypeToRole(externalRef.entityType)
  if (!actualRole) {
    return { status: "unsupported", entityType: externalRef.entityType }
  }

  const actual = await getCounterpartyByRole(db, actualRole, externalRef.entityId, externalRef)
  if (!actual) {
    return { status: "not_found", reason: "counterparty_not_found" }
  }

  if (
    expected &&
    (expected.counterparty.role !== actual.role || expected.counterparty.id !== actual.id)
  ) {
    return {
      status: "conflict",
      expected: expected.counterparty,
      actual,
      externalRef,
    }
  }

  return {
    status: "matched",
    counterparty: actual,
    externalRef,
    reconciliationItem: await maybeCreateChannelReconciliationItem(
      db,
      actual,
      input.channelReconciliation,
    ),
  }
}

async function getCounterpartyByRole(
  db: PostgresJsDatabase,
  role: DistributionCounterpartyRole,
  id: string,
  externalRef?: ExternalRef | null,
): Promise<DistributionCounterpartyRecord | null> {
  if (role === "supplier") {
    const [record] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1)
    return record
      ? {
          role,
          entityType: "supplier",
          id: record.id,
          record,
          externalRef,
        }
      : null
  }

  const [record] = await db.select().from(channels).where(eq(channels.id, id)).limit(1)
  return record
    ? {
        role,
        entityType: "channel",
        id: record.id,
        record,
        externalRef,
      }
    : null
}

async function findExternalRef(
  db: PostgresJsDatabase,
  input: DistributionExternalReferenceInput & {
    entityType?: DistributionCounterpartyEntityType
    entityId?: string
  },
): Promise<ExternalRef | null> {
  const conditions = [
    eq(externalRefs.sourceSystem, input.sourceSystem),
    eq(externalRefs.objectType, input.objectType),
    eq(externalRefs.namespace, input.namespace ?? "default"),
    eq(externalRefs.externalId, input.externalId),
  ]

  if (input.entityType) {
    conditions.push(eq(externalRefs.entityType, input.entityType))
  }
  if (input.entityId) {
    conditions.push(eq(externalRefs.entityId, input.entityId))
  }

  const [row] = await db
    .select()
    .from(externalRefs)
    .where(and(...conditions))
    .limit(1)
  return row ?? null
}

async function clearPrimaryExternalRefs(
  db: PostgresJsDatabase,
  input: {
    entityType: DistributionCounterpartyEntityType
    entityId: string
    sourceSystem: string
    exceptId?: string
  },
) {
  const conditions = [
    eq(externalRefs.entityType, input.entityType),
    eq(externalRefs.entityId, input.entityId),
    eq(externalRefs.sourceSystem, input.sourceSystem),
  ]
  if (input.exceptId) {
    conditions.push(ne(externalRefs.id, input.exceptId))
  }

  await db
    .update(externalRefs)
    .set({ isPrimary: false, updatedAt: new Date() })
    .where(and(...conditions))
}

async function maybeCreateChannelReconciliationItem(
  db: PostgresJsDatabase,
  counterparty: DistributionCounterpartyRecord,
  input: ReconcileCounterpartyActivityInput["channelReconciliation"],
): Promise<ChannelReconciliationItem | null> {
  if (!input || counterparty.role !== "channel") {
    return null
  }

  const [item] = await db
    .insert(channelReconciliationItems)
    .values({
      reconciliationRunId: input.reconciliationRunId,
      bookingLinkId: input.bookingLinkId ?? null,
      bookingId: input.bookingId ?? null,
      externalBookingId: input.externalBookingId ?? null,
      issueType: input.issueType ?? "other",
      severity: input.severity ?? "warning",
      resolutionStatus: input.resolutionStatus ?? "open",
      notes: input.notes ?? null,
    })
    .returning()

  return item ?? null
}

function toDate(value: string | Date | null | undefined): Date | null | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value === null) {
    return null
  }
  return value instanceof Date ? value : new Date(value)
}
