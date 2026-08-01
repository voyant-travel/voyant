import type { EventBus } from "@voyant-travel/core"
import { identityService } from "@voyant-travel/identity/service"
import type {
  InsertContactPointForEntity,
  InsertNamedContactForEntity,
  UpdateContactPoint as UpdateIdentityContactPoint,
  UpdateNamedContact as UpdateIdentityNamedContact,
} from "@voyant-travel/identity/validation"
import { and, eq, inArray, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { emitProductPublicationChanged } from "../events.js"
import { channelContactProjections, channelProductMappings, channels } from "../schema.js"
import type { ChannelListQuery, CreateChannelInput, UpdateChannelInput } from "./types.js"

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

async function loadChannelPublicationTargets(db: PostgresJsDatabase, channelId: string) {
  return db
    .select({
      mappingId: channelProductMappings.id,
      productId: channelProductMappings.productId,
      active: channelProductMappings.active,
    })
    .from(channelProductMappings)
    .where(eq(channelProductMappings.channelId, channelId))
}

export async function emitChannelPublicationChanges(
  eventBus: EventBus | undefined,
  db: PostgresJsDatabase,
  channelId: string,
  targets: Awaited<ReturnType<typeof loadChannelPublicationTargets>>,
  operation: "updated" | "deleted",
) {
  if (!eventBus) return
  for (const target of targets) {
    await emitProductPublicationChanged(eventBus, db, {
      productId: target.productId,
      channelId,
      mappingId: target.mappingId,
      previousActive: target.active,
      nextActive: operation === "deleted" ? null : target.active,
      operation,
    })
  }
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

export const channelServiceOperations = {
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
    return channelServiceOperations.getChannelById(db, row.id)
  },

  async updateChannel(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateChannelInput,
    eventBus?: EventBus,
  ) {
    const existing = await channelServiceOperations.getChannelById(db, id)
    if (!existing) {
      return null
    }
    const publicationTargets = eventBus ? await loadChannelPublicationTargets(db, id) : []

    await db
      .update(channels)
      .set({ ...toUpdateChannelBaseValues(data), updatedAt: new Date() })
      .where(eq(channels.id, id))

    await syncChannelIdentity(db, id, {
      website: data.website === undefined ? existing.website : data.website,
      contactName: data.contactName === undefined ? existing.contactName : data.contactName,
      contactEmail: data.contactEmail === undefined ? existing.contactEmail : data.contactEmail,
    })

    // Channel status/kind changes affect every channel-scoped catalog slice,
    // even though no individual mapping row changed. Reindex each mapped
    // Product against the Channel's new state.
    await emitChannelPublicationChanges(eventBus, db, id, publicationTargets, "updated")

    return channelServiceOperations.getChannelById(db, id)
  },

  async deleteChannel(db: PostgresJsDatabase, id: string, eventBus?: EventBus) {
    // Capture mappings before the channel delete cascades them away. Their
    // Product documents must be reindexed/tombstoned after the Channel is gone.
    const publicationTargets = eventBus ? await loadChannelPublicationTargets(db, id) : []
    await deleteChannelIdentity(db, id)
    const [row] = await db
      .delete(channels)
      .where(eq(channels.id, id))
      .returning({ id: channels.id })
    if (row) {
      await emitChannelPublicationChanges(eventBus, db, id, publicationTargets, "deleted")
    }
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
}
