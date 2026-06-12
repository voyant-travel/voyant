// agent-quality: file-size exception -- owner: distribution; existing service module stays co-located until a dedicated split preserves behavior and tests.
import { identityService } from "@voyantjs/identity/service"
import type {
  InsertContactPointForEntity,
  InsertNamedContactForEntity,
  UpdateContactPoint as UpdateIdentityContactPoint,
  UpdateNamedContact as UpdateIdentityNamedContact,
} from "@voyantjs/identity/validation"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import type { Channel } from "./schema.js"
import {
  channelBookingLinks,
  channelCommissionRules,
  channelContactProjections,
  channelContracts,
  channelInventoryAllotments,
  channelInventoryAllotmentTargets,
  channelInventoryReleaseExecutions,
  channelInventoryReleaseRules,
  channelProductMappings,
  channelReconciliationItems,
  channelReconciliationPolicies,
  channelReconciliationRuns,
  channelReleaseSchedules,
  channelRemittanceExceptions,
  channelSettlementApprovals,
  channelSettlementItems,
  channelSettlementPolicies,
  channelSettlementRuns,
  channels,
  channelWebhookEvents,
} from "./schema.js"
import type {
  channelBookingLinkListQuerySchema,
  channelCommissionRuleListQuerySchema,
  channelContractListQuerySchema,
  channelInventoryAllotmentListQuerySchema,
  channelInventoryAllotmentTargetListQuerySchema,
  channelInventoryReleaseExecutionListQuerySchema,
  channelInventoryReleaseRuleListQuerySchema,
  channelListQuerySchema,
  channelProductMappingListQuerySchema,
  channelReconciliationItemListQuerySchema,
  channelReconciliationPolicyListQuerySchema,
  channelReconciliationRunListQuerySchema,
  channelReleaseScheduleListQuerySchema,
  channelRemittanceExceptionListQuerySchema,
  channelSettlementApprovalListQuerySchema,
  channelSettlementItemListQuerySchema,
  channelSettlementPolicyListQuerySchema,
  channelSettlementRunListQuerySchema,
  channelWebhookEventListQuerySchema,
  insertChannelBookingLinkSchema,
  insertChannelCommissionRuleSchema,
  insertChannelContractSchema,
  insertChannelInventoryAllotmentSchema,
  insertChannelInventoryAllotmentTargetSchema,
  insertChannelInventoryReleaseExecutionSchema,
  insertChannelInventoryReleaseRuleSchema,
  insertChannelProductMappingSchema,
  insertChannelReconciliationItemSchema,
  insertChannelReconciliationPolicySchema,
  insertChannelReconciliationRunSchema,
  insertChannelReleaseScheduleSchema,
  insertChannelRemittanceExceptionSchema,
  insertChannelSchema,
  insertChannelSettlementApprovalSchema,
  insertChannelSettlementItemSchema,
  insertChannelSettlementPolicySchema,
  insertChannelSettlementRunSchema,
  insertChannelWebhookEventSchema,
  updateChannelBookingLinkSchema,
  updateChannelCommissionRuleSchema,
  updateChannelContractSchema,
  updateChannelInventoryAllotmentSchema,
  updateChannelInventoryAllotmentTargetSchema,
  updateChannelInventoryReleaseExecutionSchema,
  updateChannelInventoryReleaseRuleSchema,
  updateChannelProductMappingSchema,
  updateChannelReconciliationItemSchema,
  updateChannelReconciliationPolicySchema,
  updateChannelReconciliationRunSchema,
  updateChannelReleaseScheduleSchema,
  updateChannelRemittanceExceptionSchema,
  updateChannelSchema,
  updateChannelSettlementApprovalSchema,
  updateChannelSettlementItemSchema,
  updateChannelSettlementPolicySchema,
  updateChannelSettlementRunSchema,
  updateChannelWebhookEventSchema,
} from "./validation.js"

type ChannelListQuery = z.infer<typeof channelListQuerySchema>
type ChannelContractListQuery = z.infer<typeof channelContractListQuerySchema>
type ChannelCommissionRuleListQuery = z.infer<typeof channelCommissionRuleListQuerySchema>
type ChannelProductMappingListQuery = z.infer<typeof channelProductMappingListQuerySchema>
type ChannelBookingLinkListQuery = z.infer<typeof channelBookingLinkListQuerySchema>
type ChannelWebhookEventListQuery = z.infer<typeof channelWebhookEventListQuerySchema>
type ChannelInventoryAllotmentListQuery = z.infer<typeof channelInventoryAllotmentListQuerySchema>
type ChannelInventoryAllotmentTargetListQuery = z.infer<
  typeof channelInventoryAllotmentTargetListQuerySchema
>
type ChannelInventoryReleaseRuleListQuery = z.infer<
  typeof channelInventoryReleaseRuleListQuerySchema
>
type ChannelSettlementRunListQuery = z.infer<typeof channelSettlementRunListQuerySchema>
type ChannelSettlementItemListQuery = z.infer<typeof channelSettlementItemListQuerySchema>
type ChannelReconciliationRunListQuery = z.infer<typeof channelReconciliationRunListQuerySchema>
type ChannelReconciliationItemListQuery = z.infer<typeof channelReconciliationItemListQuerySchema>
type ChannelInventoryReleaseExecutionListQuery = z.infer<
  typeof channelInventoryReleaseExecutionListQuerySchema
>
type ChannelSettlementPolicyListQuery = z.infer<typeof channelSettlementPolicyListQuerySchema>
type ChannelReconciliationPolicyListQuery = z.infer<
  typeof channelReconciliationPolicyListQuerySchema
>
type ChannelReleaseScheduleListQuery = z.infer<typeof channelReleaseScheduleListQuerySchema>
type ChannelRemittanceExceptionListQuery = z.infer<typeof channelRemittanceExceptionListQuerySchema>
type ChannelSettlementApprovalListQuery = z.infer<typeof channelSettlementApprovalListQuerySchema>
type CreateChannelInput = z.infer<typeof insertChannelSchema>
type UpdateChannelInput = z.infer<typeof updateChannelSchema>
type CreateChannelContractInput = z.infer<typeof insertChannelContractSchema>
type UpdateChannelContractInput = z.infer<typeof updateChannelContractSchema>
type CreateChannelCommissionRuleInput = z.infer<typeof insertChannelCommissionRuleSchema>
type UpdateChannelCommissionRuleInput = z.infer<typeof updateChannelCommissionRuleSchema>
type CreateChannelProductMappingInput = z.infer<typeof insertChannelProductMappingSchema>
type UpdateChannelProductMappingInput = z.infer<typeof updateChannelProductMappingSchema>
type CreateChannelBookingLinkInput = z.infer<typeof insertChannelBookingLinkSchema>
type UpdateChannelBookingLinkInput = z.infer<typeof updateChannelBookingLinkSchema>
type CreateChannelWebhookEventInput = z.infer<typeof insertChannelWebhookEventSchema>
type UpdateChannelWebhookEventInput = z.infer<typeof updateChannelWebhookEventSchema>
type CreateChannelInventoryAllotmentInput = z.infer<typeof insertChannelInventoryAllotmentSchema>
type UpdateChannelInventoryAllotmentInput = z.infer<typeof updateChannelInventoryAllotmentSchema>
type CreateChannelInventoryAllotmentTargetInput = z.infer<
  typeof insertChannelInventoryAllotmentTargetSchema
>
type UpdateChannelInventoryAllotmentTargetInput = z.infer<
  typeof updateChannelInventoryAllotmentTargetSchema
>
type CreateChannelInventoryReleaseRuleInput = z.infer<
  typeof insertChannelInventoryReleaseRuleSchema
>
type UpdateChannelInventoryReleaseRuleInput = z.infer<
  typeof updateChannelInventoryReleaseRuleSchema
>
type CreateChannelSettlementRunInput = z.infer<typeof insertChannelSettlementRunSchema>
type UpdateChannelSettlementRunInput = z.infer<typeof updateChannelSettlementRunSchema>
type CreateChannelSettlementItemInput = z.infer<typeof insertChannelSettlementItemSchema>
type UpdateChannelSettlementItemInput = z.infer<typeof updateChannelSettlementItemSchema>
type CreateChannelReconciliationRunInput = z.infer<typeof insertChannelReconciliationRunSchema>
type UpdateChannelReconciliationRunInput = z.infer<typeof updateChannelReconciliationRunSchema>
type CreateChannelReconciliationItemInput = z.infer<typeof insertChannelReconciliationItemSchema>
type UpdateChannelReconciliationItemInput = z.infer<typeof updateChannelReconciliationItemSchema>
type CreateChannelInventoryReleaseExecutionInput = z.infer<
  typeof insertChannelInventoryReleaseExecutionSchema
>
type UpdateChannelInventoryReleaseExecutionInput = z.infer<
  typeof updateChannelInventoryReleaseExecutionSchema
>
type CreateChannelSettlementPolicyInput = z.infer<typeof insertChannelSettlementPolicySchema>
type UpdateChannelSettlementPolicyInput = z.infer<typeof updateChannelSettlementPolicySchema>
type CreateChannelReconciliationPolicyInput = z.infer<
  typeof insertChannelReconciliationPolicySchema
>
type UpdateChannelReconciliationPolicyInput = z.infer<
  typeof updateChannelReconciliationPolicySchema
>
type CreateChannelReleaseScheduleInput = z.infer<typeof insertChannelReleaseScheduleSchema>
type UpdateChannelReleaseScheduleInput = z.infer<typeof updateChannelReleaseScheduleSchema>
type CreateChannelRemittanceExceptionInput = z.infer<typeof insertChannelRemittanceExceptionSchema>
type UpdateChannelRemittanceExceptionInput = z.infer<typeof updateChannelRemittanceExceptionSchema>
type CreateChannelSettlementApprovalInput = z.infer<typeof insertChannelSettlementApprovalSchema>
type UpdateChannelSettlementApprovalInput = z.infer<typeof updateChannelSettlementApprovalSchema>

const channelEntityType = "channel"
const channelBaseIdentitySource = "distribution.base"
const channelPrimaryNamedContactSource = "distribution.primary_contact"

type ChannelIdentityInput = Pick<CreateChannelInput, "website" | "contactName" | "contactEmail">

type ChannelHydratedFields = {
  website: string | null
  contactName: string | null
  contactEmail: string | null
}

function emptyChannelHydratedFields(): ChannelHydratedFields {
  return {
    website: null,
    contactName: null,
    contactEmail: null,
  }
}

async function paginate<T extends object>(
  rowsQuery: Promise<T[]>,
  countQuery: Promise<Array<{ count: number }>>,
  limit: number,
  offset: number,
) {
  const [data, countResult] = await Promise.all([rowsQuery, countQuery])
  return { data, total: countResult[0]?.count ?? 0, limit, offset }
}

function toDateOrNull(value: string | null | undefined) {
  return value ? new Date(value) : null
}

function normalizeWebsite(value: string) {
  return value.trim().toLowerCase()
}

function isManagedBySource(metadata: Record<string, unknown> | null | undefined, source: string) {
  return metadata?.managedBy === source
}

function toNullableTrimmed(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function toCreateChannelBaseValues(data: CreateChannelInput) {
  return {
    name: data.name,
    description: data.description,
    kind: data.kind,
    status: data.status,
    metadata: data.metadata,
  }
}

function toUpdateChannelBaseValues(data: UpdateChannelInput) {
  return {
    name: data.name,
    description: data.description,
    kind: data.kind,
    status: data.status,
    metadata: data.metadata,
  }
}

async function ensureChannelExists(db: PostgresJsDatabase, channelId: string) {
  const [row] = await db
    .select({ id: channels.id })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1)
  return row ?? null
}

async function syncChannelIdentity(
  db: PostgresJsDatabase,
  channelId: string,
  data: ChannelIdentityInput,
) {
  const [existingContactPoints, existingNamedContacts] = await Promise.all([
    identityService.listContactPointsForEntity(db, channelEntityType, channelId),
    identityService.listNamedContactsForEntity(db, channelEntityType, channelId),
  ])

  const managedWebsiteContact = existingContactPoints.find(
    (point) =>
      point.kind === "website" &&
      isManagedBySource(
        point.metadata as Record<string, unknown> | null,
        channelBaseIdentitySource,
      ),
  )
  const managedPrimaryContact = existingNamedContacts.find((contact) =>
    isManagedBySource(
      contact.metadata as Record<string, unknown> | null,
      channelPrimaryNamedContactSource,
    ),
  )

  const website = toNullableTrimmed(data.website)
  if (!website) {
    if (managedWebsiteContact) {
      await identityService.deleteContactPoint(db, managedWebsiteContact.id)
    }
  } else {
    const websitePayload = {
      entityType: channelEntityType,
      entityId: channelId,
      kind: "website" as const,
      label: "website",
      value: website,
      normalizedValue: normalizeWebsite(website),
      isPrimary: true,
      metadata: {
        managedBy: channelBaseIdentitySource,
      },
    }

    if (managedWebsiteContact) {
      await identityService.updateContactPoint(db, managedWebsiteContact.id, websitePayload)
    } else {
      await identityService.createContactPoint(db, websitePayload)
    }
  }

  const contactName = toNullableTrimmed(data.contactName)
  const contactEmail = toNullableTrimmed(data.contactEmail)
  const hasPrimaryContact = Boolean(contactName || contactEmail)

  if (!hasPrimaryContact) {
    if (managedPrimaryContact) {
      await identityService.deleteNamedContact(db, managedPrimaryContact.id)
    }

    await rebuildChannelContactProjection(db, channelId)
    return
  }

  const namedContactPayload = {
    entityType: channelEntityType,
    entityId: channelId,
    role: "primary" as const,
    name: contactName ?? contactEmail ?? "Primary contact",
    email: contactEmail,
    isPrimary: true,
    metadata: {
      managedBy: channelPrimaryNamedContactSource,
    },
  }

  if (managedPrimaryContact) {
    await identityService.updateNamedContact(db, managedPrimaryContact.id, namedContactPayload)
  } else {
    await identityService.createNamedContact(db, namedContactPayload)
  }

  await rebuildChannelContactProjection(db, channelId)
}

async function deleteChannelIdentity(db: PostgresJsDatabase, channelId: string) {
  const [contactPoints, namedContacts] = await Promise.all([
    identityService.listContactPointsForEntity(db, channelEntityType, channelId),
    identityService.listNamedContactsForEntity(db, channelEntityType, channelId),
  ])

  await Promise.all([
    ...contactPoints.map((point) => identityService.deleteContactPoint(db, point.id)),
    ...namedContacts.map((contact) => identityService.deleteNamedContact(db, contact.id)),
  ])

  await rebuildChannelContactProjection(db, channelId)
}

async function rebuildChannelContactProjection(db: PostgresJsDatabase, channelId: string) {
  const [contactPoints, namedContacts] = await Promise.all([
    identityService.listContactPointsForEntity(db, channelEntityType, channelId),
    identityService.listNamedContactsForEntity(db, channelEntityType, channelId),
  ])

  const primaryWebsite =
    contactPoints.find((point) => point.kind === "website" && point.isPrimary) ??
    contactPoints.find((point) => point.kind === "website") ??
    null
  const primaryContact =
    namedContacts.find((contact) => contact.isPrimary) ?? namedContacts[0] ?? null

  await db
    .delete(channelContactProjections)
    .where(eq(channelContactProjections.channelId, channelId))

  if (!primaryWebsite && !primaryContact) {
    return
  }

  await db.insert(channelContactProjections).values({
    channelId,
    websiteContactPointId: primaryWebsite?.id ?? null,
    primaryNamedContactId: primaryContact?.id ?? null,
    website: primaryWebsite?.value ?? null,
    contactName: primaryContact?.name ?? null,
    contactEmail: primaryContact?.email ?? null,
  })
}

async function hydrateChannels<T extends { id: string }>(
  db: PostgresJsDatabase,
  rows: T[],
): Promise<Array<T & ChannelHydratedFields>> {
  if (rows.length === 0) {
    return rows.map((row) => ({ ...row, ...emptyChannelHydratedFields() }))
  }

  const ids = rows.map((row) => row.id)
  const projections = await db
    .select()
    .from(channelContactProjections)
    .where(inArray(channelContactProjections.channelId, ids))

  const projectionMap = new Map(projections.map((projection) => [projection.channelId, projection]))

  return rows.map((row) => {
    const projection = projectionMap.get(row.id)

    return {
      ...row,
      website: projection?.website ?? null,
      contactName: projection?.contactName ?? null,
      contactEmail: projection?.contactEmail ?? null,
    }
  })
}

export const distributionService = {
  async listChannels(db: PostgresJsDatabase, query: ChannelListQuery) {
    const conditions = []
    if (query.kind) conditions.push(eq(channels.kind, query.kind))
    if (query.status) conditions.push(eq(channels.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(channels)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(channels.createdAt),
      db.select({ count: sql<number>`count(*)::int` }).from(channels).where(where),
    ])

    return {
      data: await hydrateChannels(db, rows),
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getChannelById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(channels).where(eq(channels.id, id)).limit(1)
    if (!row) {
      return null
    }

    const [hydrated] = await hydrateChannels(db, [row])
    return hydrated ?? null
  },

  async createChannel(db: PostgresJsDatabase, data: CreateChannelInput) {
    const [row] = await db.insert(channels).values(toCreateChannelBaseValues(data)).returning()
    if (!row) {
      throw new Error("Failed to create channel")
    }
    await syncChannelIdentity(db, row.id, data)
    return this.getChannelById(db, row.id)
  },

  async updateChannel(db: PostgresJsDatabase, id: string, data: UpdateChannelInput) {
    const existing = await this.getChannelById(db, id)
    if (!existing) {
      return null
    }

    await db
      .update(channels)
      .set({ ...toUpdateChannelBaseValues(data), updatedAt: new Date() })
      .where(eq(channels.id, id))

    await syncChannelIdentity(db, id, {
      website: data.website === undefined ? existing.website : data.website,
      contactName: data.contactName === undefined ? existing.contactName : data.contactName,
      contactEmail: data.contactEmail === undefined ? existing.contactEmail : data.contactEmail,
    })

    return this.getChannelById(db, id)
  },

  async deleteChannel(db: PostgresJsDatabase, id: string) {
    await deleteChannelIdentity(db, id)
    const [row] = await db
      .delete(channels)
      .where(eq(channels.id, id))
      .returning({ id: channels.id })
    return row ?? null
  },

  async listChannelContactPoints(db: PostgresJsDatabase, channelId: string) {
    const channel = await ensureChannelExists(db, channelId)
    if (!channel) return null
    return identityService.listContactPointsForEntity(db, channelEntityType, channelId)
  },

  async createChannelContactPoint(
    db: PostgresJsDatabase,
    channelId: string,
    data: InsertContactPointForEntity,
  ) {
    const channel = await ensureChannelExists(db, channelId)
    if (!channel) return null

    const row = await identityService.createContactPoint(db, {
      ...data,
      entityType: channelEntityType,
      entityId: channelId,
    })

    await rebuildChannelContactProjection(db, channelId)

    return row
  },

  async updateChannelContactPoint(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateIdentityContactPoint,
  ) {
    const existing = await identityService.getContactPointById(db, id)
    if (!existing) return null

    const row = await identityService.updateContactPoint(db, id, data)
    if (row?.entityType === channelEntityType) {
      await rebuildChannelContactProjection(db, row.entityId)
    }

    return row
  },

  async deleteChannelContactPoint(db: PostgresJsDatabase, id: string) {
    const existing = await identityService.getContactPointById(db, id)
    const row = await identityService.deleteContactPoint(db, id)

    if (row && existing?.entityType === channelEntityType) {
      await rebuildChannelContactProjection(db, existing.entityId)
    }

    return row
  },

  async listChannelContacts(db: PostgresJsDatabase, channelId: string) {
    const channel = await ensureChannelExists(db, channelId)
    if (!channel) return null
    return identityService.listNamedContactsForEntity(db, channelEntityType, channelId)
  },

  async createChannelContact(
    db: PostgresJsDatabase,
    channelId: string,
    data: InsertNamedContactForEntity,
  ) {
    const channel = await ensureChannelExists(db, channelId)
    if (!channel) return null

    const row = await identityService.createNamedContact(db, {
      ...data,
      entityType: channelEntityType,
      entityId: channelId,
    })

    await rebuildChannelContactProjection(db, channelId)

    return row
  },

  async updateChannelContact(db: PostgresJsDatabase, id: string, data: UpdateIdentityNamedContact) {
    const existing = await identityService.getNamedContactById(db, id)
    if (!existing) return null

    const row = await identityService.updateNamedContact(db, id, data)
    if (row?.entityType === channelEntityType) {
      await rebuildChannelContactProjection(db, row.entityId)
    }

    return row
  },

  async deleteChannelContact(db: PostgresJsDatabase, id: string) {
    const existing = await identityService.getNamedContactById(db, id)
    const row = await identityService.deleteNamedContact(db, id)

    if (row && existing?.entityType === channelEntityType) {
      await rebuildChannelContactProjection(db, existing.entityId)
    }

    return row
  },

  async listContracts(db: PostgresJsDatabase, query: ChannelContractListQuery) {
    const conditions = []
    if (query.channelId) conditions.push(eq(channelContracts.channelId, query.channelId))
    if (query.supplierId) conditions.push(eq(channelContracts.supplierId, query.supplierId))
    if (query.status) conditions.push(eq(channelContracts.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelContracts)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelContracts.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(channelContracts).where(where),
      query.limit,
      query.offset,
    )
  },

  async getContractById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelContracts)
      .where(eq(channelContracts.id, id))
      .limit(1)
    return row ?? null
  },

  async createContract(db: PostgresJsDatabase, data: CreateChannelContractInput) {
    const [row] = await db.insert(channelContracts).values(data).returning()
    return row
  },

  async updateContract(db: PostgresJsDatabase, id: string, data: UpdateChannelContractInput) {
    const [row] = await db
      .update(channelContracts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(channelContracts.id, id))
      .returning()
    return row ?? null
  },

  async deleteContract(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelContracts)
      .where(eq(channelContracts.id, id))
      .returning({ id: channelContracts.id })
    return row ?? null
  },

  async listCommissionRules(db: PostgresJsDatabase, query: ChannelCommissionRuleListQuery) {
    const conditions = []
    if (query.contractId) conditions.push(eq(channelCommissionRules.contractId, query.contractId))
    if (query.productId) conditions.push(eq(channelCommissionRules.productId, query.productId))
    if (query.scope) conditions.push(eq(channelCommissionRules.scope, query.scope))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelCommissionRules)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelCommissionRules.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(channelCommissionRules).where(where),
      query.limit,
      query.offset,
    )
  },

  async getCommissionRuleById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelCommissionRules)
      .where(eq(channelCommissionRules.id, id))
      .limit(1)
    return row ?? null
  },

  async createCommissionRule(db: PostgresJsDatabase, data: CreateChannelCommissionRuleInput) {
    const [row] = await db.insert(channelCommissionRules).values(data).returning()
    return row
  },

  async updateCommissionRule(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelCommissionRuleInput,
  ) {
    const [row] = await db
      .update(channelCommissionRules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(channelCommissionRules.id, id))
      .returning()
    return row ?? null
  },

  async deleteCommissionRule(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelCommissionRules)
      .where(eq(channelCommissionRules.id, id))
      .returning({ id: channelCommissionRules.id })
    return row ?? null
  },

  async listProductMappings(db: PostgresJsDatabase, query: ChannelProductMappingListQuery) {
    const conditions = []
    if (query.channelId) conditions.push(eq(channelProductMappings.channelId, query.channelId))
    if (query.productId) conditions.push(eq(channelProductMappings.productId, query.productId))
    if (query.active !== undefined) conditions.push(eq(channelProductMappings.active, query.active))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelProductMappings)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelProductMappings.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(channelProductMappings).where(where),
      query.limit,
      query.offset,
    )
  },

  async getProductMappingById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelProductMappings)
      .where(eq(channelProductMappings.id, id))
      .limit(1)
    return row ?? null
  },

  async createProductMapping(db: PostgresJsDatabase, data: CreateChannelProductMappingInput) {
    const [row] = await db.insert(channelProductMappings).values(data).returning()
    return row
  },

  async updateProductMapping(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelProductMappingInput,
  ) {
    const [row] = await db
      .update(channelProductMappings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(channelProductMappings.id, id))
      .returning()
    return row ?? null
  },

  async deleteProductMapping(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelProductMappings)
      .where(eq(channelProductMappings.id, id))
      .returning({ id: channelProductMappings.id })
    return row ?? null
  },

  async listBookingLinks(db: PostgresJsDatabase, query: ChannelBookingLinkListQuery) {
    const conditions = []
    if (query.channelId) conditions.push(eq(channelBookingLinks.channelId, query.channelId))
    if (query.bookingId) conditions.push(eq(channelBookingLinks.bookingId, query.bookingId))
    if (query.externalBookingId)
      conditions.push(eq(channelBookingLinks.externalBookingId, query.externalBookingId))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelBookingLinks)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelBookingLinks.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(channelBookingLinks).where(where),
      query.limit,
      query.offset,
    )
  },

  async getBookingLinkById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelBookingLinks)
      .where(eq(channelBookingLinks.id, id))
      .limit(1)
    return row ?? null
  },

  async createBookingLink(db: PostgresJsDatabase, data: CreateChannelBookingLinkInput) {
    const [row] = await db
      .insert(channelBookingLinks)
      .values({
        ...data,
        bookedAtExternal: toDateOrNull(data.bookedAtExternal),
        lastSyncedAt: toDateOrNull(data.lastSyncedAt),
      })
      .returning()
    return row
  },

  async updateBookingLink(db: PostgresJsDatabase, id: string, data: UpdateChannelBookingLinkInput) {
    const [row] = await db
      .update(channelBookingLinks)
      .set({
        ...data,
        bookedAtExternal:
          data.bookedAtExternal === undefined ? undefined : toDateOrNull(data.bookedAtExternal),
        lastSyncedAt: data.lastSyncedAt === undefined ? undefined : toDateOrNull(data.lastSyncedAt),
        updatedAt: new Date(),
      })
      .where(eq(channelBookingLinks.id, id))
      .returning()
    return row ?? null
  },

  async deleteBookingLink(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelBookingLinks)
      .where(eq(channelBookingLinks.id, id))
      .returning({ id: channelBookingLinks.id })
    return row ?? null
  },

  async listWebhookEvents(db: PostgresJsDatabase, query: ChannelWebhookEventListQuery) {
    const conditions = []
    if (query.channelId) conditions.push(eq(channelWebhookEvents.channelId, query.channelId))
    if (query.status) conditions.push(eq(channelWebhookEvents.status, query.status))
    if (query.eventType) conditions.push(eq(channelWebhookEvents.eventType, query.eventType))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelWebhookEvents)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelWebhookEvents.receivedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(channelWebhookEvents).where(where),
      query.limit,
      query.offset,
    )
  },

  async getWebhookEventById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelWebhookEvents)
      .where(eq(channelWebhookEvents.id, id))
      .limit(1)
    return row ?? null
  },

  async createWebhookEvent(db: PostgresJsDatabase, data: CreateChannelWebhookEventInput) {
    const [row] = await db
      .insert(channelWebhookEvents)
      .values({
        ...data,
        receivedAt: toDateOrNull(data.receivedAt) ?? new Date(),
        processedAt: toDateOrNull(data.processedAt),
      })
      .returning()
    return row
  },

  async updateWebhookEvent(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelWebhookEventInput,
  ) {
    const [row] = await db
      .update(channelWebhookEvents)
      .set({
        ...data,
        receivedAt: data.receivedAt ? new Date(data.receivedAt) : undefined,
        processedAt: data.processedAt === undefined ? undefined : toDateOrNull(data.processedAt),
      })
      .where(eq(channelWebhookEvents.id, id))
      .returning()
    return row ?? null
  },

  async deleteWebhookEvent(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelWebhookEvents)
      .where(eq(channelWebhookEvents.id, id))
      .returning({ id: channelWebhookEvents.id })
    return row ?? null
  },

  async listInventoryAllotments(db: PostgresJsDatabase, query: ChannelInventoryAllotmentListQuery) {
    const conditions = []
    if (query.channelId) conditions.push(eq(channelInventoryAllotments.channelId, query.channelId))
    if (query.contractId)
      conditions.push(eq(channelInventoryAllotments.contractId, query.contractId))
    if (query.productId) conditions.push(eq(channelInventoryAllotments.productId, query.productId))
    if (query.optionId) conditions.push(eq(channelInventoryAllotments.optionId, query.optionId))
    if (query.startTimeId)
      conditions.push(eq(channelInventoryAllotments.startTimeId, query.startTimeId))
    if (query.active !== undefined)
      conditions.push(eq(channelInventoryAllotments.active, query.active))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelInventoryAllotments)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelInventoryAllotments.updatedAt)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(channelInventoryAllotments)
        .where(where),
      query.limit,
      query.offset,
    )
  },

  async getInventoryAllotmentById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelInventoryAllotments)
      .where(eq(channelInventoryAllotments.id, id))
      .limit(1)
    return row ?? null
  },

  async createInventoryAllotment(
    db: PostgresJsDatabase,
    data: CreateChannelInventoryAllotmentInput,
  ) {
    const [row] = await db.insert(channelInventoryAllotments).values(data).returning()
    return row
  },

  async updateInventoryAllotment(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelInventoryAllotmentInput,
  ) {
    const [row] = await db
      .update(channelInventoryAllotments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(channelInventoryAllotments.id, id))
      .returning()
    return row ?? null
  },

  async deleteInventoryAllotment(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelInventoryAllotments)
      .where(eq(channelInventoryAllotments.id, id))
      .returning({ id: channelInventoryAllotments.id })
    return row ?? null
  },

  async listInventoryAllotmentTargets(
    db: PostgresJsDatabase,
    query: ChannelInventoryAllotmentTargetListQuery,
  ) {
    const conditions = []
    if (query.allotmentId)
      conditions.push(eq(channelInventoryAllotmentTargets.allotmentId, query.allotmentId))
    if (query.slotId) conditions.push(eq(channelInventoryAllotmentTargets.slotId, query.slotId))
    if (query.startTimeId)
      conditions.push(eq(channelInventoryAllotmentTargets.startTimeId, query.startTimeId))
    if (query.dateLocal)
      conditions.push(eq(channelInventoryAllotmentTargets.dateLocal, query.dateLocal))
    if (query.active !== undefined)
      conditions.push(eq(channelInventoryAllotmentTargets.active, query.active))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelInventoryAllotmentTargets)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelInventoryAllotmentTargets.updatedAt)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(channelInventoryAllotmentTargets)
        .where(where),
      query.limit,
      query.offset,
    )
  },

  async getInventoryAllotmentTargetById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelInventoryAllotmentTargets)
      .where(eq(channelInventoryAllotmentTargets.id, id))
      .limit(1)
    return row ?? null
  },

  async createInventoryAllotmentTarget(
    db: PostgresJsDatabase,
    data: CreateChannelInventoryAllotmentTargetInput,
  ) {
    const [row] = await db.insert(channelInventoryAllotmentTargets).values(data).returning()
    return row
  },

  async updateInventoryAllotmentTarget(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelInventoryAllotmentTargetInput,
  ) {
    const [row] = await db
      .update(channelInventoryAllotmentTargets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(channelInventoryAllotmentTargets.id, id))
      .returning()
    return row ?? null
  },

  async deleteInventoryAllotmentTarget(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelInventoryAllotmentTargets)
      .where(eq(channelInventoryAllotmentTargets.id, id))
      .returning({ id: channelInventoryAllotmentTargets.id })
    return row ?? null
  },

  async listInventoryReleaseRules(
    db: PostgresJsDatabase,
    query: ChannelInventoryReleaseRuleListQuery,
  ) {
    const conditions = []
    if (query.allotmentId)
      conditions.push(eq(channelInventoryReleaseRules.allotmentId, query.allotmentId))
    if (query.releaseMode)
      conditions.push(eq(channelInventoryReleaseRules.releaseMode, query.releaseMode))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelInventoryReleaseRules)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelInventoryReleaseRules.updatedAt)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(channelInventoryReleaseRules)
        .where(where),
      query.limit,
      query.offset,
    )
  },

  async getInventoryReleaseRuleById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelInventoryReleaseRules)
      .where(eq(channelInventoryReleaseRules.id, id))
      .limit(1)
    return row ?? null
  },

  async createInventoryReleaseRule(
    db: PostgresJsDatabase,
    data: CreateChannelInventoryReleaseRuleInput,
  ) {
    const [row] = await db.insert(channelInventoryReleaseRules).values(data).returning()
    return row
  },

  async updateInventoryReleaseRule(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelInventoryReleaseRuleInput,
  ) {
    const [row] = await db
      .update(channelInventoryReleaseRules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(channelInventoryReleaseRules.id, id))
      .returning()
    return row ?? null
  },

  async deleteInventoryReleaseRule(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelInventoryReleaseRules)
      .where(eq(channelInventoryReleaseRules.id, id))
      .returning({ id: channelInventoryReleaseRules.id })
    return row ?? null
  },

  async listSettlementRuns(db: PostgresJsDatabase, query: ChannelSettlementRunListQuery) {
    const conditions = []
    if (query.channelId) conditions.push(eq(channelSettlementRuns.channelId, query.channelId))
    if (query.contractId) conditions.push(eq(channelSettlementRuns.contractId, query.contractId))
    if (query.status) conditions.push(eq(channelSettlementRuns.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelSettlementRuns)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelSettlementRuns.updatedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(channelSettlementRuns).where(where),
      query.limit,
      query.offset,
    )
  },

  async getSettlementRunById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelSettlementRuns)
      .where(eq(channelSettlementRuns.id, id))
      .limit(1)
    return row ?? null
  },

  async createSettlementRun(db: PostgresJsDatabase, data: CreateChannelSettlementRunInput) {
    const { generatedAt, postedAt, paidAt, ...rest } = data
    const [row] = await db
      .insert(channelSettlementRuns)
      .values({
        ...rest,
        generatedAt: toDateOrNull(generatedAt),
        postedAt: toDateOrNull(postedAt),
        paidAt: toDateOrNull(paidAt),
      })
      .returning()
    return row
  },

  async updateSettlementRun(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelSettlementRunInput,
  ) {
    const { generatedAt, postedAt, paidAt, ...rest } = data
    const [row] = await db
      .update(channelSettlementRuns)
      .set({
        ...rest,
        generatedAt: toDateOrNull(generatedAt),
        postedAt: toDateOrNull(postedAt),
        paidAt: toDateOrNull(paidAt),
        updatedAt: new Date(),
      })
      .where(eq(channelSettlementRuns.id, id))
      .returning()
    return row ?? null
  },

  async deleteSettlementRun(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelSettlementRuns)
      .where(eq(channelSettlementRuns.id, id))
      .returning({ id: channelSettlementRuns.id })
    return row ?? null
  },

  async listSettlementItems(db: PostgresJsDatabase, query: ChannelSettlementItemListQuery) {
    const conditions = []
    if (query.settlementRunId) {
      conditions.push(eq(channelSettlementItems.settlementRunId, query.settlementRunId))
    }
    if (query.bookingLinkId) {
      conditions.push(eq(channelSettlementItems.bookingLinkId, query.bookingLinkId))
    }
    if (query.bookingId) conditions.push(eq(channelSettlementItems.bookingId, query.bookingId))
    if (query.status) conditions.push(eq(channelSettlementItems.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelSettlementItems)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelSettlementItems.updatedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(channelSettlementItems).where(where),
      query.limit,
      query.offset,
    )
  },

  async getSettlementItemById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelSettlementItems)
      .where(eq(channelSettlementItems.id, id))
      .limit(1)
    return row ?? null
  },

  async createSettlementItem(db: PostgresJsDatabase, data: CreateChannelSettlementItemInput) {
    const { remittanceDueAt, paidAt, ...rest } = data
    const [row] = await db
      .insert(channelSettlementItems)
      .values({
        ...rest,
        remittanceDueAt: toDateOrNull(remittanceDueAt),
        paidAt: toDateOrNull(paidAt),
      })
      .returning()
    return row
  },

  async updateSettlementItem(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelSettlementItemInput,
  ) {
    const { remittanceDueAt, paidAt, ...rest } = data
    const [row] = await db
      .update(channelSettlementItems)
      .set({
        ...rest,
        remittanceDueAt: toDateOrNull(remittanceDueAt),
        paidAt: toDateOrNull(paidAt),
        updatedAt: new Date(),
      })
      .where(eq(channelSettlementItems.id, id))
      .returning()
    return row ?? null
  },

  async deleteSettlementItem(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelSettlementItems)
      .where(eq(channelSettlementItems.id, id))
      .returning({ id: channelSettlementItems.id })
    return row ?? null
  },

  async listReconciliationRuns(db: PostgresJsDatabase, query: ChannelReconciliationRunListQuery) {
    const conditions = []
    if (query.channelId) conditions.push(eq(channelReconciliationRuns.channelId, query.channelId))
    if (query.contractId) {
      conditions.push(eq(channelReconciliationRuns.contractId, query.contractId))
    }
    if (query.status) conditions.push(eq(channelReconciliationRuns.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelReconciliationRuns)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelReconciliationRuns.updatedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(channelReconciliationRuns).where(where),
      query.limit,
      query.offset,
    )
  },

  async getReconciliationRunById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelReconciliationRuns)
      .where(eq(channelReconciliationRuns.id, id))
      .limit(1)
    return row ?? null
  },

  async createReconciliationRun(db: PostgresJsDatabase, data: CreateChannelReconciliationRunInput) {
    const { startedAt, completedAt, ...rest } = data
    const [row] = await db
      .insert(channelReconciliationRuns)
      .values({
        ...rest,
        startedAt: toDateOrNull(startedAt),
        completedAt: toDateOrNull(completedAt),
      })
      .returning()
    return row
  },

  async updateReconciliationRun(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelReconciliationRunInput,
  ) {
    const { startedAt, completedAt, ...rest } = data
    const [row] = await db
      .update(channelReconciliationRuns)
      .set({
        ...rest,
        startedAt: toDateOrNull(startedAt),
        completedAt: toDateOrNull(completedAt),
        updatedAt: new Date(),
      })
      .where(eq(channelReconciliationRuns.id, id))
      .returning()
    return row ?? null
  },

  async deleteReconciliationRun(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelReconciliationRuns)
      .where(eq(channelReconciliationRuns.id, id))
      .returning({ id: channelReconciliationRuns.id })
    return row ?? null
  },

  async listReconciliationItems(db: PostgresJsDatabase, query: ChannelReconciliationItemListQuery) {
    const conditions = []
    if (query.reconciliationRunId) {
      conditions.push(eq(channelReconciliationItems.reconciliationRunId, query.reconciliationRunId))
    }
    if (query.bookingLinkId) {
      conditions.push(eq(channelReconciliationItems.bookingLinkId, query.bookingLinkId))
    }
    if (query.bookingId) {
      conditions.push(eq(channelReconciliationItems.bookingId, query.bookingId))
    }
    if (query.issueType) conditions.push(eq(channelReconciliationItems.issueType, query.issueType))
    if (query.resolutionStatus) {
      conditions.push(eq(channelReconciliationItems.resolutionStatus, query.resolutionStatus))
    }
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelReconciliationItems)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelReconciliationItems.updatedAt)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(channelReconciliationItems)
        .where(where),
      query.limit,
      query.offset,
    )
  },

  async getReconciliationItemById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelReconciliationItems)
      .where(eq(channelReconciliationItems.id, id))
      .limit(1)
    return row ?? null
  },

  async createReconciliationItem(
    db: PostgresJsDatabase,
    data: CreateChannelReconciliationItemInput,
  ) {
    const { resolvedAt, ...rest } = data
    const [row] = await db
      .insert(channelReconciliationItems)
      .values({
        ...rest,
        resolvedAt: toDateOrNull(resolvedAt),
      })
      .returning()
    return row
  },

  async updateReconciliationItem(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelReconciliationItemInput,
  ) {
    const { resolvedAt, ...rest } = data
    const [row] = await db
      .update(channelReconciliationItems)
      .set({
        ...rest,
        resolvedAt: toDateOrNull(resolvedAt),
        updatedAt: new Date(),
      })
      .where(eq(channelReconciliationItems.id, id))
      .returning()
    return row ?? null
  },

  async deleteReconciliationItem(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelReconciliationItems)
      .where(eq(channelReconciliationItems.id, id))
      .returning({ id: channelReconciliationItems.id })
    return row ?? null
  },

  async listReleaseExecutions(
    db: PostgresJsDatabase,
    query: ChannelInventoryReleaseExecutionListQuery,
  ) {
    const conditions = []
    if (query.allotmentId) {
      conditions.push(eq(channelInventoryReleaseExecutions.allotmentId, query.allotmentId))
    }
    if (query.releaseRuleId) {
      conditions.push(eq(channelInventoryReleaseExecutions.releaseRuleId, query.releaseRuleId))
    }
    if (query.targetId) {
      conditions.push(eq(channelInventoryReleaseExecutions.targetId, query.targetId))
    }
    if (query.slotId) conditions.push(eq(channelInventoryReleaseExecutions.slotId, query.slotId))
    if (query.status) conditions.push(eq(channelInventoryReleaseExecutions.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelInventoryReleaseExecutions)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelInventoryReleaseExecutions.updatedAt)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(channelInventoryReleaseExecutions)
        .where(where),
      query.limit,
      query.offset,
    )
  },

  async getReleaseExecutionById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelInventoryReleaseExecutions)
      .where(eq(channelInventoryReleaseExecutions.id, id))
      .limit(1)
    return row ?? null
  },

  async createReleaseExecution(
    db: PostgresJsDatabase,
    data: CreateChannelInventoryReleaseExecutionInput,
  ) {
    const { executedAt, ...rest } = data
    const [row] = await db
      .insert(channelInventoryReleaseExecutions)
      .values({
        ...rest,
        executedAt: toDateOrNull(executedAt),
      })
      .returning()
    return row
  },

  async updateReleaseExecution(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelInventoryReleaseExecutionInput,
  ) {
    const { executedAt, ...rest } = data
    const [row] = await db
      .update(channelInventoryReleaseExecutions)
      .set({
        ...rest,
        executedAt: toDateOrNull(executedAt),
        updatedAt: new Date(),
      })
      .where(eq(channelInventoryReleaseExecutions.id, id))
      .returning()
    return row ?? null
  },

  async deleteReleaseExecution(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelInventoryReleaseExecutions)
      .where(eq(channelInventoryReleaseExecutions.id, id))
      .returning({ id: channelInventoryReleaseExecutions.id })
    return row ?? null
  },

  async listSettlementPolicies(db: PostgresJsDatabase, query: ChannelSettlementPolicyListQuery) {
    const conditions = []
    if (query.channelId) conditions.push(eq(channelSettlementPolicies.channelId, query.channelId))
    if (query.contractId)
      conditions.push(eq(channelSettlementPolicies.contractId, query.contractId))
    if (query.frequency) conditions.push(eq(channelSettlementPolicies.frequency, query.frequency))
    if (query.active !== undefined)
      conditions.push(eq(channelSettlementPolicies.active, query.active))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelSettlementPolicies)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelSettlementPolicies.updatedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(channelSettlementPolicies).where(where),
      query.limit,
      query.offset,
    )
  },

  async getSettlementPolicyById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelSettlementPolicies)
      .where(eq(channelSettlementPolicies.id, id))
      .limit(1)
    return row ?? null
  },

  async createSettlementPolicy(db: PostgresJsDatabase, data: CreateChannelSettlementPolicyInput) {
    const [row] = await db.insert(channelSettlementPolicies).values(data).returning()
    return row
  },

  async updateSettlementPolicy(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelSettlementPolicyInput,
  ) {
    const [row] = await db
      .update(channelSettlementPolicies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(channelSettlementPolicies.id, id))
      .returning()
    return row ?? null
  },

  async deleteSettlementPolicy(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelSettlementPolicies)
      .where(eq(channelSettlementPolicies.id, id))
      .returning({ id: channelSettlementPolicies.id })
    return row ?? null
  },

  async listReconciliationPolicies(
    db: PostgresJsDatabase,
    query: ChannelReconciliationPolicyListQuery,
  ) {
    const conditions = []
    if (query.channelId)
      conditions.push(eq(channelReconciliationPolicies.channelId, query.channelId))
    if (query.contractId)
      conditions.push(eq(channelReconciliationPolicies.contractId, query.contractId))
    if (query.frequency)
      conditions.push(eq(channelReconciliationPolicies.frequency, query.frequency))
    if (query.active !== undefined)
      conditions.push(eq(channelReconciliationPolicies.active, query.active))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelReconciliationPolicies)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelReconciliationPolicies.updatedAt)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(channelReconciliationPolicies)
        .where(where),
      query.limit,
      query.offset,
    )
  },

  async getReconciliationPolicyById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelReconciliationPolicies)
      .where(eq(channelReconciliationPolicies.id, id))
      .limit(1)
    return row ?? null
  },

  async createReconciliationPolicy(
    db: PostgresJsDatabase,
    data: CreateChannelReconciliationPolicyInput,
  ) {
    const [row] = await db.insert(channelReconciliationPolicies).values(data).returning()
    return row
  },

  async updateReconciliationPolicy(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelReconciliationPolicyInput,
  ) {
    const [row] = await db
      .update(channelReconciliationPolicies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(channelReconciliationPolicies.id, id))
      .returning()
    return row ?? null
  },

  async deleteReconciliationPolicy(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelReconciliationPolicies)
      .where(eq(channelReconciliationPolicies.id, id))
      .returning({ id: channelReconciliationPolicies.id })
    return row ?? null
  },

  async listReleaseSchedules(db: PostgresJsDatabase, query: ChannelReleaseScheduleListQuery) {
    const conditions = []
    if (query.releaseRuleId)
      conditions.push(eq(channelReleaseSchedules.releaseRuleId, query.releaseRuleId))
    if (query.scheduleKind)
      conditions.push(eq(channelReleaseSchedules.scheduleKind, query.scheduleKind))
    if (query.active !== undefined)
      conditions.push(eq(channelReleaseSchedules.active, query.active))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelReleaseSchedules)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelReleaseSchedules.updatedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(channelReleaseSchedules).where(where),
      query.limit,
      query.offset,
    )
  },

  async getReleaseScheduleById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelReleaseSchedules)
      .where(eq(channelReleaseSchedules.id, id))
      .limit(1)
    return row ?? null
  },

  async createReleaseSchedule(db: PostgresJsDatabase, data: CreateChannelReleaseScheduleInput) {
    const [row] = await db
      .insert(channelReleaseSchedules)
      .values({
        ...data,
        nextRunAt: toDateOrNull(data.nextRunAt),
        lastRunAt: toDateOrNull(data.lastRunAt),
      })
      .returning()
    return row
  },

  async updateReleaseSchedule(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelReleaseScheduleInput,
  ) {
    const [row] = await db
      .update(channelReleaseSchedules)
      .set({
        ...data,
        nextRunAt: toDateOrNull(data.nextRunAt),
        lastRunAt: toDateOrNull(data.lastRunAt),
        updatedAt: new Date(),
      })
      .where(eq(channelReleaseSchedules.id, id))
      .returning()
    return row ?? null
  },

  async deleteReleaseSchedule(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelReleaseSchedules)
      .where(eq(channelReleaseSchedules.id, id))
      .returning({ id: channelReleaseSchedules.id })
    return row ?? null
  },

  async listRemittanceExceptions(
    db: PostgresJsDatabase,
    query: ChannelRemittanceExceptionListQuery,
  ) {
    const conditions = []
    if (query.channelId) conditions.push(eq(channelRemittanceExceptions.channelId, query.channelId))
    if (query.settlementItemId)
      conditions.push(eq(channelRemittanceExceptions.settlementItemId, query.settlementItemId))
    if (query.reconciliationItemId)
      conditions.push(
        eq(channelRemittanceExceptions.reconciliationItemId, query.reconciliationItemId),
      )
    if (query.status) conditions.push(eq(channelRemittanceExceptions.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelRemittanceExceptions)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelRemittanceExceptions.updatedAt)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(channelRemittanceExceptions)
        .where(where),
      query.limit,
      query.offset,
    )
  },

  async getRemittanceExceptionById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelRemittanceExceptions)
      .where(eq(channelRemittanceExceptions.id, id))
      .limit(1)
    return row ?? null
  },

  async createRemittanceException(
    db: PostgresJsDatabase,
    data: CreateChannelRemittanceExceptionInput,
  ) {
    const [row] = await db
      .insert(channelRemittanceExceptions)
      .values({
        ...data,
        openedAt: toDateOrNull(data.openedAt) ?? new Date(),
        resolvedAt: toDateOrNull(data.resolvedAt),
      })
      .returning()
    return row
  },

  async updateRemittanceException(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelRemittanceExceptionInput,
  ) {
    const [row] = await db
      .update(channelRemittanceExceptions)
      .set({
        ...data,
        openedAt: data.openedAt ? new Date(data.openedAt) : undefined,
        resolvedAt: toDateOrNull(data.resolvedAt),
        updatedAt: new Date(),
      })
      .where(eq(channelRemittanceExceptions.id, id))
      .returning()
    return row ?? null
  },

  async deleteRemittanceException(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelRemittanceExceptions)
      .where(eq(channelRemittanceExceptions.id, id))
      .returning({ id: channelRemittanceExceptions.id })
    return row ?? null
  },

  async listSettlementApprovals(db: PostgresJsDatabase, query: ChannelSettlementApprovalListQuery) {
    const conditions = []
    if (query.settlementRunId)
      conditions.push(eq(channelSettlementApprovals.settlementRunId, query.settlementRunId))
    if (query.status) conditions.push(eq(channelSettlementApprovals.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(channelSettlementApprovals)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(channelSettlementApprovals.updatedAt)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(channelSettlementApprovals)
        .where(where),
      query.limit,
      query.offset,
    )
  },

  async getSettlementApprovalById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(channelSettlementApprovals)
      .where(eq(channelSettlementApprovals.id, id))
      .limit(1)
    return row ?? null
  },

  async createSettlementApproval(
    db: PostgresJsDatabase,
    data: CreateChannelSettlementApprovalInput,
  ) {
    const [row] = await db
      .insert(channelSettlementApprovals)
      .values({
        ...data,
        decidedAt: toDateOrNull(data.decidedAt),
      })
      .returning()
    return row
  },

  async updateSettlementApproval(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelSettlementApprovalInput,
  ) {
    const [row] = await db
      .update(channelSettlementApprovals)
      .set({
        ...data,
        decidedAt: toDateOrNull(data.decidedAt),
        updatedAt: new Date(),
      })
      .where(eq(channelSettlementApprovals.id, id))
      .returning()
    return row ?? null
  },

  async deleteSettlementApproval(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(channelSettlementApprovals)
      .where(eq(channelSettlementApprovals.id, id))
      .returning({ id: channelSettlementApprovals.id })
    return row ?? null
  },
}

export type HydratedChannel = Channel & ChannelHydratedFields
