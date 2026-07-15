import { defineToolContextContribution, ToolError } from "@voyant-travel/tools"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

import type {
  CharterAdapter,
  ExternalCharterVoyage,
  ExternalCharterYacht,
  SourceRef,
} from "./adapters/index.js"
import { listCharterAdapters, resolveCharterAdapter } from "./adapters/registry.js"
import { parseUnifiedKey } from "./lib/key.js"
import { chartersService } from "./service.js"
import { chartersBookingService } from "./service-bookings.js"
import { composePerSuiteQuote, composeWholeYachtQuote, pricingService } from "./service-pricing.js"
import type { ChartersToolServices } from "./tools.js"

export * from "./tools.js"

type ChartersToolRequestEnv = { Variables: { userId?: string } }

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["charters"],
  contribute({ request, context }) {
    const db = context.db as PostgresJsDatabase
    const userId = (request as Context<ChartersToolRequestEnv>).get("userId")
    const publicOnly = context.actor !== "staff"
    const execute: ChartersToolServices["execute"] = async (operation, input) => {
      const args = input as Record<string, unknown>
      switch (operation) {
        case "browseCharters":
          return browseCharters(db, args, publicOnly)
        case "getProduct":
          return getProduct(db, String(args.key), publicOnly)
        case "getVoyage":
          return getVoyage(db, String(args.key), publicOnly)
        case "getYacht":
          return getYacht(db, String(args.key), publicOnly)
        case "quotePerSuite":
          return quotePerSuite(
            db,
            String(args.key),
            String(args.suiteId),
            String(args.currency),
            publicOnly,
          )
        case "quoteWholeYacht":
          return quoteWholeYacht(db, String(args.key), String(args.currency), publicOnly)
        case "createProduct":
          return chartersService.createProduct(db, args as never)
        case "updateProduct": {
          const { id, ...data } = args
          return chartersService.updateProduct(db, String(id), data as never)
        }
        case "upsertVoyage":
          return chartersService.upsertVoyage(db, args as never)
        case "updateVoyage": {
          const { id, ...data } = args
          return chartersService.updateVoyage(db, String(id), data as never)
        }
        case "createYacht":
          return chartersService.createYacht(db, args as never)
        case "updateYacht": {
          const { id, ...data } = args
          return chartersService.updateYacht(db, String(id), data as never)
        }
        case "createBooking":
          return createBooking(db, args, userId)
      }
    }
    return { charters: { execute } }
  },
})

async function browseCharters(
  db: PostgresJsDatabase,
  query: Record<string, unknown>,
  publicOnly: boolean,
) {
  const local = await chartersService.listProducts(db, {
    ...query,
    status: publicOnly ? "live" : undefined,
  } as never)
  const localItems = local.data.map((product) => normalizeLocalProduct(product))
  const adapters = listCharterAdapters()
  const settled = await Promise.allSettled(
    adapters.map(async (adapter) => ({
      adapter,
      result: await adapter.listEntries({ limit: local.limit }),
    })),
  )
  const externalItems = (
    await Promise.all(
      settled.map(async (outcome) =>
        outcome.status === "fulfilled"
          ? Promise.all(
              outcome.value.result.entries.map(async (entry) => {
                if (publicOnly) {
                  const product = await outcome.value.adapter
                    .fetchProduct(entry.sourceRef)
                    .catch(() => null)
                  if (!product || (product.status && product.status !== "live")) return null
                }
                return {
                  source: "external" as const,
                  sourceProvider: outcome.value.adapter.name,
                  sourceRef: entry.sourceRef,
                  key: externalKey(outcome.value.adapter, entry.sourceRef),
                  name: entry.name,
                  slug: entry.slug,
                  lineName: entry.lineName,
                  yachtName: entry.yachtName ?? null,
                  regions: [],
                  themes: [],
                  earliestVoyage: entry.earliestVoyage ?? null,
                  latestVoyage: entry.latestVoyage ?? null,
                  lowestPriceAmount: entry.lowestPriceAmount ?? null,
                  lowestPriceCurrency: entry.lowestPriceCurrency ?? null,
                  heroImageUrl: entry.heroImageUrl ?? null,
                }
              }),
            )
          : [],
      ),
    )
  )
    .flat()
    .filter((entry) => entry !== null)
  return {
    data: [...localItems, ...externalItems],
    total: local.total + externalItems.length,
    limit: local.limit,
    offset: local.offset,
  }
}

async function getProduct(db: PostgresJsDatabase, key: string, publicOnly: boolean) {
  const parsed = parseUnifiedKey(key)
  if (parsed.kind === "external") {
    const adapter = requiredAdapter(parsed.provider)
    const ref = { externalId: parsed.ref }
    const product = await adapter.fetchProduct(ref)
    if (!product || (publicOnly && product.status && product.status !== "live")) return null
    const [voyages, yacht] = await Promise.all([
      adapter.listVoyagesForProduct(ref),
      product.defaultYachtRef ? adapter.fetchYacht(product.defaultYachtRef) : null,
    ])
    return {
      summary: {
        source: "external",
        sourceProvider: adapter.name,
        sourceRef: product.sourceRef,
        key: externalKey(adapter, product.sourceRef),
        name: product.name,
        slug: product.slug,
        lineName: product.lineName,
        yachtName: yacht?.name ?? null,
        regions: product.regions ?? [],
        themes: product.themes ?? [],
        earliestVoyage: minDate(voyages.map((v) => v.departureDate)),
        latestVoyage: maxDate(voyages.map((v) => v.departureDate)),
        lowestPriceAmount: null,
        lowestPriceCurrency: null,
        heroImageUrl: product.heroImageUrl ?? null,
      },
      status: product.status ?? "live",
      description: product.description ?? null,
      shortDescription: product.shortDescription ?? null,
      bookingModes: product.defaultBookingModes ?? ["per_suite"],
      defaultApaPercent: product.defaultApaPercent ?? null,
      voyages: voyages.map((voyage) => normalizeExternalVoyage(adapter, voyage)),
      yacht: yacht ? normalizeExternalYacht(adapter, yacht) : null,
    }
  }
  let row =
    parsed.kind === "local"
      ? await chartersService.getProductById(db, parsed.id, { withVoyages: true, withYacht: true })
      : null
  if (!row && parsed.kind === "invalid") {
    const matches = await chartersService.listProducts(db, {
      search: parsed.raw,
      limit: 100,
      offset: 0,
    })
    const match = matches.data.find((candidate) => candidate.slug === parsed.raw)
    row = match
      ? await chartersService.getProductById(db, match.id, { withVoyages: true, withYacht: true })
      : null
  }
  if (!row || (publicOnly && row.status !== "live")) return null
  return {
    summary: normalizeLocalProduct(row),
    status: row.status,
    description: row.description,
    shortDescription: row.shortDescription,
    bookingModes: row.defaultBookingModes ?? [],
    defaultApaPercent: row.defaultApaPercent,
    voyages: (row.voyages ?? []).map(normalizeLocalVoyage),
    yacht: row.yacht ? normalizeLocalYacht(row.yacht) : null,
  }
}

async function getVoyage(db: PostgresJsDatabase, key: string, publicOnly: boolean) {
  const parsed = parseUnifiedKey(key)
  if (parsed.kind === "invalid") throw new ToolError("Invalid charter voyage key", "INVALID_INPUT")
  if (parsed.kind === "external") {
    const adapter = requiredAdapter(parsed.provider)
    const voyage = await adapter.fetchVoyage({ externalId: parsed.ref })
    if (!voyage) return null
    if (publicOnly) {
      const product = await adapter.fetchProduct(voyage.productRef)
      if (!product || (product.status && product.status !== "live")) return null
    }
    return normalizeExternalVoyage(adapter, voyage)
  }
  const row = await chartersService.getVoyageById(
    db,
    parsed.id,
    publicOnly ? { productStatus: "live" } : {},
  )
  return row ? normalizeLocalVoyage(row) : null
}

async function getYacht(db: PostgresJsDatabase, key: string, publicOnly: boolean) {
  const parsed = parseUnifiedKey(key)
  if (parsed.kind === "invalid") throw new ToolError("Invalid charter yacht key", "INVALID_INPUT")
  if (parsed.kind === "external") {
    const adapter = requiredAdapter(parsed.provider)
    const yacht = await adapter.fetchYacht({ externalId: parsed.ref })
    return yacht ? normalizeExternalYacht(adapter, yacht) : null
  }
  const row = await chartersService.getYachtById(db, parsed.id)
  return row && (!publicOnly || row.isActive) ? normalizeLocalYacht(row) : null
}

async function quotePerSuite(
  db: PostgresJsDatabase,
  key: string,
  suiteId: string,
  currency: string,
  publicOnly: boolean,
) {
  const parsed = parseUnifiedKey(key)
  if (parsed.kind === "invalid") throw new ToolError("Invalid charter voyage key", "INVALID_INPUT")
  if (parsed.kind === "external") {
    const adapter = requiredAdapter(parsed.provider)
    const ref = { externalId: parsed.ref }
    if (publicOnly) {
      const voyage = await adapter.fetchVoyage(ref)
      const product = voyage ? await adapter.fetchProduct(voyage.productRef) : null
      if (!voyage || !product || (product.status && product.status !== "live")) {
        throw new ToolError("Charter voyage not found", "NOT_FOUND")
      }
    }
    const suites = await adapter.fetchVoyageSuites(ref)
    const suite = suites.find((candidate) => candidate.sourceRef.externalId === suiteId)
    if (!suite) throw new ToolError("Charter suite not found on voyage", "NOT_FOUND")
    return composePerSuiteQuote({
      voyageId: parsed.ref,
      suite: {
        id: suiteId,
        suiteName: suite.suiteName,
        pricesByCurrency: suite.pricesByCurrency ?? {},
        portFeesByCurrency: suite.portFeesByCurrency ?? {},
      },
      currency,
    })
  }
  if (publicOnly) {
    const voyage = await chartersService.getVoyageById(db, parsed.id, {
      withSuites: true,
      productStatus: "live",
    })
    if (!voyage?.suites?.some((suite) => suite.id === suiteId))
      throw new ToolError("Charter suite not found on live voyage", "NOT_FOUND")
  }
  return pricingService.quotePerSuite(db, { suiteId, currency })
}

async function quoteWholeYacht(
  db: PostgresJsDatabase,
  key: string,
  currency: string,
  publicOnly: boolean,
) {
  const parsed = parseUnifiedKey(key)
  if (parsed.kind === "invalid") throw new ToolError("Invalid charter voyage key", "INVALID_INPUT")
  if (parsed.kind === "external") {
    const adapter = requiredAdapter(parsed.provider)
    const voyage = await adapter.fetchVoyage({ externalId: parsed.ref })
    if (!voyage) throw new ToolError("Charter voyage not found", "NOT_FOUND")
    const product = await adapter.fetchProduct(voyage.productRef)
    if (publicOnly && (!product || (product.status && product.status !== "live")))
      throw new ToolError("Charter voyage not found", "NOT_FOUND")
    return composeWholeYachtQuote({
      voyage: {
        id: parsed.ref,
        wholeYachtPricesByCurrency: voyage.wholeYachtPricesByCurrency ?? {},
        apaPercentOverride: voyage.apaPercentOverride ?? null,
      },
      productDefaultApaPercent: product?.defaultApaPercent ?? null,
      currency,
    })
  }
  if (
    publicOnly &&
    !(await chartersService.getVoyageById(db, parsed.id, { productStatus: "live" }))
  )
    throw new ToolError("Charter voyage not found", "NOT_FOUND")
  return pricingService.quoteWholeYacht(db, { voyageId: parsed.id, currency })
}

async function createBooking(
  db: PostgresJsDatabase,
  args: Record<string, unknown>,
  userId?: string,
) {
  const parsed = parseUnifiedKey(String(args.key))
  if (parsed.kind === "invalid") throw new ToolError("Invalid charter voyage key", "INVALID_INPUT")
  const { key: _key, mode, ...payload } = args
  if (parsed.kind === "external") {
    const adapter = requiredAdapter(parsed.provider)
    const result =
      mode === "per_suite"
        ? await chartersBookingService.createExternalPerSuiteBooking(
            db,
            {
              ...payload,
              adapter,
              voyageRef: { externalId: parsed.ref },
              suiteRef: { externalId: String(args.suiteId) },
            } as never,
            userId,
          )
        : await chartersBookingService.createExternalWholeYachtBooking(
            db,
            { ...payload, adapter, voyageRef: { externalId: parsed.ref } } as never,
            userId,
          )
    return normalizeBookingResult(result)
  }
  const result =
    mode === "per_suite"
      ? await chartersBookingService.createPerSuiteBooking(
          db,
          { ...payload, voyageId: parsed.id } as never,
          userId,
        )
      : await chartersBookingService.createWholeYachtBooking(
          db,
          { ...payload, voyageId: parsed.id } as never,
          userId,
        )
  return normalizeBookingResult(result)
}

function normalizeBookingResult(result: {
  bookingId: string
  bookingNumber: string
  sourceProvider?: string
  charterDetails: { connectorBookingRef?: string | null }
  quote: unknown
}) {
  return {
    bookingId: result.bookingId,
    bookingNumber: result.bookingNumber,
    sourceProvider: "sourceProvider" in result ? result.sourceProvider : null,
    connectorBookingRef: result.charterDetails.connectorBookingRef ?? null,
    quote: result.quote,
  }
}

function requiredAdapter(name: string): CharterAdapter {
  const adapter = resolveCharterAdapter(name)
  if (!adapter)
    throw new ToolError(`Selected charter provider '${name}' is unavailable`, "MISSING_SERVICE", {
      service: name,
    })
  return adapter
}
function externalKey(adapter: CharterAdapter, ref: SourceRef) {
  return `${adapter.name}:${ref.externalId}`
}
function normalizeLocalProduct(
  product: Awaited<ReturnType<typeof chartersService.listProducts>>["data"][number],
) {
  return {
    source: "local" as const,
    sourceProvider: null,
    sourceRef: null,
    key: product.id,
    name: product.name,
    slug: product.slug,
    lineName: null,
    yachtName: null,
    regions: product.regions ?? [],
    themes: product.themes ?? [],
    earliestVoyage: product.earliestVoyageCached,
    latestVoyage: product.latestVoyageCached,
    lowestPriceAmount: product.lowestPriceCachedAmount,
    lowestPriceCurrency: product.lowestPriceCachedCurrency,
    heroImageUrl: product.heroImageUrl,
  }
}
function normalizeLocalVoyage(
  voyage: Awaited<ReturnType<typeof chartersService.getVoyageById>> & {},
) {
  return {
    source: "local" as const,
    sourceProvider: null,
    sourceRef: null,
    key: voyage.id,
    productKey: voyage.productId,
    yachtKey: voyage.yachtId,
    voyageCode: voyage.voyageCode,
    name: voyage.name,
    departureDate: voyage.departureDate,
    returnDate: voyage.returnDate,
    nights: voyage.nights,
    bookingModes: voyage.bookingModes,
    appointmentOnly: voyage.appointmentOnly,
    salesStatus: voyage.salesStatus,
    embarkPortName: voyage.embarkPortName,
    disembarkPortName: voyage.disembarkPortName,
    wholeYachtPricesByCurrency: voyage.wholeYachtPricesByCurrency,
    apaPercentOverride: voyage.apaPercentOverride,
  }
}
function normalizeExternalVoyage(adapter: CharterAdapter, voyage: ExternalCharterVoyage) {
  return {
    source: "external" as const,
    sourceProvider: adapter.name,
    sourceRef: voyage.sourceRef,
    key: externalKey(adapter, voyage.sourceRef),
    productKey: externalKey(adapter, voyage.productRef),
    yachtKey: externalKey(adapter, voyage.yachtRef),
    voyageCode: voyage.voyageCode,
    name: voyage.name ?? null,
    departureDate: voyage.departureDate,
    returnDate: voyage.returnDate,
    nights: voyage.nights,
    bookingModes: voyage.bookingModes,
    appointmentOnly: voyage.appointmentOnly ?? false,
    salesStatus: voyage.salesStatus ?? "open",
    embarkPortName: voyage.embarkPortName ?? null,
    disembarkPortName: voyage.disembarkPortName ?? null,
    wholeYachtPricesByCurrency: voyage.wholeYachtPricesByCurrency ?? {},
    apaPercentOverride: voyage.apaPercentOverride ?? null,
  }
}
function normalizeLocalYacht(
  yacht: NonNullable<Awaited<ReturnType<typeof chartersService.getYachtById>>>,
) {
  return {
    source: "local" as const,
    sourceProvider: null,
    sourceRef: null,
    key: yacht.id,
    name: yacht.name,
    slug: yacht.slug,
    yachtClass: yacht.yachtClass,
    capacityGuests: yacht.capacityGuests,
    capacityCrew: yacht.capacityCrew,
    description: yacht.description,
    gallery: yacht.gallery ?? [],
    amenities: yacht.amenities ?? {},
    defaultCharterAreas: yacht.defaultCharterAreas ?? [],
  }
}
function normalizeExternalYacht(adapter: CharterAdapter, yacht: ExternalCharterYacht) {
  return {
    source: "external" as const,
    sourceProvider: adapter.name,
    sourceRef: yacht.sourceRef,
    key: externalKey(adapter, yacht.sourceRef),
    name: yacht.name,
    slug: yacht.slug,
    yachtClass: yacht.yachtClass,
    capacityGuests: yacht.capacityGuests ?? null,
    capacityCrew: yacht.capacityCrew ?? null,
    description: yacht.description ?? null,
    gallery: yacht.gallery ?? [],
    amenities: yacht.amenities ?? {},
    defaultCharterAreas: yacht.defaultCharterAreas ?? [],
  }
}
function minDate(values: string[]) {
  return values.length ? ([...values].sort()[0] ?? null) : null
}
function maxDate(values: string[]) {
  return values.length ? ([...values].sort().at(-1) ?? null) : null
}
