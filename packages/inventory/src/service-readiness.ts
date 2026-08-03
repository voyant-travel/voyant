/**
 * Database loader for product publish readiness.
 *
 * Assembles the facts `evaluateProductReadiness` needs and returns the derived
 * result. Everything here is a read; readiness is never stored.
 *
 * Distribution is deliberately *not* a dependency of inventory. A caller that
 * can resolve channel publication passes a `resolveActiveChannelCount`
 * function; without one the channel check is skipped rather than guessed.
 */

import {
  availabilitySlots,
  productMeetingConfigs,
  productOptionResourceTemplates,
} from "@voyant-travel/operations"
import { and, asc, count, eq, gte, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  evaluateProductReadiness,
  type ProductReadinessInput,
  type ProductReadinessResult,
} from "./readiness.js"
import {
  optionUnits,
  productDayServices,
  productDays,
  productItineraries,
  productOptions,
  productPaxPricingTiers,
  products,
  productTypes,
} from "./schema.js"

/**
 * Resolves how many active channel publications cover a product. Supplied by
 * the deployment when Distribution is wired; omitted otherwise.
 */
export type ActiveChannelCountResolver = (productId: string) => Promise<number>

export interface ProductReadinessOptions {
  resolveActiveChannelCount?: ActiveChannelCountResolver
}

/**
 * The subset of a product row the loader needs. Accepting it as an argument
 * lets the publish path evaluate readiness for a *pending* product state
 * (create, or patch merged over the current row) rather than the stored one.
 */
export interface ProductReadinessSubject {
  id?: string
  status: string
  bookingMode: string
  capacityMode: string
  durationMinutes?: number | null
  description?: string | null
  defaultLanguageTag?: string | null
  contractTemplateId?: string | null
  sellAmountCents?: number | null
  pax?: number | null
  productTypeId?: string | null
}

async function loadReadinessInput(
  db: PostgresJsDatabase,
  subject: ProductReadinessSubject,
  options: ProductReadinessOptions,
): Promise<ProductReadinessInput> {
  const productId = subject.id

  // A product that does not exist yet (create) owns none of the child rows
  // below. Evaluate it on its own fields so create-time publication is still
  // refused for the reasons that are knowable.
  if (!productId) {
    return {
      ...baseInput(subject),
      persisted: false,
      hasFamily: !!subject.productTypeId,
      defaultOption: null,
      defaultOptionUnitCount: 0,
      pricingTierCount: 0,
      defaultItinerary: null,
      itineraryDayNumbers: [],
      dayServiceCostAmountsCents: [],
      futureOpenSlotCount: 0,
      hasSlotCapacity: false,
      hasMeetingPoint: false,
      hasAllocationTemplate: false,
      activeChannelCount: null,
    }
  }

  const now = new Date()

  const [family, defaultOptionRow, defaultItineraryRow, futureSlots, meetingConfig] =
    await Promise.all([
      subject.productTypeId
        ? db
            .select({ id: productTypes.id })
            .from(productTypes)
            .where(eq(productTypes.id, subject.productTypeId))
            .limit(1)
        : Promise.resolve([]),
      db
        .select({ id: productOptions.id, status: productOptions.status })
        .from(productOptions)
        .where(and(eq(productOptions.productId, productId), eq(productOptions.isDefault, true)))
        .orderBy(asc(productOptions.sortOrder), asc(productOptions.createdAt))
        .limit(1),
      db
        .select({ id: productItineraries.id })
        .from(productItineraries)
        .where(
          and(eq(productItineraries.productId, productId), eq(productItineraries.isDefault, true)),
        )
        .orderBy(asc(productItineraries.sortOrder), asc(productItineraries.createdAt))
        .limit(1),
      db
        .select({
          id: availabilitySlots.id,
          initialPax: availabilitySlots.initialPax,
          unlimited: availabilitySlots.unlimited,
        })
        .from(availabilitySlots)
        .where(
          and(
            eq(availabilitySlots.productId, productId),
            eq(availabilitySlots.status, "open"),
            gte(availabilitySlots.startsAt, now),
          ),
        )
        .limit(50),
      db
        .select({ id: productMeetingConfigs.id })
        .from(productMeetingConfigs)
        .where(
          and(
            eq(productMeetingConfigs.productId, productId),
            eq(productMeetingConfigs.active, true),
          ),
        )
        .limit(1),
    ])

  const defaultOption = defaultOptionRow[0] ?? null
  const defaultItinerary = defaultItineraryRow[0] ?? null

  const [unitCount, pricingTierCount, itineraryDays, optionIds] = await Promise.all([
    defaultOption
      ? db
          .select({ value: count() })
          .from(optionUnits)
          .where(eq(optionUnits.optionId, defaultOption.id))
      : Promise.resolve([{ value: 0 }]),
    db
      .select({ value: count() })
      .from(productPaxPricingTiers)
      .where(eq(productPaxPricingTiers.productId, productId)),
    defaultItinerary
      ? db
          .select({ dayNumber: productDays.dayNumber, id: productDays.id })
          .from(productDays)
          .where(eq(productDays.itineraryId, defaultItinerary.id))
          .orderBy(asc(productDays.dayNumber))
      : Promise.resolve([] as { dayNumber: number; id: string }[]),
    db
      .select({ id: productOptions.id })
      .from(productOptions)
      .where(eq(productOptions.productId, productId)),
  ])

  const dayIds = itineraryDays.map((day) => day.id)
  const [dayServiceCosts, allocationTemplates] = await Promise.all([
    dayIds.length > 0
      ? db
          .select({ costAmountCents: productDayServices.costAmountCents })
          .from(productDayServices)
          .where(inArray(productDayServices.dayId, dayIds))
      : Promise.resolve([] as { costAmountCents: number }[]),
    optionIds.length > 0
      ? db
          .select({ id: productOptionResourceTemplates.id })
          .from(productOptionResourceTemplates)
          .where(
            inArray(
              productOptionResourceTemplates.productOptionId,
              optionIds.map((option) => option.id),
            ),
          )
          .limit(1)
      : Promise.resolve([] as { id: string }[]),
  ])

  const activeChannelCount = options.resolveActiveChannelCount
    ? await options.resolveActiveChannelCount(productId)
    : null

  return {
    ...baseInput(subject),
    persisted: true,
    hasFamily: family.length > 0,
    defaultOption,
    defaultOptionUnitCount: Number(unitCount[0]?.value ?? 0),
    pricingTierCount: Number(pricingTierCount[0]?.value ?? 0),
    defaultItinerary,
    itineraryDayNumbers: itineraryDays.map((day) => day.dayNumber),
    dayServiceCostAmountsCents: dayServiceCosts.map((service) => service.costAmountCents),
    futureOpenSlotCount: futureSlots.length,
    hasSlotCapacity: futureSlots.some(
      (slot) => slot.unlimited || (slot.initialPax != null && slot.initialPax > 0),
    ),
    hasMeetingPoint: meetingConfig.length > 0,
    hasAllocationTemplate: allocationTemplates.length > 0,
    activeChannelCount,
  }
}

function baseInput(subject: ProductReadinessSubject) {
  return {
    status: subject.status,
    bookingMode: subject.bookingMode,
    capacityMode: subject.capacityMode,
    durationMinutes: subject.durationMinutes,
    // The legacy itinerary-day derivation is resolved from the loaded days
    // below; `resolveProductDuration` prefers the explicit value anyway.
    itineraryDurationDays: null as number | null,
    description: subject.description,
    defaultLanguageTag: subject.defaultLanguageTag,
    contractTemplateId: subject.contractTemplateId,
    sellAmountCents: subject.sellAmountCents,
    pax: subject.pax,
  }
}

/**
 * Evaluate readiness for a product that may not be persisted yet (create) or
 * for a patch merged over the stored row (update).
 */
export async function evaluateProductReadinessFor(
  db: PostgresJsDatabase,
  subject: ProductReadinessSubject,
  options: ProductReadinessOptions = {},
): Promise<ProductReadinessResult> {
  const input = await loadReadinessInput(db, subject, options)
  // Resolve the legacy itinerary-derived duration from the days we already
  // loaded so the evaluator sees one consistent duration.
  const itineraryDurationDays =
    input.itineraryDayNumbers.length > 0 ? Math.max(...input.itineraryDayNumbers) : null

  return evaluateProductReadiness({ ...input, itineraryDurationDays })
}

/**
 * Read the current readiness of a stored product. Returns `null` when the
 * product does not exist.
 */
export async function getProductReadiness(
  db: PostgresJsDatabase,
  productId: string,
  options: ProductReadinessOptions = {},
): Promise<ProductReadinessResult | null> {
  const [row] = await db
    .select({
      id: products.id,
      status: products.status,
      bookingMode: products.bookingMode,
      capacityMode: products.capacityMode,
      durationMinutes: products.durationMinutes,
      description: products.description,
      defaultLanguageTag: products.defaultLanguageTag,
      contractTemplateId: products.contractTemplateId,
      sellAmountCents: products.sellAmountCents,
      pax: products.pax,
      productTypeId: products.productTypeId,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)

  if (!row) return null

  return evaluateProductReadinessFor(db, row, options)
}

/**
 * True when the product's definition changed in a way that affects how a
 * departure would be operated, and therefore warrants a new immutable Product
 * Version. Used by the publish path so re-publishing an unchanged product does
 * not mint meaningless versions.
 *
 * Compares two Product Version snapshots on two axes:
 *
 *   - the product columns a materialized departure depends on, and
 *   - the structure it materializes from (options and units, itineraries,
 *     days, and day services).
 *
 * Marketing copy, media, SEO, and record timestamps are deliberately excluded:
 * rewording a description must not invalidate a sold departure's provenance.
 */
export function hasOperationalChange(
  previous: Record<string, unknown> | null,
  next: Record<string, unknown>,
): boolean {
  if (!previous) return true

  if (OPERATIONAL_FIELDS.some((field) => !sameScalar(previous[field], next[field]))) {
    return true
  }

  return (
    JSON.stringify(structuralProjection(previous)) !== JSON.stringify(structuralProjection(next))
  )
}

/**
 * Compare two snapshot values. Snapshots round-trip through JSONB, so a value
 * that was a `Date` in the freshly built candidate comes back as an ISO string
 * in the stored previous version. Normalise before comparing so that
 * difference alone never looks like an operational change.
 */
function sameScalar(a: unknown, b: unknown): boolean {
  return normalizeScalar(a) === normalizeScalar(b)
}

function normalizeScalar(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (value === null || value === undefined) return null
  return value
}

/**
 * Product columns whose value a materialized departure depends on. Editing a
 * marketing field alone must not create a version; editing any of these must.
 */
const OPERATIONAL_FIELDS = [
  "bookingMode",
  "capacityMode",
  "durationMinutes",
  "timezone",
  "sellCurrency",
  "sellAmountCents",
  "costAmountCents",
  "pax",
  "startDate",
  "endDate",
  "reservationTimeoutMinutes",
  "contractTemplateId",
  "taxClassId",
  "productTypeId",
  "productSubtypeCode",
  "supplierId",
  "facilityId",
] as const

/** Snapshot child keys whose structure a departure materializes from. */
const STRUCTURAL_KEYS = ["options", "itineraries"] as const

/** Per-record keys that carry no operational meaning. */
const VOLATILE_KEYS = new Set(["createdAt", "updatedAt"])

/**
 * Reduce the structural subtree to a stable, comparable form: drop record
 * timestamps, normalise dates, and keep key order deterministic.
 */
function structuralProjection(snapshot: Record<string, unknown>): unknown {
  return STRUCTURAL_KEYS.map((key) => stripVolatile(snapshot[key]))
}

function stripVolatile(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripVolatile)
  if (value instanceof Date) return value.toISOString()
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(source).sort()) {
      if (VOLATILE_KEYS.has(key)) continue
      result[key] = stripVolatile(source[key])
    }
    return result
  }
  return value ?? null
}
