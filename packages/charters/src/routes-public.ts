import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { z } from "zod"

import { listCharterAdapters, resolveCharterAdapter } from "./adapters/registry.js"
import { parseUnifiedKey } from "./lib/key.js"
import { chartersService } from "./service.js"
import { composePerSuiteQuote, composeWholeYachtQuote, pricingService } from "./service-pricing.js"
import { productListQuerySchema, voyageListQuerySchema } from "./validation-core.js"
import { currencyCodeSchema } from "./validation-shared.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
  }
}

const perSuiteQuotePayload = z.object({
  suiteId: z.string(),
  currency: currencyCodeSchema,
})
const wholeYachtQuotePayload = z.object({
  currency: currencyCodeSchema,
})

/**
 * Public-facing charter routes. Browsing fans out to local `live` products +
 * every registered adapter; detail routes accept either a TypeID slug or a
 * `<provider>:<ref>` external key.
 *
 * Charters has no dedicated search index — the operator universe is small
 * enough that direct `listEntries` fan-out is fine.
 */
export const chartersPublicRoutes = new Hono<Env>()
  .get("/", async (c) => {
    const query = parseQuery(c, productListQuerySchema)
    const local = await chartersService.listProducts(c.get("db"), { ...query, status: "live" })
    const localItems = local.data.map((p) => ({
      source: "local" as const,
      sourceProvider: null,
      sourceRef: null,
      key: p.slug,
      product: p,
    }))
    const adapters = listCharterAdapters()
    const settled = await Promise.allSettled(
      adapters.map((adapter) =>
        adapter
          .listEntries({ limit: query.limit })
          .then((result) => ({ adapter, result }) as const),
      ),
    )
    const adapterItems: Array<Record<string, unknown>> = []
    for (let i = 0; i < settled.length; i++) {
      const outcome = settled[i]
      const adapter = adapters[i]
      if (!outcome || !adapter) continue
      if (outcome.status === "rejected") continue
      for (const entry of outcome.value.result.entries) {
        adapterItems.push({
          source: "external" as const,
          sourceProvider: adapter.name,
          sourceRef: entry.sourceRef,
          key: `${adapter.name}:${entry.sourceRef.externalId}`,
          product: entry,
        })
      }
    }
    return c.json({
      data: [...localItems, ...adapterItems],
      total: local.total + adapterItems.length,
      limit: local.limit,
      offset: local.offset,
    })
  })
  .get("/products/:key", async (c) => {
    const parsed = parseUnifiedKey(c.req.param("key"))
    if (parsed.kind === "external") {
      const adapter = resolveCharterAdapter(parsed.provider)
      if (!adapter) return c.json({ error: "adapter_not_registered" }, 501)
      const product = await adapter.fetchProduct({ externalId: parsed.ref })
      if (!product) return c.json({ error: "not_found" }, 404)
      const voyages = await adapter.listVoyagesForProduct({ externalId: parsed.ref })
      const yacht = product.defaultYachtRef
        ? await adapter.fetchYacht(product.defaultYachtRef)
        : null
      return c.json({
        data: {
          source: "external",
          sourceProvider: adapter.name,
          sourceRef: product.sourceRef,
          product,
          voyages,
          yacht,
        },
      })
    }
    if (parsed.kind === "local") {
      const detail = await chartersService.getProductById(c.get("db"), parsed.id, {
        withVoyages: true,
        withYacht: true,
      })
      if (!detail || detail.status !== "live") return c.json({ error: "not_found" }, 404)
      return c.json({ data: detail })
    }
    // parsed.kind === "invalid": treat the raw param as a slug lookup
    const result = await chartersService.listProducts(c.get("db"), {
      status: "live",
      limit: 1,
      offset: 0,
    })
    const match = result.data.find((p) => p.slug === parsed.raw)
    if (!match) return c.json({ error: "not_found" }, 404)
    const detail = await chartersService.getProductById(c.get("db"), match.id, {
      withVoyages: true,
      withYacht: true,
    })
    if (!detail || detail.status !== "live") return c.json({ error: "not_found" }, 404)
    return c.json({ data: detail })
  })
  .get("/voyages", async (c) => {
    const query = parseQuery(c, voyageListQuerySchema)
    const result = await chartersService.listVoyages(c.get("db"), query)
    return c.json(result)
  })
  .get("/voyages/:key", async (c) => {
    const parsed = parseUnifiedKey(c.req.param("key"))
    if (parsed.kind === "invalid") return c.json({ error: "invalid_key" }, 400)
    if (parsed.kind === "external") {
      const adapter = resolveCharterAdapter(parsed.provider)
      if (!adapter) return c.json({ error: "adapter_not_registered" }, 501)
      const ref = { externalId: parsed.ref }
      const voyage = await adapter.fetchVoyage(ref)
      if (!voyage) return c.json({ error: "not_found" }, 404)
      const [suites, schedule] = await Promise.all([
        adapter.fetchVoyageSuites(ref),
        adapter.fetchVoyageSchedule(ref),
      ])
      return c.json({
        data: {
          source: "external",
          sourceProvider: adapter.name,
          sourceRef: voyage.sourceRef,
          voyage,
          suites,
          schedule,
        },
      })
    }
    const row = await chartersService.getVoyageById(c.get("db"), parsed.id, {
      withSuites: true,
      withSchedule: true,
    })
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row })
  })
  .post("/voyages/:key/quote/per-suite", async (c) => {
    const parsed = parseUnifiedKey(c.req.param("key"))
    if (parsed.kind === "invalid") return c.json({ error: "invalid_key" }, 400)
    const payload = await parseJsonBody(c, perSuiteQuotePayload)
    if (parsed.kind === "external") {
      const adapter = resolveCharterAdapter(parsed.provider)
      if (!adapter) return c.json({ error: "adapter_not_registered" }, 501)
      const suites = await adapter.fetchVoyageSuites({ externalId: parsed.ref })
      const matching = suites.find((s) => s.sourceRef.externalId === payload.suiteId)
      if (!matching) return c.json({ error: "no_matching_suite" }, 404)
      const quote = composePerSuiteQuote({
        voyageId: parsed.ref,
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
  .post("/voyages/:key/quote/whole-yacht", async (c) => {
    const parsed = parseUnifiedKey(c.req.param("key"))
    if (parsed.kind === "invalid") return c.json({ error: "invalid_key" }, 400)
    const payload = await parseJsonBody(c, wholeYachtQuotePayload)
    if (parsed.kind === "external") {
      const adapter = resolveCharterAdapter(parsed.provider)
      if (!adapter) return c.json({ error: "adapter_not_registered" }, 501)
      const ref = { externalId: parsed.ref }
      const voyage = await adapter.fetchVoyage(ref)
      if (!voyage) return c.json({ error: "not_found" }, 404)
      const product = await adapter.fetchProduct(voyage.productRef)
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
  .get("/yachts/:key", async (c) => {
    const parsed = parseUnifiedKey(c.req.param("key"))
    if (parsed.kind === "invalid") return c.json({ error: "invalid_key" }, 400)
    if (parsed.kind === "external") {
      const adapter = resolveCharterAdapter(parsed.provider)
      if (!adapter) return c.json({ error: "adapter_not_registered" }, 501)
      const yacht = await adapter.fetchYacht({ externalId: parsed.ref })
      if (!yacht) return c.json({ error: "not_found" }, 404)
      return c.json({ data: yacht })
    }
    const row = await chartersService.getYachtById(c.get("db"), parsed.id)
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row })
  })

export type ChartersPublicRoutes = typeof chartersPublicRoutes
