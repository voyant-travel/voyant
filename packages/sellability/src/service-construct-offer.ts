import { transactionsService } from "@voyantjs/transactions"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { resolve } from "./service-resolve.js"
import {
  buildDefaultOfferTitle,
  compactObject,
  defaultItemParticipantRole,
  formatSequenceNumber,
  isAssignableParticipantType,
  offerItemTypeForComponent,
  type ResolvedPriceComponent,
  type SellabilityResolveQuery,
} from "./service-shared.js"
import { persistResolvedSnapshot } from "./service-snapshots.js"
import type { SellabilityConstructOfferInput } from "./validation.js"

type SellabilityResolver = typeof resolve

export async function constructOffer(
  db: PostgresJsDatabase,
  input: SellabilityConstructOfferInput,
  resolver: SellabilityResolver = resolve,
) {
  const resolvedQuery: SellabilityResolveQuery = {
    ...input.query,
    limit: input.query.limit ?? 100,
  }
  const resolved = await resolver(db, resolvedQuery)
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

  const selectedCandidateIndex = resolved.data.findIndex((row) => row.slot.id === candidate.slot.id)
  const created = await transactionsService.createOfferBundle(db, {
    offer: {
      offerNumber: input.offer.offerNumber ?? formatSequenceNumber("OFF"),
      title: input.offer.title ?? buildDefaultOfferTitle(candidate),
      status: input.offer.status,
      personId: input.offer.personId ?? null,
      organizationId: input.offer.organizationId ?? null,
      quoteId: input.offer.quoteId ?? null,
      quoteVersionId: input.offer.quoteVersionId ?? null,
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
}
