import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import type { Hono } from "hono"
import { z } from "zod"

import { parseUnifiedKey } from "./lib/key.js"
import {
  createBookingPayloadSchema,
  createPartyBookingPayloadSchema,
  passengerCompositionMatches,
  passengerCountFromComposition,
  quotePayloadSchema,
  sourceRefFromPayload,
  sourceRefMatches,
} from "./routes-booking-payloads.js"
import type { CruiseRoutesEnv as Env } from "./routes-env.js"
import { adapterNotRegistered, invalidKey, resolveExternal } from "./routes-keying.js"
import { cruisesService } from "./service.js"
import { cruisesBookingService } from "./service-bookings.js"
import { pricingService } from "./service-pricing.js"
import {
  insertSailingSchema,
  sailingListQuerySchema,
  updateSailingSchema,
} from "./validation-core.js"
import { replaceSailingDaysSchema } from "./validation-itinerary.js"
import {
  insertPriceComponentSchema,
  insertPriceSchema,
  priceListQuerySchema,
  updatePriceSchema,
} from "./validation-pricing.js"

export function registerCruiseSailingAndPriceRoutes(app: Hono<Env>) {
  app
    // --- sailings ---
    .get("/sailings", async (c) => {
      const query = parseQuery(c, sailingListQuerySchema)
      const result = await cruisesService.listSailings(c.get("db"), query)
      return c.json(result)
    })
    .get("/sailings/:key", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
      if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
      if (parsed.kind === "external") {
        const ext = resolveExternal(parsed)
        if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
        const sailing = await ext.adapter.fetchSailing(ext.sourceRef)
        if (!sailing) return c.json({ error: "not_found" }, 404)
        const includeRaw = c.req.query("include") ?? ""
        const includes = new Set(
          includeRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        )
        const enriched: Record<string, unknown> = {
          source: "external",
          sourceProvider: ext.adapter.name,
          sourceRef: sailing.sourceRef,
          sailing,
        }
        if (includes.has("pricing")) {
          enriched.pricing = await ext.adapter.fetchSailingPricing(ext.sourceRef)
        }
        if (includes.has("itinerary")) {
          enriched.itinerary = await ext.adapter.fetchSailingItinerary(ext.sourceRef)
        }
        return c.json({ data: enriched })
      }
      const includeRaw = c.req.query("include") ?? ""
      const includes = new Set(
        includeRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      )
      const row = await cruisesService.getSailingById(c.get("db"), parsed.id, {
        withPricing: includes.has("pricing"),
        withItinerary: includes.has("itinerary"),
      })
      if (!row) return c.json({ error: "not_found" }, 404)
      return c.json({ data: row })
    })
    .post("/sailings", async (c) => {
      const data = await parseJsonBody(c, insertSailingSchema)
      const row = await cruisesService.upsertSailing(c.get("db"), data)
      return c.json({ data: row }, 201)
    })
    .put("/sailings/:key", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
      if (parsed.kind === "external") return c.json({ error: "external_cruise_read_only" }, 409)
      if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
      const data = await parseJsonBody(c, updateSailingSchema)
      const row = await cruisesService.updateSailing(c.get("db"), parsed.id, data)
      if (!row) return c.json({ error: "not_found" }, 404)
      return c.json({ data: row })
    })
    .get("/sailings/:key/itinerary", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
      if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
      if (parsed.kind === "external") {
        const ext = resolveExternal(parsed)
        if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
        const days = await ext.adapter.fetchSailingItinerary(ext.sourceRef)
        return c.json({ data: days })
      }
      const days = await cruisesService.getEffectiveItinerary(c.get("db"), parsed.id)
      return c.json({ data: days })
    })
    .put("/sailings/:key/days/bulk", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
      if (parsed.kind === "external") return c.json({ error: "external_cruise_read_only" }, 409)
      if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
      const payload = await parseJsonBody(c, replaceSailingDaysSchema.omit({ sailingId: true }))
      const days = await cruisesService.replaceSailingDays(c.get("db"), {
        sailingId: parsed.id,
        days: payload.days,
      })
      return c.json({ data: days })
    })
    .get("/sailings/:key/pricing", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
      if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
      if (parsed.kind === "external") {
        const ext = resolveExternal(parsed)
        if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
        const prices = await ext.adapter.fetchSailingPricing(ext.sourceRef)
        return c.json({ data: prices })
      }
      const result = await cruisesService.listPrices(c.get("db"), {
        sailingId: parsed.id,
        limit: 100,
        offset: 0,
      })
      return c.json(result)
    })
    .put("/sailings/:key/pricing/bulk", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
      if (parsed.kind === "external") return c.json({ error: "external_cruise_read_only" }, 409)
      if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
      const payload = await parseJsonBody(
        c,
        z.object({
          prices: z.array(
            insertPriceSchema.extend({
              components: z.array(insertPriceComponentSchema.omit({ priceId: true })).optional(),
            }),
          ),
        }),
      )
      const data = await cruisesService.replaceSailingPricing(c.get("db"), parsed.id, payload)
      return c.json({ data })
    })
    .post("/sailings/:key/quote", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
      if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
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
      if (parsed.kind === "external") {
        const ext = resolveExternal(parsed)
        if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
        // Fetch upstream pricing then compose locally — the cabinCategoryId in
        // the payload is interpreted as the upstream cabin category externalId.
        const prices = await ext.adapter.fetchSailingPricing(ext.sourceRef)
        const cabinCategoryRef = sourceRefFromPayload(
          payload.cabinCategoryRef,
          payload.cabinCategoryId,
        )
        const matching = prices.find(
          (p) =>
            sourceRefMatches(p.cabinCategoryRef, cabinCategoryRef) &&
            p.occupancy === payload.occupancy &&
            passengerCompositionMatches(p.passengerComposition, payload.passengerComposition) &&
            (!payload.fareCode || p.fareCode === payload.fareCode) &&
            (!payload.fareVariant || p.fareVariant === payload.fareVariant),
        )
        if (!matching) return c.json({ error: "no_matching_price" }, 404)
        const { composeQuote } = await import("./service-pricing.js")
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
          bookingTerms: matching.bookingTerms ?? null,
        })
        return c.json({ data: quote })
      }
      const quote = await pricingService.assembleQuote(c.get("db"), {
        sailingId: parsed.id,
        cabinCategoryId: payload.cabinCategoryId,
        occupancy: payload.occupancy,
        guestCount,
        fareCode: payload.fareCode ?? null,
        fareVariant: payload.fareVariant ?? null,
      })
      return c.json({ data: quote })
    })
    // --- bookings (single + party) ---
    .post("/sailings/:key/bookings", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
      if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
      if (parsed.kind === "external") {
        const ext = resolveExternal(parsed)
        if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
        const payload = await parseJsonBody(c, createBookingPayloadSchema)
        const result = await cruisesBookingService.createExternalCruiseBooking(
          c.get("db"),
          {
            adapter: ext.adapter,
            sailingRef: ext.sourceRef,
            cabinCategoryRef: sourceRefFromPayload(
              payload.cabinCategoryRef,
              payload.cabinCategoryId,
            ),
            cabinId: payload.cabinId ?? null,
            occupancy: payload.occupancy,
            passengerComposition: payload.passengerComposition ?? null,
            fareCode: payload.fareCode ?? null,
            fareVariant: payload.fareVariant ?? null,
            mode: payload.mode,
            personId: payload.personId ?? null,
            organizationId: payload.organizationId ?? null,
            contact: payload.contact,
            passengers: payload.passengers,
            notes: payload.notes ?? null,
          },
          c.get("userId"),
        )
        return c.json({ data: result }, 201)
      }
      const payload = await parseJsonBody(c, createBookingPayloadSchema)
      if (payload.sailingId !== parsed.id) {
        return c.json(
          { error: "sailing_id_mismatch", detail: "URL key and payload sailingId must match" },
          400,
        )
      }
      const result = await cruisesBookingService.createCruiseBooking(
        c.get("db"),
        payload,
        c.get("userId"),
      )
      return c.json({ data: result }, 201)
    })
    .post("/sailings/:key/party-bookings", async (c) => {
      const parsed = parseUnifiedKey(c.req.param("key"))
      if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
      if (parsed.kind === "external") {
        // External party bookings deferred — most cruise lines don't expose a
        // multi-cabin atomic upstream commit; we'd have to implement the group
        // semantics by serial bookings + rollback. Out of v1 scope.
        return c.json(
          {
            error: "external_party_booking_not_supported",
            detail:
              "Multi-cabin party bookings against external adapters are not yet supported. Submit each cabin individually via POST /sailings/:key/bookings.",
          },
          501,
        )
      }
      const payload = await parseJsonBody(c, createPartyBookingPayloadSchema)
      if (payload.sailingId !== parsed.id) {
        return c.json(
          { error: "sailing_id_mismatch", detail: "URL key and payload sailingId must match" },
          400,
        )
      }
      const result = await cruisesBookingService.createCruisePartyBooking(
        c.get("db"),
        payload,
        c.get("userId"),
      )
      return c.json({ data: result }, 201)
    })
    // --- prices (read endpoints; mutations go through bulk replace on the sailing) ---
    .get("/prices", async (c) => {
      const query = parseQuery(c, priceListQuerySchema)
      const result = await cruisesService.listPrices(c.get("db"), query)
      return c.json(result)
    })
    .post("/prices", async (c) => {
      const data = await parseJsonBody(c, insertPriceSchema)
      const row = await cruisesService.createPrice(c.get("db"), data)
      return c.json({ data: row }, 201)
    })
    .put("/prices/:priceId", async (c) => {
      const data = await parseJsonBody(c, updatePriceSchema)
      const row = await cruisesService.updatePrice(c.get("db"), c.req.param("priceId"), data)
      if (!row) return c.json({ error: "not_found" }, 404)
      return c.json({ data: row })
    })
}
