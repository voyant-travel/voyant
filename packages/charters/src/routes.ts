// agent-quality: file-size exception -- owner: charters; existing route module stays co-located until a dedicated split preserves behavior and tests.
import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { z } from "zod"

import type { CharterAdapter, SourceRef } from "./adapters/index.js"
import { listCharterAdapters, resolveCharterAdapter } from "./adapters/registry.js"
import { type ParsedKey, parseUnifiedKey } from "./lib/key.js"
import { chartersService } from "./service.js"
import {
  type CreatePerSuiteBookingInput,
  type CreateWholeYachtBookingInput,
  chartersBookingService,
} from "./service-bookings.js"
import { type CharterContractsService, mybaService } from "./service-myba.js"
import { composePerSuiteQuote, composeWholeYachtQuote, pricingService } from "./service-pricing.js"
import {
  insertProductSchema,
  insertVoyageSchema,
  productListQuerySchema,
  updateProductSchema,
  updateVoyageSchema,
  voyageListQuerySchema,
} from "./validation-core.js"
import { replaceVoyageScheduleSchema } from "./validation-itinerary.js"
import { replaceVoyageSuitesSchema } from "./validation-pricing.js"
import { currencyCodeSchema } from "./validation-shared.js"
import { insertYachtSchema, updateYachtSchema, yachtListQuerySchema } from "./validation-yachts.js"

// ---------- Hono env ----------

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
    /**
     * Optional injection of `@voyantjs/legal`'s contractsService — set by
     * the template at app boot so MYBA generation routes can run without
     * charters taking a hard dep on legal. When unset, the
     * `/bookings/:bookingId/myba` endpoint returns 501.
     */
    chartersContractsService?: CharterContractsService
  }
}

// ---------- shared helpers ----------

const adapterNotRegistered = (provider: string) => ({
  error: "adapter_not_registered",
  detail: `No CharterAdapter registered for source provider '${provider}'. Register one at app startup via registerCharterAdapter().`,
})

const externalReadOnly = {
  error: "external_charter_read_only",
  detail:
    "External charter rows can't be edited locally. Edit at the upstream system or use a local TypeID for new content.",
}

const invalidKey = (raw: string) => ({ error: "invalid_key", detail: `Unrecognized key: ${raw}` })

function resolveExternal(parsed: Extract<ParsedKey, { kind: "external" }>): {
  adapter: CharterAdapter
  sourceRef: SourceRef
} | null {
  const adapter = resolveCharterAdapter(parsed.provider)
  if (!adapter) return null
  return { adapter, sourceRef: { externalId: parsed.ref } }
}

function makeExternalKey(adapter: CharterAdapter, ref: SourceRef): string {
  return `${adapter.name}:${ref.externalId}`
}

// ---------- payload schemas ----------

const guestSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  travelerCategory: z.enum(["adult", "child", "infant", "senior", "other"]).optional().nullable(),
  preferredLanguage: z.string().optional().nullable(),
  specialRequests: z.string().optional().nullable(),
  personId: z.string().optional().nullable(),
  isPrimary: z.boolean().optional(),
  notes: z.string().optional().nullable(),
})

const contactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  language: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
})

const createPerSuiteBookingPayload = z.object({
  voyageId: z.string(),
  suiteId: z.string(),
  currency: currencyCodeSchema,
  personId: z.string().optional().nullable(),
  organizationId: z.string().optional().nullable(),
  contact: contactSchema,
  guests: z.array(guestSchema).min(1),
  notes: z.string().optional().nullable(),
}) satisfies z.ZodType<CreatePerSuiteBookingInput>

const createWholeYachtBookingPayload = z.object({
  voyageId: z.string(),
  currency: currencyCodeSchema,
  personId: z.string().optional().nullable(),
  organizationId: z.string().optional().nullable(),
  contact: contactSchema,
  guests: z.array(guestSchema).optional(),
  notes: z.string().optional().nullable(),
}) satisfies z.ZodType<CreateWholeYachtBookingInput>

const generateMybaPayload = z.object({
  templateIdOverride: z.string().optional().nullable(),
  language: z.string().optional(),
  extraVariables: z.record(z.string(), z.unknown()).optional(),
  title: z.string().optional(),
})

const perSuiteQuotePayload = z.object({
  /** For local voyages, a `chst_…` TypeID. For external voyages, the upstream suite externalId. */
  suiteId: z.string(),
  currency: currencyCodeSchema,
})

const wholeYachtQuotePayload = z.object({
  currency: currencyCodeSchema,
})

// ---------- routes ----------

export const chartersAdminRoutes = new Hono<Env>()
  // --- products ---
  .get("/products", async (c) => {
    const query = parseQuery(c, productListQuerySchema)
    const local = await chartersService.listProducts(c.get("db"), query)
    const localItems = local.data.map((p) => ({
      source: "local" as const,
      sourceProvider: null,
      sourceRef: null,
      key: p.id,
      product: p,
    }))
    // Fan out to every registered adapter in parallel via Promise.allSettled —
    // one slow or failing adapter doesn't block the rest.
    const adapters = listCharterAdapters()
    const settled = await Promise.allSettled(
      adapters.map((adapter) =>
        adapter
          .listEntries({ limit: query.limit })
          .then((result) => ({ adapter, result }) as const),
      ),
    )
    const adapterItems: Array<{
      source: "external"
      sourceProvider: string
      sourceRef: SourceRef
      key: string
      product: unknown
    }> = []
    const adapterErrors: Array<{ adapter: string; error: string }> = []
    for (let i = 0; i < settled.length; i++) {
      const outcome = settled[i]
      const adapter = adapters[i]
      if (!outcome || !adapter) continue
      if (outcome.status === "rejected") {
        adapterErrors.push({
          adapter: adapter.name,
          error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
        })
        continue
      }
      for (const entry of outcome.value.result.entries) {
        adapterItems.push({
          source: "external",
          sourceProvider: adapter.name,
          sourceRef: entry.sourceRef,
          key: makeExternalKey(adapter, entry.sourceRef),
          product: entry,
        })
      }
    }
    return c.json({
      data: [...localItems, ...adapterItems],
      total: local.total + adapterItems.length,
      localTotal: local.total,
      adapterCount: adapters.length,
      adapterErrors,
      limit: local.limit,
      offset: local.offset,
    })
  })
  .post("/products", async (c) => {
    const data = await parseJsonBody(c, insertProductSchema)
    const row = await chartersService.createProduct(c.get("db"), data)
    return c.json({ data: row }, 201)
  })
  .get("/products/:key", async (c) => {
    const parsed = parseUnifiedKey(c.req.param("key"))
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    if (parsed.kind === "external") {
      const ext = resolveExternal(parsed)
      if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
      const product = await ext.adapter.fetchProduct(ext.sourceRef)
      if (!product) return c.json({ error: "not_found" }, 404)
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
        sourceRef: product.sourceRef,
        product,
      }
      if (includes.has("voyages")) {
        enriched.voyages = await ext.adapter.listVoyagesForProduct(ext.sourceRef)
      }
      if (includes.has("yacht") && product.defaultYachtRef) {
        enriched.yacht = await ext.adapter.fetchYacht(product.defaultYachtRef)
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
    const row = await chartersService.getProductById(c.get("db"), parsed.id, {
      withVoyages: includes.has("voyages"),
      withYacht: includes.has("yacht"),
    })
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row })
  })
  .put("/products/:key", async (c) => {
    const parsed = parseUnifiedKey(c.req.param("key"))
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    if (parsed.kind === "external") return c.json(externalReadOnly, 409)
    const data = await parseJsonBody(c, updateProductSchema)
    const row = await chartersService.updateProduct(c.get("db"), parsed.id, data)
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row })
  })
  .delete("/products/:key", async (c) => {
    const parsed = parseUnifiedKey(c.req.param("key"))
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    if (parsed.kind === "external") return c.json(externalReadOnly, 409)
    const row = await chartersService.archiveProduct(c.get("db"), parsed.id)
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row })
  })
  .post("/products/:key/aggregates/recompute", async (c) => {
    const parsed = parseUnifiedKey(c.req.param("key"))
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    if (parsed.kind === "external") return c.json(externalReadOnly, 409)
    const row = await chartersService.recomputeProductAggregates(c.get("db"), parsed.id)
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row })
  })
  .get("/products/:key/voyages", async (c) => {
    const parsed = parseUnifiedKey(c.req.param("key"))
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    if (parsed.kind === "external") {
      const ext = resolveExternal(parsed)
      if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
      const voyages = await ext.adapter.listVoyagesForProduct(ext.sourceRef)
      return c.json({
        data: voyages.map((v) => ({
          source: "external" as const,
          sourceProvider: ext.adapter.name,
          key: makeExternalKey(ext.adapter, v.sourceRef),
          voyage: v,
        })),
        total: voyages.length,
      })
    }
    const result = await chartersService.listVoyages(c.get("db"), {
      productId: parsed.id,
      limit: 100,
      offset: 0,
    })
    return c.json(result)
  })
  // --- voyages ---
  .get("/voyages", async (c) => {
    const query = parseQuery(c, voyageListQuerySchema)
    const result = await chartersService.listVoyages(c.get("db"), query)
    return c.json(result)
  })
  .post("/voyages", async (c) => {
    const data = await parseJsonBody(c, insertVoyageSchema)
    const row = await chartersService.upsertVoyage(c.get("db"), data)
    return c.json({ data: row }, 201)
  })
  .get("/voyages/:key", async (c) => {
    const parsed = parseUnifiedKey(c.req.param("key"))
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    if (parsed.kind === "external") {
      const ext = resolveExternal(parsed)
      if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
      const voyage = await ext.adapter.fetchVoyage(ext.sourceRef)
      if (!voyage) return c.json({ error: "not_found" }, 404)
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
        sourceRef: voyage.sourceRef,
        voyage,
      }
      if (includes.has("suites")) {
        enriched.suites = await ext.adapter.fetchVoyageSuites(ext.sourceRef)
      }
      if (includes.has("schedule")) {
        enriched.schedule = await ext.adapter.fetchVoyageSchedule(ext.sourceRef)
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
    const row = await chartersService.getVoyageById(c.get("db"), parsed.id, {
      withSuites: includes.has("suites"),
      withSchedule: includes.has("schedule"),
    })
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row })
  })
  .put("/voyages/:key", async (c) => {
    const parsed = parseUnifiedKey(c.req.param("key"))
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    if (parsed.kind === "external") return c.json(externalReadOnly, 409)
    const data = await parseJsonBody(c, updateVoyageSchema)
    const row = await chartersService.updateVoyage(c.get("db"), parsed.id, data)
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row })
  })
  .put("/voyages/:key/suites/bulk", async (c) => {
    const parsed = parseUnifiedKey(c.req.param("key"))
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    if (parsed.kind === "external") return c.json(externalReadOnly, 409)
    const payload = await parseJsonBody(c, replaceVoyageSuitesSchema.omit({ voyageId: true }))
    const rows = await chartersService.replaceVoyageSuites(c.get("db"), {
      voyageId: parsed.id,
      suites: payload.suites,
    })
    return c.json({ data: rows })
  })
  .put("/voyages/:key/schedule/bulk", async (c) => {
    const parsed = parseUnifiedKey(c.req.param("key"))
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    if (parsed.kind === "external") return c.json(externalReadOnly, 409)
    const payload = await parseJsonBody(c, replaceVoyageScheduleSchema.omit({ voyageId: true }))
    const rows = await chartersService.replaceVoyageSchedule(c.get("db"), {
      voyageId: parsed.id,
      days: payload.days,
    })
    return c.json({ data: rows })
  })
  // --- per-suite quote + bookings ---
  .post("/voyages/:key/quote/per-suite", async (c) => {
    const parsed = parseUnifiedKey(c.req.param("key"))
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    const payload = await parseJsonBody(c, perSuiteQuotePayload)
    if (parsed.kind === "external") {
      const ext = resolveExternal(parsed)
      if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
      const suites = await ext.adapter.fetchVoyageSuites(ext.sourceRef)
      const matching = suites.find((s) => s.sourceRef.externalId === payload.suiteId)
      if (!matching) return c.json({ error: "no_matching_suite" }, 404)
      const quote = composePerSuiteQuote({
        voyageId: ext.sourceRef.externalId,
        suite: {
          id: matching.sourceRef.externalId,
          suiteName: matching.suiteName,
          pricesByCurrency: matching.pricesByCurrency ?? {},
          portFeesByCurrency: matching.portFeesByCurrency ?? {},
        },
        currency: payload.currency,
      })
      return c.json({ data: quote })
    }
    const quote = await pricingService.quotePerSuite(c.get("db"), {
      suiteId: payload.suiteId,
      currency: payload.currency,
    })
    return c.json({ data: quote })
  })
  .post("/voyages/:key/bookings/per-suite", async (c) => {
    const parsed = parseUnifiedKey(c.req.param("key"))
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    if (parsed.kind === "external") {
      const ext = resolveExternal(parsed)
      if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
      const payload = await parseJsonBody(c, createPerSuiteBookingPayload)
      const result = await chartersBookingService.createExternalPerSuiteBooking(
        c.get("db"),
        {
          adapter: ext.adapter,
          voyageRef: ext.sourceRef,
          suiteRef: { externalId: payload.suiteId },
          currency: payload.currency,
          personId: payload.personId ?? null,
          organizationId: payload.organizationId ?? null,
          contact: payload.contact,
          guests: payload.guests,
          notes: payload.notes ?? null,
        },
        c.get("userId"),
      )
      return c.json({ data: result }, 201)
    }
    const payload = await parseJsonBody(c, createPerSuiteBookingPayload)
    if (payload.voyageId !== parsed.id) {
      return c.json(
        { error: "voyage_id_mismatch", detail: "URL key and payload voyageId must match" },
        400,
      )
    }
    const result = await chartersBookingService.createPerSuiteBooking(
      c.get("db"),
      payload,
      c.get("userId"),
    )
    return c.json({ data: result }, 201)
  })
  // --- whole-yacht quote + bookings ---
  .post("/voyages/:key/quote/whole-yacht", async (c) => {
    const parsed = parseUnifiedKey(c.req.param("key"))
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    const payload = await parseJsonBody(c, wholeYachtQuotePayload)
    if (parsed.kind === "external") {
      const ext = resolveExternal(parsed)
      if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
      const voyage = await ext.adapter.fetchVoyage(ext.sourceRef)
      if (!voyage) return c.json({ error: "not_found" }, 404)
      const product = await ext.adapter.fetchProduct(voyage.productRef)
      const quote = composeWholeYachtQuote({
        voyage: {
          id: voyage.sourceRef.externalId,
          wholeYachtPricesByCurrency: voyage.wholeYachtPricesByCurrency ?? {},
          apaPercentOverride: voyage.apaPercentOverride ?? null,
        },
        productDefaultApaPercent: product?.defaultApaPercent ?? null,
        currency: payload.currency,
      })
      return c.json({ data: quote })
    }
    const quote = await pricingService.quoteWholeYacht(c.get("db"), {
      voyageId: parsed.id,
      currency: payload.currency,
    })
    return c.json({ data: quote })
  })
  .post("/voyages/:key/bookings/whole-yacht", async (c) => {
    const parsed = parseUnifiedKey(c.req.param("key"))
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    if (parsed.kind === "external") {
      const ext = resolveExternal(parsed)
      if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
      const payload = await parseJsonBody(c, createWholeYachtBookingPayload)
      const result = await chartersBookingService.createExternalWholeYachtBooking(
        c.get("db"),
        {
          adapter: ext.adapter,
          voyageRef: ext.sourceRef,
          currency: payload.currency,
          personId: payload.personId ?? null,
          organizationId: payload.organizationId ?? null,
          contact: payload.contact,
          guests: payload.guests,
          notes: payload.notes ?? null,
        },
        c.get("userId"),
      )
      return c.json({ data: result }, 201)
    }
    const payload = await parseJsonBody(c, createWholeYachtBookingPayload)
    if (payload.voyageId !== parsed.id) {
      return c.json(
        { error: "voyage_id_mismatch", detail: "URL key and payload voyageId must match" },
        400,
      )
    }
    const result = await chartersBookingService.createWholeYachtBooking(
      c.get("db"),
      payload,
      c.get("userId"),
    )
    return c.json({ data: result }, 201)
  })
  .post("/bookings/:bookingId/myba", async (c) => {
    const contractsService = c.get("chartersContractsService")
    if (!contractsService) {
      return c.json(
        {
          error: "contracts_service_unavailable",
          detail:
            "MYBA generation requires the legal/contracts service to be wired into Hono context as `chartersContractsService` at app boot.",
        },
        501,
      )
    }
    const payload = await parseJsonBody(c, generateMybaPayload)
    const result = await mybaService.generateContract(c.get("db"), contractsService, {
      bookingId: c.req.param("bookingId"),
      templateIdOverride: payload.templateIdOverride ?? null,
      language: payload.language,
      extraVariables: payload.extraVariables,
      title: payload.title,
    })
    if (result.status === "not_found") return c.json({ error: result.status }, 404)
    if (result.status === "wrong_mode") return c.json({ error: result.status, ...result }, 409)
    if (result.status === "no_template") return c.json({ error: result.status }, 412)
    if (result.status === "template_not_found")
      return c.json({ error: result.status, ...result }, 404)
    if (result.status === "contract_create_failed") return c.json({ error: result.status }, 500)
    return c.json({
      data: { contractId: result.contractId, charterDetails: result.detail },
    })
  })
  // --- yachts ---
  .get("/yachts", async (c) => {
    const query = parseQuery(c, yachtListQuerySchema)
    const result = await chartersService.listYachts(c.get("db"), query)
    return c.json(result)
  })
  .post("/yachts", async (c) => {
    const data = await parseJsonBody(c, insertYachtSchema)
    const row = await chartersService.createYacht(c.get("db"), data)
    return c.json({ data: row }, 201)
  })
  .get("/yachts/:key", async (c) => {
    const parsed = parseUnifiedKey(c.req.param("key"))
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    if (parsed.kind === "external") {
      const ext = resolveExternal(parsed)
      if (!ext) return c.json(adapterNotRegistered(parsed.provider), 501)
      const yacht = await ext.adapter.fetchYacht(ext.sourceRef)
      if (!yacht) return c.json({ error: "not_found" }, 404)
      return c.json({
        data: {
          source: "external",
          sourceProvider: ext.adapter.name,
          sourceRef: yacht.sourceRef,
          yacht,
        },
      })
    }
    const row = await chartersService.getYachtById(c.get("db"), parsed.id)
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row })
  })
  .put("/yachts/:key", async (c) => {
    const parsed = parseUnifiedKey(c.req.param("key"))
    if (parsed.kind === "invalid") return c.json(invalidKey(parsed.raw), 400)
    if (parsed.kind === "external") return c.json(externalReadOnly, 409)
    const data = await parseJsonBody(c, updateYachtSchema)
    const row = await chartersService.updateYacht(c.get("db"), parsed.id, data)
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row })
  })

export type ChartersAdminRoutes = typeof chartersAdminRoutes
