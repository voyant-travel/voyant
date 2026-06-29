import { and, asc, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { sellabilitySnapshotItems, sellabilitySnapshots } from "./schema.js"
import { resolve } from "./service-resolve.js"
import {
  paginate,
  type ResolvedPriceComponent,
  type SellabilityResolveQuery,
  type SellabilitySnapshotItemListQuery,
  type SellabilitySnapshotListQuery,
} from "./service-shared.js"
import type { SellabilityPersistSnapshotInput } from "./validation.js"

type SellabilityResolver = typeof resolve

function normalizeDateTime(value: string | null | undefined) {
  return value ? new Date(value) : null
}

async function persistResolvedSnapshot(
  db: PostgresJsDatabase,
  input: {
    query: SellabilityResolveQuery
    resolved: Awaited<ReturnType<typeof resolve>>
    selectedCandidateIndex?: number
    offerId?: string | null
    status?: "resolved" | "offer_constructed" | "expired"
    expiresAt?: string | null
  },
) {
  const primaryCandidate = input.resolved.data[0] ?? null
  const [snapshot] = await db
    .insert(sellabilitySnapshots)
    .values({
      offerId: input.offerId ?? null,
      marketId: primaryCandidate?.market?.id ?? input.query.marketId ?? null,
      channelId: primaryCandidate?.channel?.id ?? input.query.channelId ?? null,
      productId: primaryCandidate?.product.id ?? input.query.productId ?? null,
      optionId: primaryCandidate?.option.id ?? input.query.optionId ?? null,
      slotId: primaryCandidate?.slot.id ?? input.query.slotId ?? null,
      requestedCurrencyCode: input.query.currencyCode ?? null,
      sourceCurrencyCode: primaryCandidate?.pricing.currencyCode ?? null,
      fxRateSetId: primaryCandidate?.pricing.fx?.fxRateSetId ?? null,
      status: input.status ?? "resolved",
      queryPayload: { ...input.query },
      pricingSummary: {
        totalCandidates: input.resolved.meta.total,
        selectedCandidateIndex: input.selectedCandidateIndex ?? null,
      },
      expiresAt: normalizeDateTime(input.expiresAt ?? null),
    })
    .returning()

  if (!snapshot) {
    throw new Error("Failed to persist sellability snapshot")
  }

  const itemValues = input.resolved.data.flatMap((candidate, candidateIndex) => {
    const components = (candidate.pricing.components as ResolvedPriceComponent[]) ?? []
    const normalizedComponents =
      components.length > 0
        ? components
        : [
            {
              kind: "base" as const,
              title: candidate.option.name,
              quantity: 1,
              pricingMode: "per_booking",
              sellAmountCents: candidate.pricing.sellAmountCents,
              costAmountCents: candidate.pricing.costAmountCents,
              unitId: null,
              unitName: null,
              unitType: null,
              pricingCategoryId: null,
              pricingCategoryName: null,
              requestRef: null,
              sourceRuleId: candidate.sources.optionPriceRuleId,
              tierId: null,
            },
          ]

    return normalizedComponents.map((component, componentIndex) => ({
      snapshotId: snapshot.id,
      candidateIndex,
      componentIndex,
      productId: candidate.product.id,
      optionId: candidate.option.id,
      slotId: candidate.slot.id,
      unitId: component.unitId,
      requestRef: component.requestRef,
      componentKind: component.kind,
      title: component.title,
      quantity: component.quantity,
      pricingMode: component.pricingMode,
      pricingCategoryId: component.pricingCategoryId,
      pricingCategoryName: component.pricingCategoryName,
      unitName: component.unitName,
      unitType: component.unitType,
      currencyCode: candidate.pricing.currencyCode,
      sellAmountCents: component.sellAmountCents,
      costAmountCents: component.costAmountCents,
      sourceRuleId: component.sourceRuleId,
      tierId: component.tierId,
      isSelected: input.selectedCandidateIndex === candidateIndex,
    }))
  })

  if (itemValues.length > 0) {
    await db.insert(sellabilitySnapshotItems).values(itemValues)
  }

  return snapshot
}

export async function persistSnapshot(
  db: PostgresJsDatabase,
  input: SellabilityPersistSnapshotInput,
  resolver: SellabilityResolver = resolve,
) {
  const resolvedQuery: SellabilityResolveQuery = {
    ...input.query,
    limit: input.query.limit ?? 25,
  }
  const resolved = await resolver(db, resolvedQuery)
  const snapshot = await persistResolvedSnapshot(db, {
    query: resolvedQuery,
    resolved,
    status: "resolved",
    expiresAt: input.expiresAt ?? null,
  })
  return { snapshot, resolved }
}

export async function listSnapshots(db: PostgresJsDatabase, query: SellabilitySnapshotListQuery) {
  const conditions = []
  if (query.offerId) conditions.push(eq(sellabilitySnapshots.offerId, query.offerId))
  if (query.marketId) conditions.push(eq(sellabilitySnapshots.marketId, query.marketId))
  if (query.channelId) conditions.push(eq(sellabilitySnapshots.channelId, query.channelId))
  if (query.productId) conditions.push(eq(sellabilitySnapshots.productId, query.productId))
  if (query.optionId) conditions.push(eq(sellabilitySnapshots.optionId, query.optionId))
  if (query.slotId) conditions.push(eq(sellabilitySnapshots.slotId, query.slotId))
  if (query.status) conditions.push(eq(sellabilitySnapshots.status, query.status))
  const where = conditions.length > 0 ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(sellabilitySnapshots)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(desc(sellabilitySnapshots.updatedAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(sellabilitySnapshots).where(where),
    query.limit,
    query.offset,
  )
}

export async function getSnapshotById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(sellabilitySnapshots)
    .where(eq(sellabilitySnapshots.id, id))
    .limit(1)
  return row ?? null
}

export async function listSnapshotItems(
  db: PostgresJsDatabase,
  query: SellabilitySnapshotItemListQuery,
) {
  const conditions = []
  if (query.snapshotId) conditions.push(eq(sellabilitySnapshotItems.snapshotId, query.snapshotId))
  if (query.productId) conditions.push(eq(sellabilitySnapshotItems.productId, query.productId))
  if (query.optionId) conditions.push(eq(sellabilitySnapshotItems.optionId, query.optionId))
  if (query.slotId) conditions.push(eq(sellabilitySnapshotItems.slotId, query.slotId))
  if (query.unitId) conditions.push(eq(sellabilitySnapshotItems.unitId, query.unitId))
  const where = conditions.length > 0 ? and(...conditions) : undefined
  return paginate(
    db
      .select()
      .from(sellabilitySnapshotItems)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(
        asc(sellabilitySnapshotItems.candidateIndex),
        asc(sellabilitySnapshotItems.componentIndex),
      ),
    db.select({ count: sql<number>`count(*)::int` }).from(sellabilitySnapshotItems).where(where),
    query.limit,
    query.offset,
  )
}
