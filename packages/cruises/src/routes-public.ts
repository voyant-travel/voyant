import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { z } from "zod"

import type { ExternalPassengerComposition, SourceRef } from "./adapters/index.js"
import { resolveCruiseAdapter } from "./adapters/registry.js"
import { encodeSourceRef, parseUnifiedKey, sourceRefFromExternalKeyRef } from "./lib/key.js"
import { cruisesService } from "./service.js"
import { composeQuote, pricingService } from "./service-pricing.js"
import { cruisesSearchService } from "./service-search.js"
import { searchIndexQuerySchema } from "./validation-search.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
  }
}

const TYPEID_RE = /^[a-z]+_[0-9a-zA-Z]+$/

function isTypeId(s: string): boolean {
  return TYPEID_RE.test(s)
}

const quotePayloadSchema = z.object({
  cabinCategoryId: z.string(),
  cabinCategoryRef: z.record(z.string(), z.unknown()).optional().nullable(),
  occupancy: z.number().int().min(1).max(8),
  guestCount: z.number().int().min(1).max(8).optional(),
  passengerComposition: passengerCompositionSchema().optional().nullable(),
  fareCode: z.string().optional().nullable(),
  fareVariant: z.enum(["cruise_only", "air_inclusive"]).optional().nullable(),
  bookingTerms: z.record(z.string(), z.unknown()).optional().nullable(),
})

function passengerCompositionSchema() {
  return z
    .object({
      adults: z.number().int().min(0),
      children: z.number().int().min(0).optional(),
      childAges: z.array(z.number().int().min(0).max(17)).optional(),
      infants: z.number().int().min(0).optional(),
      seniors: z.number().int().min(0).optional(),
    })
    .catchall(z.unknown())
    .refine(
      (value) =>
        value.adults + (value.children ?? 0) + (value.infants ?? 0) + (value.seniors ?? 0) > 0,
      "passengerComposition must include at least one passenger",
    )
}

function passengerCountFromComposition(
  composition: ExternalPassengerComposition | null | undefined,
): number | null {
  if (!composition) return null
  return (
    composition.adults +
    (composition.children ?? 0) +
    (composition.infants ?? 0) +
    (composition.seniors ?? 0)
  )
}

function resolveExternalKey(key: string): { provider: string; sourceRef: SourceRef } | null {
  const parsed = parseUnifiedKey(key)
  if (parsed.kind !== "external") return null
  return { provider: parsed.provider, sourceRef: sourceRefFromExternalKeyRef(parsed.ref) }
}

function sourceRefFromPayload(
  maybeRef: Record<string, unknown> | null | undefined,
  externalId: string,
): SourceRef {
  if (maybeRef && typeof maybeRef.externalId === "string") return maybeRef as SourceRef
  return { externalId }
}

function sourceRefMatches(candidate: SourceRef, requested: SourceRef): boolean {
  if (encodeSourceRef(candidate) === encodeSourceRef(requested)) return true
  const candidateIsLegacy = Object.keys(candidate).length === 1
  const requestedIsLegacy = Object.keys(requested).length === 1
  return (candidateIsLegacy || requestedIsLegacy) && candidate.externalId === requested.externalId
}

function passengerCompositionMatches(
  candidate: ExternalPassengerComposition | null | undefined,
  requested: ExternalPassengerComposition | null | undefined,
): boolean {
  if (!requested || !candidate) return true
  return (
    encodeSourceRef({
      externalId: "composition",
      ...candidate,
    }) === encodeSourceRef({ externalId: "composition", ...requested })
  )
}

/**
 * Public/storefront routes. Reads exclusively from `cruise_search_index` for
 * list and slug lookups; detail endpoints (sailing, ship, quote) resolve
 * through the appropriate source — local DB for source='local' rows, the
 * registered adapter for source='external'.
 *
 * Operators that don't run a Voyant-powered storefront leave the search index
 * empty; the list endpoint returns no rows but detail endpoints still work
 * for direct sailing/ship key lookups.
 */
export const cruisePublicRoutes = new Hono<Env>()
  .get("/", async (c) => {
    const query = parseQuery(c, searchIndexQuerySchema)
    const result = await cruisesSearchService.query(c.get("db"), query)
    return c.json(result)
  })
  .get("/:slug", async (c) => {
    const slug = c.req.param("slug")
    const indexEntry = await cruisesSearchService.getBySlug(c.get("db"), slug)
    if (!indexEntry) return c.json({ error: "not_found" }, 404)

    if (indexEntry.source === "local" && indexEntry.localCruiseId) {
      const detail = await cruisesService.getCruiseById(c.get("db"), indexEntry.localCruiseId, {
        withSailings: true,
        withDays: true,
      })
      if (!detail) return c.json({ error: "not_found" }, 404)
      return c.json({
        data: {
          source: "local" as const,
          sourceProvider: null,
          sourceRef: null,
          summary: indexEntry,
          cruise: detail,
        },
      })
    }

    if (indexEntry.source === "external" && indexEntry.sourceProvider && indexEntry.sourceRef) {
      const externalId = indexEntry.sourceRef.externalId
      if (typeof externalId !== "string" || externalId.length === 0) {
        return c.json({ error: "invalid_index_entry", detail: "sourceRef.externalId missing" }, 500)
      }
      const adapter = resolveCruiseAdapter(indexEntry.sourceProvider)
      if (!adapter) {
        return c.json(
          {
            error: "adapter_not_registered",
            detail: `Search-index entry references provider '${indexEntry.sourceProvider}' but no adapter is registered.`,
          },
          501,
        )
      }
      const adapterRef = { ...indexEntry.sourceRef, externalId }
      const cruise = await adapter.fetchCruise(adapterRef)
      if (!cruise) return c.json({ error: "not_found" }, 404)
      const sailings = await adapter.listSailingsForCruise(adapterRef)
      return c.json({
        data: {
          source: "external" as const,
          sourceProvider: adapter.name,
          sourceRef: adapterRef,
          summary: indexEntry,
          cruise,
          sailings,
        },
      })
    }

    return c.json({ error: "invalid_index_entry" }, 500)
  })
  .get("/sailings/:key", async (c) => {
    const key = c.req.param("key")
    if (isTypeId(key)) {
      const sailing = await cruisesService.getSailingById(c.get("db"), key, {
        withPricing: true,
        withItinerary: true,
      })
      if (!sailing) return c.json({ error: "not_found" }, 404)
      return c.json({ data: { source: "local", sailing } })
    }
    const parsed = resolveExternalKey(key)
    if (!parsed) return c.json({ error: "invalid_key" }, 400)
    const adapter = resolveCruiseAdapter(parsed.provider)
    if (!adapter) return c.json({ error: "adapter_not_registered" }, 501)
    const sailing = await adapter.fetchSailing(parsed.sourceRef)
    if (!sailing) return c.json({ error: "not_found" }, 404)
    const [pricing, itinerary] = await Promise.all([
      adapter.fetchSailingPricing(parsed.sourceRef),
      adapter.fetchSailingItinerary(parsed.sourceRef),
    ])
    return c.json({
      data: { source: "external", sourceProvider: adapter.name, sailing, pricing, itinerary },
    })
  })
  .post("/sailings/:key/quote", async (c) => {
    const key = c.req.param("key")
    const payload = await parseJsonBody(c, quotePayloadSchema)
    const guestCount =
      payload.guestCount ?? passengerCountFromComposition(payload.passengerComposition)
    if (!guestCount) {
      return c.json(
        {
          error: "guest_count_required",
          detail: "Provide guestCount or passengerComposition for cruise quote requests.",
        },
        400,
      )
    }

    if (isTypeId(key)) {
      const quote = await pricingService.assembleQuote(c.get("db"), {
        sailingId: key,
        cabinCategoryId: payload.cabinCategoryId,
        occupancy: payload.occupancy,
        guestCount,
        fareCode: payload.fareCode ?? null,
        fareVariant: payload.fareVariant ?? null,
      })
      return c.json({ data: quote })
    }

    const parsed = resolveExternalKey(key)
    if (!parsed) return c.json({ error: "invalid_key" }, 400)
    const adapter = resolveCruiseAdapter(parsed.provider)
    if (!adapter) return c.json({ error: "adapter_not_registered" }, 501)
    const prices = await adapter.fetchSailingPricing(parsed.sourceRef)
    const cabinCategoryRef = sourceRefFromPayload(payload.cabinCategoryRef, payload.cabinCategoryId)
    const matching = prices.find(
      (p) =>
        sourceRefMatches(p.cabinCategoryRef, cabinCategoryRef) &&
        p.occupancy === payload.occupancy &&
        passengerCompositionMatches(p.passengerComposition, payload.passengerComposition) &&
        (!payload.fareCode || p.fareCode === payload.fareCode) &&
        (!payload.fareVariant || p.fareVariant === payload.fareVariant),
    )
    if (!matching) return c.json({ error: "no_matching_price" }, 404)
    const quote = composeQuote({
      price: {
        pricePerPerson: matching.pricePerPerson,
        originalPricePerPerson: matching.originalPricePerPerson ?? null,
        secondGuestPricePerPerson: matching.secondGuestPricePerPerson ?? null,
        singlePricePerPerson: matching.singlePricePerPerson ?? null,
        singleSupplementPercent: matching.singleSupplementPercent ?? null,
        currency: matching.currency,
        fareCode: matching.fareCode ?? null,
        fareCodeName: matching.fareCodeName ?? null,
        fareVariant: matching.fareVariant ?? "cruise_only",
        earlyBookingDeadline: matching.earlyBookingDeadline ?? null,
        earlyBookingBonusDescription: matching.earlyBookingBonusDescription ?? null,
      },
      components: (matching.components ?? []).map((c) => ({
        kind: c.kind,
        label: c.label ?? null,
        amount: c.amount,
        currency: c.currency,
        direction: c.direction,
        perPerson: c.perPerson,
      })),
      occupancy: payload.occupancy,
      guestCount,
      bookingTerms: payload.bookingTerms ?? matching.bookingTerms ?? null,
    })
    return c.json({ data: quote })
  })
  .get("/ships/:key", async (c) => {
    const key = c.req.param("key")
    if (isTypeId(key)) {
      const ship = await cruisesService.getShipById(c.get("db"), key)
      if (!ship) return c.json({ error: "not_found" }, 404)
      const [decks, categories] = await Promise.all([
        cruisesService.listShipDecks(c.get("db"), key),
        cruisesService.listShipCabinCategories(c.get("db"), key),
      ])
      return c.json({ data: { ...ship, decks, categories } })
    }
    const parsed = resolveExternalKey(key)
    if (!parsed) return c.json({ error: "invalid_key" }, 400)
    const adapter = resolveCruiseAdapter(parsed.provider)
    if (!adapter) return c.json({ error: "adapter_not_registered" }, 501)
    const ship = await adapter.fetchShip(parsed.sourceRef)
    if (!ship) return c.json({ error: "not_found" }, 404)
    return c.json({ data: ship })
  })

export type CruisePublicRoutes = typeof cruisePublicRoutes
