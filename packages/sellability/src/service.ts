import { availabilitySlots } from "@voyantjs/availability/schema"
import {
  channelInventoryAllotments,
  channelInventoryAllotmentTargets,
  channelInventoryReleaseRules,
  channels,
} from "@voyantjs/distribution/schema"
import {
  exchangeRates,
  fxRateSets,
  marketChannelRules,
  marketPriceCatalogs,
  marketProductRules,
  markets,
} from "@voyantjs/markets/schema"
import {
  optionPriceRules,
  optionStartTimeRules,
  optionUnitPriceRules,
  optionUnitTiers,
  pickupPriceRules,
  priceCatalogs,
  priceSchedules,
  pricingCategories,
} from "@voyantjs/pricing/schema"
import { optionUnits, productOptions, products } from "@voyantjs/products/schema"
import { transactionsService } from "@voyantjs/transactions"
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"
import {
  offerExpirationEvents,
  offerRefreshRuns,
  sellabilityExplanations,
  sellabilityPolicies,
  sellabilityPolicyResults,
  sellabilitySnapshotItems,
  sellabilitySnapshots,
} from "./schema.js"
import type {
  insertOfferExpirationEventSchema,
  insertOfferRefreshRunSchema,
  insertSellabilityExplanationSchema,
  insertSellabilityPolicyResultSchema,
  insertSellabilityPolicySchema,
  offerExpirationEventListQuerySchema,
  offerRefreshRunListQuerySchema,
  SellabilityConstructOfferInput,
  SellabilityPersistSnapshotInput,
  SellabilityResolveQuery,
  sellabilityExplanationListQuerySchema,
  sellabilityPolicyListQuerySchema,
  sellabilityPolicyResultListQuerySchema,
  updateOfferExpirationEventSchema,
  updateOfferRefreshRunSchema,
  updateSellabilityExplanationSchema,
  updateSellabilityPolicyResultSchema,
  updateSellabilityPolicySchema,
} from "./validation.js"

type RequestedUnit = SellabilityResolveQuery["requestedUnits"][number]

type SellabilitySnapshotListQuery = {
  limit: number
  offset: number
  offerId?: string
  marketId?: string
  channelId?: string
  productId?: string
  optionId?: string
  slotId?: string
  status?: "resolved" | "offer_constructed" | "expired"
}

type SellabilitySnapshotItemListQuery = {
  limit: number
  offset: number
  snapshotId?: string
  productId?: string
  optionId?: string
  slotId?: string
  unitId?: string
}

type SellabilityPolicyListQuery = z.infer<typeof sellabilityPolicyListQuerySchema>
type CreateSellabilityPolicyInput = z.infer<typeof insertSellabilityPolicySchema>
type UpdateSellabilityPolicyInput = z.infer<typeof updateSellabilityPolicySchema>
type SellabilityPolicyResultListQuery = z.infer<typeof sellabilityPolicyResultListQuerySchema>
type CreateSellabilityPolicyResultInput = z.infer<typeof insertSellabilityPolicyResultSchema>
type UpdateSellabilityPolicyResultInput = z.infer<typeof updateSellabilityPolicyResultSchema>
type OfferRefreshRunListQuery = z.infer<typeof offerRefreshRunListQuerySchema>
type CreateOfferRefreshRunInput = z.infer<typeof insertOfferRefreshRunSchema>
type UpdateOfferRefreshRunInput = z.infer<typeof updateOfferRefreshRunSchema>
type OfferExpirationEventListQuery = z.infer<typeof offerExpirationEventListQuerySchema>
type CreateOfferExpirationEventInput = z.infer<typeof insertOfferExpirationEventSchema>
type UpdateOfferExpirationEventInput = z.infer<typeof updateOfferExpirationEventSchema>
type SellabilityExplanationListQuery = z.infer<typeof sellabilityExplanationListQuerySchema>
type CreateSellabilityExplanationInput = z.infer<typeof insertSellabilityExplanationSchema>
type UpdateSellabilityExplanationInput = z.infer<typeof updateSellabilityExplanationSchema>

type ResolvedPriceBreakdown = {
  requestRef: string | null
  unitId: string | null
  unitName: string | null
  unitType: string | null
  pricingCategoryId: string | null
  pricingCategoryName: string | null
  quantity: number
  pricingMode: string
  sellAmountCents: number
  costAmountCents: number
  sourceRuleId: string | null
  tierId: string | null
}

type ResolvedPriceComponent = {
  kind: "base" | "unit" | "pickup" | "start_time_adjustment"
  title: string
  quantity: number
  pricingMode: string
  sellAmountCents: number
  costAmountCents: number
  unitId: string | null
  unitName: string | null
  unitType: string | null
  pricingCategoryId: string | null
  pricingCategoryName: string | null
  requestRef: string | null
  sourceRuleId: string | null
  tierId: string | null
}

function weekdayCandidates(dateLocal: string) {
  const weekday = new Date(`${dateLocal}T00:00:00Z`).getUTCDay()
  const names = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
  const longNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  return [String(weekday), names[weekday], longNames[weekday]]
}

function scheduleMatches(
  schedule: {
    validFrom: string | null
    validTo: string | null
    weekdays: string[] | null
  },
  dateLocal?: string,
) {
  if (!dateLocal) return true
  if (schedule.validFrom && dateLocal < schedule.validFrom) return false
  if (schedule.validTo && dateLocal > schedule.validTo) return false
  if (!schedule.weekdays || schedule.weekdays.length === 0) return true
  const candidates = weekdayCandidates(dateLocal)
  return schedule.weekdays.some((entry) => candidates.includes(entry.toLowerCase()))
}

function applyAdjustment(
  total: { sellAmountCents: number; costAmountCents: number },
  adjustment: {
    adjustmentType: "fixed" | "percentage" | null
    sellAdjustmentCents: number | null
    costAdjustmentCents: number | null
    adjustmentBasisPoints: number | null
  },
) {
  if (adjustment.adjustmentType === "fixed") {
    return {
      sellAmountCents: total.sellAmountCents + (adjustment.sellAdjustmentCents ?? 0),
      costAmountCents: total.costAmountCents + (adjustment.costAdjustmentCents ?? 0),
    }
  }

  if (adjustment.adjustmentType === "percentage" && adjustment.adjustmentBasisPoints) {
    return {
      sellAmountCents:
        total.sellAmountCents +
        Math.round((total.sellAmountCents * adjustment.adjustmentBasisPoints) / 10_000),
      costAmountCents:
        total.costAmountCents +
        Math.round((total.costAmountCents * adjustment.adjustmentBasisPoints) / 10_000),
    }
  }

  return total
}

function computeUnitAmounts(
  request: RequestedUnit,
  details: {
    unitName: string | null
    unitType: string | null
    pricingCategoryName: string | null
  },
  unitRule: {
    id: string
    pricingMode: string
    sellAmountCents: number | null
    costAmountCents: number | null
  } | null,
  tier: {
    id: string
    sellAmountCents: number | null
    costAmountCents: number | null
  } | null,
): ResolvedPriceBreakdown {
  const pricingMode = unitRule?.pricingMode ?? "per_unit"
  const baseSell = tier?.sellAmountCents ?? unitRule?.sellAmountCents ?? 0
  const baseCost = tier?.costAmountCents ?? unitRule?.costAmountCents ?? 0

  if (pricingMode === "included" || pricingMode === "free") {
    return {
      requestRef: request.requestRef ?? null,
      unitId: request.unitId ?? null,
      unitName: details.unitName,
      unitType: details.unitType,
      pricingCategoryId: request.pricingCategoryId ?? null,
      pricingCategoryName: details.pricingCategoryName,
      quantity: request.quantity,
      pricingMode,
      sellAmountCents: 0,
      costAmountCents: 0,
      sourceRuleId: unitRule?.id ?? null,
      tierId: tier?.id ?? null,
    }
  }

  const multiplier = pricingMode === "per_booking" ? 1 : request.quantity

  return {
    requestRef: request.requestRef ?? null,
    unitId: request.unitId ?? null,
    unitName: details.unitName,
    unitType: details.unitType,
    pricingCategoryId: request.pricingCategoryId ?? null,
    pricingCategoryName: details.pricingCategoryName,
    quantity: request.quantity,
    pricingMode,
    sellAmountCents: baseSell * multiplier,
    costAmountCents: baseCost * multiplier,
    sourceRuleId: unitRule?.id ?? null,
    tierId: tier?.id ?? null,
  }
}

function chooseBestScheduledRule<
  T extends { isDefault?: boolean | null; priceScheduleId?: string | null },
>(rows: T[]) {
  return (
    [...rows].sort((a, b) => {
      const scoreA = Number(Boolean(a.priceScheduleId)) * 10 + Number(Boolean(a.isDefault))
      const scoreB = Number(Boolean(b.priceScheduleId)) * 10 + Number(Boolean(b.isDefault))
      return scoreB - scoreA
    })[0] ?? null
  )
}

function chooseBestSpecificRule<T extends { optionId?: string | null }>(rows: T[]) {
  return (
    [...rows].sort((a, b) => Number(Boolean(b.optionId)) - Number(Boolean(a.optionId)))[0] ?? null
  )
}

function toNumeric(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null
  return typeof value === "number" ? value : Number(value)
}

function compactObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T
}

function formatSequenceNumber(prefix: string) {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  const day = String(now.getUTCDate()).padStart(2, "0")
  const time =
    String(now.getUTCHours()).padStart(2, "0") + String(now.getUTCMinutes()).padStart(2, "0")
  const random = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}-${year}${month}${day}-${time}${random}`
}

function buildDefaultOfferTitle(candidate: {
  product: { name: string }
  option: { name: string }
  slot: { dateLocal: string | null }
}) {
  if (candidate.slot.dateLocal) {
    return `${candidate.product.name} · ${candidate.option.name} · ${candidate.slot.dateLocal}`
  }
  return `${candidate.product.name} · ${candidate.option.name}`
}

function isAssignableParticipantType(participantType: string) {
  return participantType === "traveler" || participantType === "occupant"
}

function defaultItemParticipantRole(
  participant: SellabilityConstructOfferInput["participants"][number],
) {
  if (participant.itemParticipantRole) return participant.itemParticipantRole
  if (participant.participantType === "occupant") return "occupant"
  if (participant.participantType === "staff") return "service_assignee"
  return "traveler"
}

function offerItemTypeForComponent(component: ResolvedPriceComponent) {
  if (component.kind === "pickup") return "transport" as const
  if (component.kind === "start_time_adjustment") {
    return component.sellAmountCents < 0 ? ("discount" as const) : ("adjustment" as const)
  }
  if (component.kind === "base") return "service" as const
  if (component.unitType === "room") return "accommodation" as const
  if (component.unitType === "vehicle") return "transport" as const
  return "unit" as const
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

function normalizeDateTime(value: string | null | undefined) {
  return value ? new Date(value) : null
}

async function persistResolvedSnapshot(
  db: PostgresJsDatabase,
  input: {
    query: SellabilityResolveQuery
    resolved: Awaited<ReturnType<typeof sellabilityService.resolve>>
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
      queryPayload: input.query as unknown as Record<string, unknown>,
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

export const sellabilityService = {
  async constructOffer(db: PostgresJsDatabase, input: SellabilityConstructOfferInput) {
    const resolvedQuery: SellabilityResolveQuery = {
      ...input.query,
      limit: input.query.limit ?? 100,
    }
    const resolved = await sellabilityService.resolve(db, resolvedQuery)
    const candidate =
      resolved.data.find(
        (row) =>
          row.slot.id === input.query.slotId &&
          (!input.query.optionId || row.option.id === input.query.optionId) &&
          (!input.query.productId || row.product.id === input.query.productId),
      ) ?? null

    if (!candidate) {
      return null
    }

    const components = candidate.pricing.components as ResolvedPriceComponent[]
    const pricedComponents =
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

    const hasUnitComponents = pricedComponents.some((component) => component.kind === "unit")

    const itemDrafts = pricedComponents.map((component, index) => {
      const quantity = component.quantity > 0 ? component.quantity : 1
      return {
        title: component.title,
        description: null,
        itemType: offerItemTypeForComponent(component),
        status: "priced" as const,
        productId: candidate.product.id,
        optionId: candidate.option.id,
        unitId: component.unitId,
        slotId: candidate.slot.id,
        serviceDate: candidate.slot.dateLocal,
        startsAt: candidate.slot.startsAt ? new Date(candidate.slot.startsAt).toISOString() : null,
        endsAt: null,
        quantity,
        sellCurrency: candidate.pricing.currencyCode,
        unitSellAmountCents: Math.round(component.sellAmountCents / quantity),
        totalSellAmountCents: component.sellAmountCents,
        taxAmountCents: null,
        feeAmountCents: null,
        costCurrency: candidate.pricing.currencyCode,
        unitCostAmountCents: Math.round(component.costAmountCents / quantity),
        totalCostAmountCents: component.costAmountCents,
        notes: null,
        metadata: compactObject({
          componentKind: component.kind,
          requestRef: component.requestRef,
          unitName: component.unitName,
          unitType: component.unitType,
          pricingCategoryId: component.pricingCategoryId,
          pricingCategoryName: component.pricingCategoryName,
          sourceRuleId: component.sourceRuleId,
          tierId: component.tierId,
          sortOrder: index,
        }),
        requestRef: component.requestRef,
        participantLinkable:
          component.kind === "unit" || (component.kind === "base" && !hasUnitComponents),
      }
    })

    const bundleParticipants = input.participants.map((participant) => ({
      personId: participant.personId ?? null,
      participantType: participant.participantType,
      travelerCategory: participant.travelerCategory ?? null,
      firstName: participant.firstName,
      lastName: participant.lastName,
      email: participant.email ?? null,
      phone: participant.phone ?? null,
      preferredLanguage: participant.preferredLanguage ?? null,
      dateOfBirth: participant.dateOfBirth ?? null,
      nationality: participant.nationality ?? null,
      isPrimary: participant.isPrimary,
      notes: participant.notes ?? null,
    }))

    const linkableItemIndexes = itemDrafts
      .map((item, index) => (item.participantLinkable ? index : -1))
      .filter((index) => index >= 0)
    const fallbackLinkableItemIndex = linkableItemIndexes[0] ?? (itemDrafts.length > 0 ? 0 : null)

    const itemParticipants = [] as Array<{
      itemIndex: number
      participantIndex: number
      role: ReturnType<typeof defaultItemParticipantRole>
      isPrimary: boolean
    }>
    const contactAssignments = [] as Array<{
      itemIndex?: number
      role: "primary_contact" | "other"
      personId: string | null
      firstName: string
      lastName: string
      email: string | null
      phone: string | null
      preferredLanguage: string | null
      isPrimary: boolean
      notes: string | null
    }>

    input.participants.forEach((participant, participantIndex) => {
      const explicitRefs = new Set(participant.requestedUnitRefs)
      let targetIndexes = itemDrafts
        .map((item, itemIndex) =>
          item.requestRef && explicitRefs.has(item.requestRef) ? itemIndex : -1,
        )
        .filter((itemIndex) => itemIndex >= 0)

      if (targetIndexes.length === 0) {
        if (
          participant.assignToAllItems ||
          isAssignableParticipantType(participant.participantType)
        ) {
          targetIndexes = linkableItemIndexes
        }
      }

      const dedupedIndexes = [...new Set(targetIndexes)]
      dedupedIndexes.forEach((itemIndex, linkIndex) => {
        itemParticipants.push({
          itemIndex,
          participantIndex,
          role: defaultItemParticipantRole(participant),
          isPrimary: Boolean(participant.isPrimary) && linkIndex === 0,
        })
      })
    })

    input.contactAssignments.forEach((contactAssignment) => {
      const explicitRefs = new Set(contactAssignment.requestedUnitRefs)
      let targetIndexes = itemDrafts
        .map((item, itemIndex) =>
          item.requestRef && explicitRefs.has(item.requestRef) ? itemIndex : -1,
        )
        .filter((itemIndex) => itemIndex >= 0)

      if (targetIndexes.length === 0) {
        if (contactAssignment.assignToAllItems) {
          targetIndexes = linkableItemIndexes
        } else if (contactAssignment.isPrimary && fallbackLinkableItemIndex !== null) {
          targetIndexes = [fallbackLinkableItemIndex]
        }
      }

      const dedupedIndexes = [...new Set(targetIndexes)]
      if (dedupedIndexes.length === 0) {
        contactAssignments.push({
          role: contactAssignment.role,
          personId: contactAssignment.personId ?? null,
          firstName: contactAssignment.firstName,
          lastName: contactAssignment.lastName,
          email: contactAssignment.email ?? null,
          phone: contactAssignment.phone ?? null,
          preferredLanguage: contactAssignment.preferredLanguage ?? null,
          isPrimary: Boolean(contactAssignment.isPrimary),
          notes: contactAssignment.notes ?? null,
        })
        return
      }

      dedupedIndexes.forEach((itemIndex, linkIndex) => {
        contactAssignments.push({
          itemIndex,
          role: contactAssignment.role,
          personId: contactAssignment.personId ?? null,
          firstName: contactAssignment.firstName,
          lastName: contactAssignment.lastName,
          email: contactAssignment.email ?? null,
          phone: contactAssignment.phone ?? null,
          preferredLanguage: contactAssignment.preferredLanguage ?? null,
          isPrimary: Boolean(contactAssignment.isPrimary) && linkIndex === 0,
          notes: contactAssignment.notes ?? null,
        })
      })
    })

    const selectedCandidateIndex = resolved.data.findIndex(
      (row) => row.slot.id === candidate.slot.id,
    )
    const created = await transactionsService.createOfferBundle(db, {
      offer: {
        offerNumber: input.offer.offerNumber ?? formatSequenceNumber("OFF"),
        title: input.offer.title ?? buildDefaultOfferTitle(candidate),
        status: input.offer.status,
        personId: input.offer.personId ?? null,
        organizationId: input.offer.organizationId ?? null,
        opportunityId: input.offer.opportunityId ?? null,
        quoteId: input.offer.quoteId ?? null,
        contactFirstName: input.offer.contactFirstName ?? null,
        contactLastName: input.offer.contactLastName ?? null,
        contactEmail: input.offer.contactEmail ?? null,
        contactPhone: input.offer.contactPhone ?? null,
        contactPreferredLanguage: input.offer.contactPreferredLanguage ?? null,
        contactCountry: input.offer.contactCountry ?? null,
        contactRegion: input.offer.contactRegion ?? null,
        contactCity: input.offer.contactCity ?? null,
        contactAddressLine1: input.offer.contactAddressLine1 ?? null,
        contactAddressLine2: input.offer.contactAddressLine2 ?? null,
        contactPostalCode: input.offer.contactPostalCode ?? null,
        marketId: candidate.market?.id ?? input.query.marketId ?? null,
        sourceChannelId: candidate.channel?.id ?? input.query.channelId ?? null,
        currency: candidate.pricing.currencyCode,
        baseCurrency: candidate.pricing.fx?.baseCurrency ?? null,
        fxRateSetId: candidate.pricing.fx?.fxRateSetId ?? null,
        subtotalAmountCents: candidate.pricing.sellAmountCents,
        taxAmountCents: 0,
        feeAmountCents: 0,
        totalAmountCents: candidate.pricing.sellAmountCents,
        costAmountCents: candidate.pricing.costAmountCents,
        validFrom: input.offer.validFrom ?? null,
        validUntil: input.offer.validUntil ?? null,
        notes: input.offer.notes ?? null,
        metadata: {
          ...(input.offer.metadata ?? {}),
          sellability: {
            query: input.query,
            resolution: candidate.sources,
            onRequest: candidate.sellability.onRequest,
            allotmentStatus: candidate.sellability.allotmentStatus,
            selectedCandidateIndex: selectedCandidateIndex >= 0 ? selectedCandidateIndex : null,
          },
        },
      },
      travelers: bundleParticipants,
      contactAssignments,
      items: itemDrafts.map(
        ({ requestRef: _requestRef, participantLinkable: _participantLinkable, ...item }) => item,
      ),
      itemTravelers: itemParticipants,
    })

    if (!created) {
      return null
    }

    const snapshot = await persistResolvedSnapshot(db, {
      query: resolvedQuery,
      resolved,
      selectedCandidateIndex: selectedCandidateIndex >= 0 ? selectedCandidateIndex : 0,
      offerId: created.offer.id,
      status: "offer_constructed",
      expiresAt: input.offer.validUntil ?? null,
    })

    await transactionsService.updateOffer(db, created.offer.id, {
      metadata: {
        ...(created.offer.metadata as Record<string, unknown> | null),
        sellability: {
          ...((created.offer.metadata as Record<string, unknown> | null)?.sellability as
            | Record<string, unknown>
            | undefined),
          snapshotId: snapshot.id,
        },
      },
    })

    return {
      ...created,
      resolution: candidate,
      snapshot,
    }
  },
  async persistSnapshot(db: PostgresJsDatabase, input: SellabilityPersistSnapshotInput) {
    const resolvedQuery: SellabilityResolveQuery = {
      ...input.query,
      limit: input.query.limit ?? 25,
    }
    const resolved = await sellabilityService.resolve(db, resolvedQuery)
    const snapshot = await persistResolvedSnapshot(db, {
      query: resolvedQuery,
      resolved,
      status: "resolved",
      expiresAt: input.expiresAt ?? null,
    })
    return { snapshot, resolved }
  },
  async listSnapshots(db: PostgresJsDatabase, query: SellabilitySnapshotListQuery) {
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
  },
  async getSnapshotById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(sellabilitySnapshots)
      .where(eq(sellabilitySnapshots.id, id))
      .limit(1)
    return row ?? null
  },
  async listSnapshotItems(db: PostgresJsDatabase, query: SellabilitySnapshotItemListQuery) {
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
  },
  async listPolicies(db: PostgresJsDatabase, query: SellabilityPolicyListQuery) {
    const conditions = []
    if (query.scope) conditions.push(eq(sellabilityPolicies.scope, query.scope))
    if (query.policyType) conditions.push(eq(sellabilityPolicies.policyType, query.policyType))
    if (query.productId) conditions.push(eq(sellabilityPolicies.productId, query.productId))
    if (query.optionId) conditions.push(eq(sellabilityPolicies.optionId, query.optionId))
    if (query.marketId) conditions.push(eq(sellabilityPolicies.marketId, query.marketId))
    if (query.channelId) conditions.push(eq(sellabilityPolicies.channelId, query.channelId))
    if (query.active !== undefined) conditions.push(eq(sellabilityPolicies.active, query.active))
    const where = conditions.length > 0 ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(sellabilityPolicies)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(sellabilityPolicies.priority), asc(sellabilityPolicies.name)),
      db.select({ count: sql<number>`count(*)::int` }).from(sellabilityPolicies).where(where),
      query.limit,
      query.offset,
    )
  },
  async getPolicyById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(sellabilityPolicies)
      .where(eq(sellabilityPolicies.id, id))
      .limit(1)
    return row ?? null
  },
  async createPolicy(db: PostgresJsDatabase, data: CreateSellabilityPolicyInput) {
    const [row] = await db.insert(sellabilityPolicies).values(data).returning()
    return row ?? null
  },
  async updatePolicy(db: PostgresJsDatabase, id: string, data: UpdateSellabilityPolicyInput) {
    const [row] = await db
      .update(sellabilityPolicies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sellabilityPolicies.id, id))
      .returning()
    return row ?? null
  },
  async deletePolicy(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(sellabilityPolicies)
      .where(eq(sellabilityPolicies.id, id))
      .returning({ id: sellabilityPolicies.id })
    return row ?? null
  },
  async listPolicyResults(db: PostgresJsDatabase, query: SellabilityPolicyResultListQuery) {
    const conditions = []
    if (query.snapshotId) conditions.push(eq(sellabilityPolicyResults.snapshotId, query.snapshotId))
    if (query.snapshotItemId)
      conditions.push(eq(sellabilityPolicyResults.snapshotItemId, query.snapshotItemId))
    if (query.policyId) conditions.push(eq(sellabilityPolicyResults.policyId, query.policyId))
    if (query.status) conditions.push(eq(sellabilityPolicyResults.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(sellabilityPolicyResults)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(sellabilityPolicyResults.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(sellabilityPolicyResults).where(where),
      query.limit,
      query.offset,
    )
  },
  async getPolicyResultById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(sellabilityPolicyResults)
      .where(eq(sellabilityPolicyResults.id, id))
      .limit(1)
    return row ?? null
  },
  async createPolicyResult(db: PostgresJsDatabase, data: CreateSellabilityPolicyResultInput) {
    const [row] = await db.insert(sellabilityPolicyResults).values(data).returning()
    return row ?? null
  },
  async updatePolicyResult(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateSellabilityPolicyResultInput,
  ) {
    const [row] = await db
      .update(sellabilityPolicyResults)
      .set(data)
      .where(eq(sellabilityPolicyResults.id, id))
      .returning()
    return row ?? null
  },
  async deletePolicyResult(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(sellabilityPolicyResults)
      .where(eq(sellabilityPolicyResults.id, id))
      .returning({ id: sellabilityPolicyResults.id })
    return row ?? null
  },
  async listOfferRefreshRuns(db: PostgresJsDatabase, query: OfferRefreshRunListQuery) {
    const conditions = []
    if (query.offerId) conditions.push(eq(offerRefreshRuns.offerId, query.offerId))
    if (query.snapshotId) conditions.push(eq(offerRefreshRuns.snapshotId, query.snapshotId))
    if (query.status) conditions.push(eq(offerRefreshRuns.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(offerRefreshRuns)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(offerRefreshRuns.startedAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(offerRefreshRuns).where(where),
      query.limit,
      query.offset,
    )
  },
  async getOfferRefreshRunById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(offerRefreshRuns)
      .where(eq(offerRefreshRuns.id, id))
      .limit(1)
    return row ?? null
  },
  async createOfferRefreshRun(db: PostgresJsDatabase, data: CreateOfferRefreshRunInput) {
    const [row] = await db
      .insert(offerRefreshRuns)
      .values({
        ...data,
        startedAt: normalizeDateTime(data.startedAt) ?? new Date(),
        completedAt: normalizeDateTime(data.completedAt),
      })
      .returning()
    return row ?? null
  },
  async updateOfferRefreshRun(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateOfferRefreshRunInput,
  ) {
    const [row] = await db
      .update(offerRefreshRuns)
      .set({
        ...data,
        startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
        completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(offerRefreshRuns.id, id))
      .returning()
    return row ?? null
  },
  async deleteOfferRefreshRun(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(offerRefreshRuns)
      .where(eq(offerRefreshRuns.id, id))
      .returning({ id: offerRefreshRuns.id })
    return row ?? null
  },
  async listOfferExpirationEvents(db: PostgresJsDatabase, query: OfferExpirationEventListQuery) {
    const conditions = []
    if (query.offerId) conditions.push(eq(offerExpirationEvents.offerId, query.offerId))
    if (query.snapshotId) conditions.push(eq(offerExpirationEvents.snapshotId, query.snapshotId))
    if (query.status) conditions.push(eq(offerExpirationEvents.status, query.status))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(offerExpirationEvents)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(offerExpirationEvents.expiresAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(offerExpirationEvents).where(where),
      query.limit,
      query.offset,
    )
  },
  async getOfferExpirationEventById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(offerExpirationEvents)
      .where(eq(offerExpirationEvents.id, id))
      .limit(1)
    return row ?? null
  },
  async createOfferExpirationEvent(db: PostgresJsDatabase, data: CreateOfferExpirationEventInput) {
    const [row] = await db
      .insert(offerExpirationEvents)
      .values({
        ...data,
        expiresAt: new Date(data.expiresAt),
        expiredAt: normalizeDateTime(data.expiredAt),
      })
      .returning()
    return row ?? null
  },
  async updateOfferExpirationEvent(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateOfferExpirationEventInput,
  ) {
    const [row] = await db
      .update(offerExpirationEvents)
      .set({
        ...data,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
        expiredAt: normalizeDateTime(data.expiredAt),
        updatedAt: new Date(),
      })
      .where(eq(offerExpirationEvents.id, id))
      .returning()
    return row ?? null
  },
  async deleteOfferExpirationEvent(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(offerExpirationEvents)
      .where(eq(offerExpirationEvents.id, id))
      .returning({ id: offerExpirationEvents.id })
    return row ?? null
  },
  async listExplanations(db: PostgresJsDatabase, query: SellabilityExplanationListQuery) {
    const conditions = []
    if (query.snapshotId) conditions.push(eq(sellabilityExplanations.snapshotId, query.snapshotId))
    if (query.snapshotItemId)
      conditions.push(eq(sellabilityExplanations.snapshotItemId, query.snapshotItemId))
    if (query.explanationType)
      conditions.push(eq(sellabilityExplanations.explanationType, query.explanationType))
    const where = conditions.length ? and(...conditions) : undefined
    return paginate(
      db
        .select()
        .from(sellabilityExplanations)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(sellabilityExplanations.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(sellabilityExplanations).where(where),
      query.limit,
      query.offset,
    )
  },
  async getExplanationById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(sellabilityExplanations)
      .where(eq(sellabilityExplanations.id, id))
      .limit(1)
    return row ?? null
  },
  async createExplanation(db: PostgresJsDatabase, data: CreateSellabilityExplanationInput) {
    const [row] = await db.insert(sellabilityExplanations).values(data).returning()
    return row ?? null
  },
  async updateExplanation(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateSellabilityExplanationInput,
  ) {
    const [row] = await db
      .update(sellabilityExplanations)
      .set(data)
      .where(eq(sellabilityExplanations.id, id))
      .returning()
    return row ?? null
  },
  async deleteExplanation(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(sellabilityExplanations)
      .where(eq(sellabilityExplanations.id, id))
      .returning({ id: sellabilityExplanations.id })
    return row ?? null
  },
  async resolve(db: PostgresJsDatabase, query: SellabilityResolveQuery) {
    const optionConditions = [eq(products.status, "active"), eq(productOptions.status, "active")]
    if (query.productId) optionConditions.push(eq(products.id, query.productId))
    if (query.optionId) optionConditions.push(eq(productOptions.id, query.optionId))

    const optionRows = await db
      .select({
        productId: products.id,
        productName: products.name,
        productSellCurrency: products.sellCurrency,
        optionId: productOptions.id,
        optionName: productOptions.name,
        optionCode: productOptions.code,
        optionIsDefault: productOptions.isDefault,
        optionAvailableFrom: productOptions.availableFrom,
        optionAvailableTo: productOptions.availableTo,
      })
      .from(productOptions)
      .innerJoin(products, eq(productOptions.productId, products.id))
      .where(and(...optionConditions))
      .orderBy(asc(products.name), asc(productOptions.sortOrder))

    if (optionRows.length === 0) {
      return { data: [], meta: { total: 0 } }
    }

    const optionIds = optionRows.map((row) => row.optionId)
    const productIds = [...new Set(optionRows.map((row) => row.productId))]

    const slotConditions = [
      inArray(availabilitySlots.optionId, optionIds),
      eq(availabilitySlots.status, "open"),
    ]
    if (query.slotId) slotConditions.push(eq(availabilitySlots.id, query.slotId))
    if (query.dateLocal) slotConditions.push(eq(availabilitySlots.dateLocal, query.dateLocal))
    if (query.startTimeId) slotConditions.push(eq(availabilitySlots.startTimeId, query.startTimeId))

    const slots = await db
      .select({
        id: availabilitySlots.id,
        productId: availabilitySlots.productId,
        optionId: availabilitySlots.optionId,
        startTimeId: availabilitySlots.startTimeId,
        dateLocal: availabilitySlots.dateLocal,
        startsAt: availabilitySlots.startsAt,
        timezone: availabilitySlots.timezone,
        unlimited: availabilitySlots.unlimited,
        remainingPax: availabilitySlots.remainingPax,
        remainingPickups: availabilitySlots.remainingPickups,
        pastCutoff: availabilitySlots.pastCutoff,
        tooEarly: availabilitySlots.tooEarly,
      })
      .from(availabilitySlots)
      .where(and(...slotConditions))
      .orderBy(asc(availabilitySlots.startsAt))
      .limit(query.limit)

    const startTimeIds = [
      ...new Set(slots.flatMap((slot) => (slot.startTimeId ? [slot.startTimeId] : []))),
    ]
    const slotIds = slots.map((slot) => slot.id)

    const [
      marketRow,
      channelRow,
      marketProductRuleRows,
      marketChannelRuleRows,
      marketCatalogRows,
      catalogRows,
      optionPriceRuleRows,
      optionScheduleRows,
      unitPriceRuleRows,
      unitTierRows,
      unitRows,
      pricingCategoryRows,
      startTimeRuleRows,
      pickupRuleRows,
      allotmentRows,
      allotmentTargetRows,
      releaseRuleRows,
      exchangeRateRow,
    ] = await Promise.all([
      query.marketId
        ? db
            .select()
            .from(markets)
            .where(eq(markets.id, query.marketId))
            .limit(1)
            .then((rows) => rows[0] ?? null)
        : Promise.resolve(null),
      query.channelId
        ? db
            .select({ id: channels.id, kind: channels.kind })
            .from(channels)
            .where(eq(channels.id, query.channelId))
            .limit(1)
            .then((rows) => rows[0] ?? null)
        : Promise.resolve(null),
      query.marketId
        ? db
            .select()
            .from(marketProductRules)
            .where(
              and(
                eq(marketProductRules.marketId, query.marketId),
                eq(marketProductRules.active, true),
                inArray(marketProductRules.productId, productIds),
              ),
            )
        : Promise.resolve([]),
      query.marketId && query.channelId
        ? db
            .select()
            .from(marketChannelRules)
            .where(
              and(
                eq(marketChannelRules.marketId, query.marketId),
                eq(marketChannelRules.channelId, query.channelId),
                eq(marketChannelRules.active, true),
              ),
            )
        : Promise.resolve([]),
      query.marketId
        ? db
            .select({
              id: marketPriceCatalogs.id,
              marketId: marketPriceCatalogs.marketId,
              priceCatalogId: marketPriceCatalogs.priceCatalogId,
              isDefault: marketPriceCatalogs.isDefault,
              priority: marketPriceCatalogs.priority,
              active: marketPriceCatalogs.active,
            })
            .from(marketPriceCatalogs)
            .where(
              and(
                eq(marketPriceCatalogs.marketId, query.marketId),
                eq(marketPriceCatalogs.active, true),
              ),
            )
        : Promise.resolve([]),
      db
        .select({ id: priceCatalogs.id, currencyCode: priceCatalogs.currencyCode })
        .from(priceCatalogs),
      db
        .select()
        .from(optionPriceRules)
        .where(
          and(inArray(optionPriceRules.optionId, optionIds), eq(optionPriceRules.active, true)),
        ),
      db.select().from(priceSchedules),
      db
        .select()
        .from(optionUnitPriceRules)
        .where(
          and(
            inArray(optionUnitPriceRules.optionId, optionIds),
            eq(optionUnitPriceRules.active, true),
          ),
        ),
      db.select().from(optionUnitTiers).where(eq(optionUnitTiers.active, true)),
      db
        .select({ id: optionUnits.id, name: optionUnits.name, unitType: optionUnits.unitType })
        .from(optionUnits),
      db
        .select({ id: pricingCategories.id, name: pricingCategories.name })
        .from(pricingCategories)
        .where(eq(pricingCategories.active, true)),
      startTimeIds.length
        ? db
            .select()
            .from(optionStartTimeRules)
            .where(
              and(
                inArray(optionStartTimeRules.optionId, optionIds),
                inArray(optionStartTimeRules.startTimeId, startTimeIds),
                eq(optionStartTimeRules.active, true),
              ),
            )
        : Promise.resolve([]),
      query.pickupPointId
        ? db
            .select()
            .from(pickupPriceRules)
            .where(
              and(
                inArray(pickupPriceRules.optionId, optionIds),
                eq(pickupPriceRules.pickupPointId, query.pickupPointId),
                eq(pickupPriceRules.active, true),
              ),
            )
        : Promise.resolve([]),
      query.channelId
        ? db
            .select()
            .from(channelInventoryAllotments)
            .where(
              and(
                eq(channelInventoryAllotments.channelId, query.channelId),
                eq(channelInventoryAllotments.active, true),
                inArray(channelInventoryAllotments.productId, productIds),
              ),
            )
        : Promise.resolve([]),
      query.channelId && slotIds.length
        ? db
            .select()
            .from(channelInventoryAllotmentTargets)
            .where(
              and(
                inArray(channelInventoryAllotmentTargets.slotId, slotIds),
                eq(channelInventoryAllotmentTargets.active, true),
              ),
            )
        : Promise.resolve([]),
      query.channelId ? db.select().from(channelInventoryReleaseRules) : Promise.resolve([]),
      query.currencyCode
        ? db
            .select({
              rateDecimal: exchangeRates.rateDecimal,
              baseCurrency: exchangeRates.baseCurrency,
              quoteCurrency: exchangeRates.quoteCurrency,
              fxRateSetId: exchangeRates.fxRateSetId,
              effectiveAt: fxRateSets.effectiveAt,
            })
            .from(exchangeRates)
            .innerJoin(fxRateSets, eq(exchangeRates.fxRateSetId, fxRateSets.id))
            .where(eq(exchangeRates.quoteCurrency, query.currencyCode))
            .orderBy(desc(fxRateSets.effectiveAt))
        : Promise.resolve([]),
    ])

    const optionMap = new Map(optionRows.map((row) => [row.optionId, row]))
    const scheduleMap = new Map(optionScheduleRows.map((row) => [row.id, row]))
    const marketCatalogMap = new Map(marketCatalogRows.map((row) => [row.id, row]))
    const catalogMap = new Map(catalogRows.map((row) => [row.id, row]))
    const unitMap = new Map(unitRows.map((row) => [row.id, row]))
    const pricingCategoryMap = new Map(pricingCategoryRows.map((row) => [row.id, row]))

    const candidates = []

    for (const slot of slots) {
      if (!slot.optionId) continue
      const option = optionMap.get(slot.optionId)
      if (!option) continue

      if (option.optionAvailableFrom && slot.dateLocal < option.optionAvailableFrom) continue
      if (option.optionAvailableTo && slot.dateLocal > option.optionAvailableTo) continue
      if (slot.pastCutoff || slot.tooEarly) continue
      if (!slot.unlimited && (slot.remainingPax ?? 0) <= 0) continue

      const marketRule = query.marketId
        ? chooseBestSpecificRule(
            marketProductRuleRows.filter((row) => {
              if (row.productId !== option.productId) return false
              if (row.optionId && row.optionId !== option.optionId) return false
              if (query.dateLocal && row.availableFrom && query.dateLocal < row.availableFrom)
                return false
              if (query.dateLocal && row.availableTo && query.dateLocal > row.availableTo)
                return false
              return true
            }),
          )
        : null

      if (marketRule?.sellability === "unavailable") continue

      const channelRule =
        query.marketId && query.channelId
          ? [...marketChannelRuleRows]
              .sort((a, b) => b.priority - a.priority)
              .find((row) => row.sellability !== "unavailable")
          : null

      if (query.marketId && query.channelId && !channelRule && marketChannelRuleRows.length > 0) {
        continue
      }

      const catalogSelection =
        (channelRule?.priceCatalogId ? marketCatalogMap.get(channelRule.priceCatalogId) : null) ??
        (marketRule?.priceCatalogId ? marketCatalogMap.get(marketRule.priceCatalogId) : null) ??
        [...marketCatalogRows].sort((a, b) => {
          const scoreA = Number(a.isDefault) * 10 - a.priority
          const scoreB = Number(b.isDefault) * 10 - b.priority
          return scoreB - scoreA
        })[0] ??
        null

      const applicableRules = optionPriceRuleRows.filter((row) => {
        if (row.optionId !== option.optionId || row.productId !== option.productId) return false
        if (catalogSelection && row.priceCatalogId !== catalogSelection.priceCatalogId) return false
        const schedule = row.priceScheduleId ? scheduleMap.get(row.priceScheduleId) : null
        return scheduleMatches(
          {
            validFrom: schedule?.validFrom ?? null,
            validTo: schedule?.validTo ?? null,
            weekdays: (schedule?.weekdays as string[] | null | undefined) ?? null,
          },
          slot.dateLocal,
        )
      })

      const chosenRule = chooseBestScheduledRule(applicableRules)
      if (!chosenRule) continue

      const applicableStartRule = slot.startTimeId
        ? (startTimeRuleRows.find(
            (row) =>
              row.optionPriceRuleId === chosenRule.id && row.startTimeId === slot.startTimeId,
          ) ?? null)
        : null

      if (applicableStartRule?.ruleMode === "excluded") continue

      const ruleUnitRows = unitPriceRuleRows.filter(
        (row) => row.optionPriceRuleId === chosenRule.id,
      )
      const ruleTierRows = unitTierRows.filter((row) =>
        ruleUnitRows.some((unitRule) => unitRule.id === row.optionUnitPriceRuleId),
      )

      const requestedUnits = query.requestedUnits.length > 0 ? query.requestedUnits : []
      const breakdown: ResolvedPriceBreakdown[] = []
      const components: ResolvedPriceComponent[] = []
      let sellAmountCents = chosenRule.baseSellAmountCents ?? 0
      let costAmountCents = chosenRule.baseCostAmountCents ?? 0
      let onRequest = chosenRule.pricingMode === "on_request"

      if (
        (chosenRule.baseSellAmountCents ?? 0) !== 0 ||
        (chosenRule.baseCostAmountCents ?? 0) !== 0
      ) {
        components.push({
          kind: "base",
          title: option.optionName,
          quantity: 1,
          pricingMode: chosenRule.pricingMode,
          sellAmountCents: chosenRule.baseSellAmountCents ?? 0,
          costAmountCents: chosenRule.baseCostAmountCents ?? 0,
          unitId: null,
          unitName: null,
          unitType: null,
          pricingCategoryId: null,
          pricingCategoryName: null,
          requestRef: null,
          sourceRuleId: chosenRule.id,
          tierId: null,
        })
      }

      for (const request of requestedUnits) {
        const candidateUnitRules = ruleUnitRows.filter((row) => {
          if (request.unitId && row.unitId !== request.unitId) return false
          if (
            request.pricingCategoryId &&
            row.pricingCategoryId &&
            row.pricingCategoryId !== request.pricingCategoryId
          )
            return false
          if (row.minQuantity && request.quantity < row.minQuantity) return false
          if (row.maxQuantity && request.quantity > row.maxQuantity) return false
          return true
        })
        const unitRule =
          [...candidateUnitRules].sort((a, b) => {
            const scoreA =
              Number(Boolean(request.unitId && a.unitId === request.unitId)) * 10 +
              Number(
                Boolean(
                  request.pricingCategoryId && a.pricingCategoryId === request.pricingCategoryId,
                ),
              )
            const scoreB =
              Number(Boolean(request.unitId && b.unitId === request.unitId)) * 10 +
              Number(
                Boolean(
                  request.pricingCategoryId && b.pricingCategoryId === request.pricingCategoryId,
                ),
              )
            return scoreB - scoreA
          })[0] ?? null

        const tier = unitRule
          ? ([...ruleTierRows]
              .filter(
                (row) =>
                  row.optionUnitPriceRuleId === unitRule.id &&
                  row.active &&
                  request.quantity >= row.minQuantity &&
                  (row.maxQuantity === null || request.quantity <= row.maxQuantity),
              )
              .sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null)
          : null

        if (unitRule?.pricingMode === "on_request") onRequest = true
        const item = computeUnitAmounts(
          request,
          {
            unitName: request.unitId ? (unitMap.get(request.unitId)?.name ?? null) : null,
            unitType: request.unitId ? (unitMap.get(request.unitId)?.unitType ?? null) : null,
            pricingCategoryName: request.pricingCategoryId
              ? (pricingCategoryMap.get(request.pricingCategoryId)?.name ?? null)
              : null,
          },
          unitRule,
          tier,
        )
        breakdown.push(item)
        components.push({
          kind: "unit",
          title:
            [option.optionName, item.unitName, item.pricingCategoryName]
              .filter(Boolean)
              .join(" · ") || option.optionName,
          quantity: item.quantity,
          pricingMode: item.pricingMode,
          sellAmountCents: item.sellAmountCents,
          costAmountCents: item.costAmountCents,
          unitId: item.unitId,
          unitName: item.unitName,
          unitType: item.unitType,
          pricingCategoryId: item.pricingCategoryId,
          pricingCategoryName: item.pricingCategoryName,
          requestRef: item.requestRef,
          sourceRuleId: item.sourceRuleId,
          tierId: item.tierId,
        })
        sellAmountCents += item.sellAmountCents
        costAmountCents += item.costAmountCents
      }

      if (query.pickupPointId) {
        const pickupRule =
          pickupRuleRows.find(
            (row) =>
              row.optionPriceRuleId === chosenRule.id && row.pickupPointId === query.pickupPointId,
          ) ?? null
        if (pickupRule) {
          const quantity = Math.max(
            1,
            query.requestedUnits.reduce((sum, unit) => sum + unit.quantity, 0),
          )
          const pickupSellAmountCents =
            pickupRule.pricingMode === "per_person"
              ? (pickupRule.sellAmountCents ?? 0) * quantity
              : (pickupRule.sellAmountCents ?? 0)
          const pickupCostAmountCents =
            pickupRule.pricingMode === "per_person"
              ? (pickupRule.costAmountCents ?? 0) * quantity
              : (pickupRule.costAmountCents ?? 0)
          if (pickupRule.pricingMode === "on_request") onRequest = true
          components.push({
            kind: "pickup",
            title: "Pickup",
            quantity: pickupRule.pricingMode === "per_person" ? quantity : 1,
            pricingMode: pickupRule.pricingMode,
            sellAmountCents: pickupSellAmountCents,
            costAmountCents: pickupCostAmountCents,
            unitId: null,
            unitName: null,
            unitType: null,
            pricingCategoryId: null,
            pricingCategoryName: null,
            requestRef: null,
            sourceRuleId: pickupRule.id,
            tierId: null,
          })
          if (pickupRule.pricingMode === "per_booking") {
            sellAmountCents += pickupRule.sellAmountCents ?? 0
            costAmountCents += pickupRule.costAmountCents ?? 0
          } else if (pickupRule.pricingMode === "per_person") {
            sellAmountCents += (pickupRule.sellAmountCents ?? 0) * quantity
            costAmountCents += (pickupRule.costAmountCents ?? 0) * quantity
          }
        }
      }

      const preAdjustmentTotal = { sellAmountCents, costAmountCents }
      const adjusted = applicableStartRule
        ? applyAdjustment(preAdjustmentTotal, {
            adjustmentType: applicableStartRule.adjustmentType,
            sellAdjustmentCents: applicableStartRule.sellAdjustmentCents,
            costAdjustmentCents: applicableStartRule.costAdjustmentCents,
            adjustmentBasisPoints: applicableStartRule.adjustmentBasisPoints,
          })
        : { sellAmountCents, costAmountCents }

      sellAmountCents = adjusted.sellAmountCents
      costAmountCents = adjusted.costAmountCents

      const startTimeAdjustmentSellAmountCents =
        adjusted.sellAmountCents - preAdjustmentTotal.sellAmountCents
      const startTimeAdjustmentCostAmountCents =
        adjusted.costAmountCents - preAdjustmentTotal.costAmountCents

      if (
        applicableStartRule &&
        (startTimeAdjustmentSellAmountCents !== 0 || startTimeAdjustmentCostAmountCents !== 0)
      ) {
        components.push({
          kind: "start_time_adjustment",
          title: "Start time adjustment",
          quantity: 1,
          pricingMode: applicableStartRule.adjustmentType ?? "fixed",
          sellAmountCents: startTimeAdjustmentSellAmountCents,
          costAmountCents: startTimeAdjustmentCostAmountCents,
          unitId: null,
          unitName: null,
          unitType: null,
          pricingCategoryId: null,
          pricingCategoryName: null,
          requestRef: null,
          sourceRuleId: applicableStartRule.id,
          tierId: null,
        })
      }

      const relevantAllotments = allotmentRows.filter((row) => {
        if (row.productId !== option.productId) return false
        if (row.optionId && row.optionId !== option.optionId) return false
        if (row.startTimeId && row.startTimeId !== slot.startTimeId) return false
        if (slot.dateLocal && row.validFrom && slot.dateLocal < row.validFrom) return false
        if (slot.dateLocal && row.validTo && slot.dateLocal > row.validTo) return false
        return true
      })

      const relevantTargets = allotmentTargetRows.filter(
        (row) =>
          relevantAllotments.some((allotment) => allotment.id === row.allotmentId) &&
          (row.slotId === slot.id || (!row.slotId && row.startTimeId === slot.startTimeId)),
      )

      let allotmentStatus: "not_applicable" | "sellable" | "sold_out" = "not_applicable"
      let releaseRuleId: string | null = null
      if (relevantAllotments.length > 0) {
        const remaining = relevantTargets.reduce(
          (sum, row) => sum + Math.max(0, row.remainingCapacity ?? 0),
          0,
        )
        allotmentStatus = remaining > 0 ? "sellable" : "sold_out"
        const firstReleaseRule = releaseRuleRows.find((row) =>
          relevantAllotments.some((allotment) => allotment.id === row.allotmentId),
        )
        releaseRuleId = firstReleaseRule?.id ?? null
        if (allotmentStatus === "sold_out") continue
      }

      let displayCurrency =
        (catalogSelection ? catalogMap.get(catalogSelection.priceCatalogId)?.currencyCode : null) ??
        option.productSellCurrency

      let convertedSellAmountCents = sellAmountCents
      let convertedCostAmountCents = costAmountCents
      let fx = null as {
        fxRateSetId: string
        baseCurrency: string
        quoteCurrency: string
        rateDecimal: number
      } | null

      if (query.currencyCode && query.currencyCode !== displayCurrency) {
        const fxRate = exchangeRateRow.find(
          (row) => row.baseCurrency === displayCurrency && row.quoteCurrency === query.currencyCode,
        )
        if (fxRate) {
          const rate = toNumeric(fxRate.rateDecimal) ?? 1
          convertedSellAmountCents = Math.round(sellAmountCents * rate)
          convertedCostAmountCents = Math.round(costAmountCents * rate)
          fx = {
            fxRateSetId: fxRate.fxRateSetId,
            baseCurrency: displayCurrency,
            quoteCurrency: query.currencyCode,
            rateDecimal: rate,
          }
          displayCurrency = query.currencyCode
        }
      }

      candidates.push({
        product: {
          id: option.productId,
          name: option.productName,
        },
        option: {
          id: option.optionId,
          name: option.optionName,
          code: option.optionCode,
        },
        slot,
        market: marketRow
          ? {
              id: marketRow.id,
              code: marketRow.code,
              name: marketRow.name,
            }
          : null,
        channel: channelRow,
        sellability: {
          mode: marketRule?.sellability ?? channelRule?.sellability ?? "sellable",
          onRequest,
          allotmentStatus,
        },
        pricing: {
          currencyCode: displayCurrency,
          sellAmountCents: convertedSellAmountCents,
          costAmountCents: convertedCostAmountCents,
          marginAmountCents: convertedSellAmountCents - convertedCostAmountCents,
          breakdown,
          components,
          fx,
        },
        sources: {
          marketProductRuleId: marketRule?.id ?? null,
          marketChannelRuleId: channelRule?.id ?? null,
          marketPriceCatalogId: catalogSelection?.id ?? null,
          optionPriceRuleId: chosenRule.id,
          optionStartTimeRuleId: applicableStartRule?.id ?? null,
          channelInventoryAllotmentIds: relevantAllotments.map((row) => row.id),
          channelInventoryReleaseRuleId: releaseRuleId,
        },
      })
    }

    return {
      data: candidates,
      meta: {
        total: candidates.length,
      },
    }
  },
}
