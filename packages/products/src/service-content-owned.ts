/**
 * Owned-product content builder.
 *
 * Projects an owned product (the products module's own tables) into the
 * vertical-shared `ProductContent` shape so the catalog content service
 * can return rich detail for owned products via the same API that
 * sourced products go through (`getProductContent`).
 *
 * Per sourced-content §3.3: `getProductContent` is the unified read
 * surface for owned + sourced. v1 of service-content.ts only handled
 * sourced (returning null for owned); this helper closes that gap.
 *
 * Locale resolution uses the catalog plane's standard
 * `pickBestCachedLocale` against `product_translations` and
 * `product_option_translations` rows — exact > language-match >
 * fallback-chain > any. Matches the same scoring semantics the sourced
 * cache reads use, so the same `BookingDraft.scope.locale` chain works
 * for both owned and sourced products.
 *
 * The projection reads in parallel:
 *   - `products` row → product summary + tags + supplier
 *   - `product_translations` → localized name + description per locale
 *   - `product_itineraries` + `product_days` → itinerary days (no
 *     translation table today; falls back to source)
 *   - `product_options` + `product_option_translations` → options +
 *     localized labels
 *   - `product_media` → hero + gallery
 *
 * Day translations don't exist in the schema yet — when
 * `product_day_translations` lands, this function picks them up the
 * same way.
 */

import type { ContentLocaleMatchKind } from "@voyantjs/catalog"
import { pickBestCachedLocale } from "@voyantjs/catalog"
import type { AnyDrizzleDb } from "@voyantjs/db"
import { and, asc, eq, inArray } from "drizzle-orm"

import {
  type ProductContent,
  productContentSchema,
  validateProductContent,
} from "./content-shape.js"
import {
  productDays,
  productItineraries,
  productMedia,
  productOptions,
  productOptionTranslations,
  products,
  productTranslations,
} from "./schema.js"

export interface BuildOwnedProductContentOptions {
  /**
   * Ordered locale preference chain — most-preferred first. Same shape
   * the catalog plane's `pickBestCachedLocale` consumes. Pass-through
   * from the caller's `BookingDraft.scope.locale` (storefront /
   * operator UI).
   */
  preferredLocales: ReadonlyArray<string>
}

export interface BuildOwnedProductContentResult {
  /** The owned product projected to ProductContent. */
  content: ProductContent
  /**
   * The locale we actually served — may differ from
   * `preferredLocales[0]` when a fallback was used. Per-product;
   * options that fell back to a different locale don't override this
   * (storefront UI hints at the product level).
   */
  servedLocale: string
  /**
   * How well the served locale matched the chain. Surfaces in the UI
   * as a "served in English" hint when content was served in a
   * non-preferred language.
   */
  matchKind: ContentLocaleMatchKind
}

/**
 * Read the owned product + related rows and project to `ProductContent`,
 * resolving translations against the supplied locale-preference chain.
 * Returns null when the product doesn't exist.
 */
export async function buildOwnedProductContent(
  db: AnyDrizzleDb,
  entityId: string,
  options: BuildOwnedProductContentOptions,
): Promise<BuildOwnedProductContentResult | null> {
  // biome-ignore lint/suspicious/noExplicitAny: drizzle's generic returning Pg infers the row shape but the AnyDrizzleDb wrapper widens it
  const productRow: any = (
    await db.select().from(products).where(eq(products.id, entityId)).limit(1)
  )[0]
  if (!productRow) return null

  const [optionRows, mediaRows, itineraryRows, productTrns] = await Promise.all([
    db
      .select()
      .from(productOptions)
      .where(eq(productOptions.productId, entityId))
      .orderBy(asc(productOptions.sortOrder)),
    db
      .select()
      .from(productMedia)
      .where(eq(productMedia.productId, entityId))
      .orderBy(asc(productMedia.sortOrder), asc(productMedia.createdAt)),
    db
      .select()
      .from(productItineraries)
      .where(eq(productItineraries.productId, entityId))
      .orderBy(asc(productItineraries.sortOrder)),
    db.select().from(productTranslations).where(eq(productTranslations.productId, entityId)),
  ])

  // biome-ignore lint/suspicious/noExplicitAny: drizzle row shape
  const defaultItinerary: any =
    itineraryRows.find((it: { isDefault: boolean }) => it.isDefault) ?? itineraryRows[0]
  const days = defaultItinerary
    ? await db
        .select()
        .from(productDays)
        .where(and(eq(productDays.itineraryId, defaultItinerary.id)))
        .orderBy(asc(productDays.dayNumber))
    : []

  // Pull option translations in one round-trip for every option in this
  // product. Fan-out per-option would be wasteful when products
  // typically have a small number of options.
  const optionIds = optionRows.map((o: typeof productOptions.$inferSelect) => o.id)
  const optionTrns =
    optionIds.length > 0
      ? await db
          .select()
          .from(productOptionTranslations)
          .where(inArray(productOptionTranslations.optionId, optionIds))
      : []

  // Pick the best product-level translation. Falls through to the
  // source row's name/description when no translation row matches —
  // pickBestCachedLocale returns the closest available, so the
  // server-locale chip reflects what the user actually sees.
  const bestProductTrn = pickBestProductTranslation(productTrns, options.preferredLocales)
  const productServedLocale = bestProductTrn?.served_locale ?? sourceLocaleFor(productRow)
  const productMatchKind: ContentLocaleMatchKind = bestProductTrn?.match_kind ?? "any"

  const cover: typeof productMedia.$inferSelect | undefined =
    mediaRows.find((m: typeof productMedia.$inferSelect) => m.isCover) ?? mediaRows[0] ?? undefined

  const localizedName = bestProductTrn?.candidate.name ?? productRow.name
  const localizedDescription =
    bestProductTrn?.candidate.shortDescription ??
    bestProductTrn?.candidate.description ??
    productRow.description ??
    null

  const content: ProductContent = productContentSchema.parse({
    product: {
      id: productRow.id,
      name: localizedName,
      status: productRow.status,
      description: localizedDescription,
      hero_image_url: cover?.url ?? null,
      duration_days: estimateDurationDays(days, productRow),
      start_date: dateToIso(productRow.startDate),
      end_date: dateToIso(productRow.endDate),
      sell_currency: productRow.sellCurrency,
      supplier: productRow.supplierId ?? null,
      tags: Array.isArray(productRow.tags) ? productRow.tags : [],
    },
    options: optionRows.map((opt: typeof productOptions.$inferSelect) => {
      const trnsForOption = optionTrns.filter(
        (t: typeof productOptionTranslations.$inferSelect) => t.optionId === opt.id,
      )
      const bestOptionTrn = pickBestOptionTranslation(trnsForOption, options.preferredLocales)
      return {
        id: opt.id,
        name: bestOptionTrn?.candidate.name ?? opt.name,
        description:
          bestOptionTrn?.candidate.shortDescription ??
          bestOptionTrn?.candidate.description ??
          opt.description ??
          null,
        units: [],
        inclusions: [],
      }
    }),
    days: days.map((d: typeof productDays.$inferSelect) => ({
      // Days don't have a translation table today; source values flow
      // through. When `product_day_translations` lands, slot in here
      // with the same pickBestCachedLocale call.
      day_number: d.dayNumber,
      title: d.title ?? null,
      description: d.description ?? null,
      location: d.location ?? null,
      services: [],
    })),
    media: mediaRows
      .filter((m: typeof productMedia.$inferSelect) => !m.isBrochure)
      .map((m: typeof productMedia.$inferSelect) => ({
        url: m.url,
        type: mediaType(m.mediaType),
        caption: m.altText ?? null,
        alt: m.altText ?? null,
      })),
    policies: [],
    // Owned products have no scheduled-departure table in v1; sourced
    // products carry departures via the upstream's getContent payload.
    departures: [],
  })

  const validation = validateProductContent(content)
  if (!validation.valid) {
    throw new Error(`owned product ${entityId} projection failed validation: ${validation.reason}`)
  }
  return {
    content,
    servedLocale: productServedLocale,
    matchKind: productMatchKind,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Locale resolution — productTranslations / productOptionTranslations
// ─────────────────────────────────────────────────────────────────────────────

interface ProductTrnCandidate {
  /** Renamed from `languageTag` so `pickBestCachedLocale` can score it. */
  locale: string
  name: string
  shortDescription: string | null
  description: string | null
}

function pickBestProductTranslation(
  rows: ReadonlyArray<typeof productTranslations.$inferSelect>,
  preferred: ReadonlyArray<string>,
) {
  if (rows.length === 0) return null
  const candidates: ProductTrnCandidate[] = rows.map((r) => ({
    locale: r.languageTag,
    name: r.name,
    shortDescription: r.shortDescription,
    description: r.description,
  }))
  return pickBestCachedLocale(candidates, preferred)
}

interface OptionTrnCandidate {
  locale: string
  name: string
  shortDescription: string | null
  description: string | null
}

function pickBestOptionTranslation(
  rows: ReadonlyArray<typeof productOptionTranslations.$inferSelect>,
  preferred: ReadonlyArray<string>,
) {
  if (rows.length === 0) return null
  const candidates: OptionTrnCandidate[] = rows.map((r) => ({
    locale: r.languageTag,
    name: r.name,
    shortDescription: r.shortDescription,
    description: r.description,
  }))
  return pickBestCachedLocale(candidates, preferred)
}

/**
 * When no translation rows exist for the product, the source row's
 * `name` + `description` are surfaced. We don't know what locale they
 * were authored in — operators tend to author in their default
 * deployment locale (commonly en-GB / en-US for UK / US deployments).
 * The caller's `defaultSourceLocale` would be a cleaner fix; for now
 * we report `und` (BCP 47 "undetermined") so the storefront chip
 * doesn't claim a specific locale we can't verify.
 */
function sourceLocaleFor(_productRow: { id: string }): string {
  return "und"
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function estimateDurationDays(
  days: Array<{ dayNumber: number }>,
  productRow: { startDate: string | null; endDate: string | null },
): number | null {
  if (days.length > 0) {
    const max = Math.max(...days.map((d) => d.dayNumber))
    return Number.isFinite(max) && max > 0 ? max : null
  }
  if (productRow.startDate && productRow.endDate) {
    const start = new Date(productRow.startDate)
    const end = new Date(productRow.endDate)
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const diffMs = end.getTime() - start.getTime()
      const days = Math.round(diffMs / (24 * 60 * 60 * 1000))
      return days > 0 ? days : null
    }
  }
  return null
}

function dateToIso(value: string | Date | null | undefined): string | null {
  if (!value) return null
  if (typeof value === "string") return value
  return value.toISOString().slice(0, 10)
}

function mediaType(value: string): "image" | "video" | "document" {
  if (value === "video") return "video"
  if (value === "document") return "document"
  return "image"
}
