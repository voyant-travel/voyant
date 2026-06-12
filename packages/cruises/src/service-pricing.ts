import { and, asc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { cruiseCabinCategories } from "./schema-cabins.js"
import {
  type CruisePrice,
  type CruisePriceComponent,
  cruisePriceComponents,
  cruisePrices,
} from "./schema-pricing.js"

// ---------- money helpers ----------
// All math is performed in integer cents to avoid float drift.

const CENTS_PER_UNIT = 100n

function decimalStringToCents(s: string): bigint {
  const trimmed = s.trim()
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error(`Invalid money string: ${s}`)
  }
  const negative = trimmed.startsWith("-")
  const abs = negative ? trimmed.slice(1) : trimmed
  const parts = abs.split(".")
  const whole = parts[0] ?? "0"
  const frac = parts[1] ?? ""
  const fracPadded = `${frac}00`.slice(0, 2)
  const cents = BigInt(whole) * CENTS_PER_UNIT + BigInt(fracPadded)
  return negative ? -cents : cents
}

function centsToDecimalString(c: bigint): string {
  const negative = c < 0n
  const abs = negative ? -c : c
  const whole = abs / CENTS_PER_UNIT
  const frac = abs % CENTS_PER_UNIT
  const fracStr = frac.toString().padStart(2, "0")
  return `${negative ? "-" : ""}${whole.toString()}.${fracStr}`
}

function percentOf(cents: bigint, percentString: string): bigint {
  // percent stored with up to 2 decimal places (e.g. "75.50")
  const trimmed = percentString.trim()
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error(`Invalid percent string: ${percentString}`)
  }
  const parts = trimmed.split(".")
  const whole = parts[0] ?? "0"
  const frac = parts[1] ?? ""
  const fracPadded = `${frac}00`.slice(0, 2)
  // percent * 100 → integer basis points; multiply cents, divide by 10000
  const basisPoints = BigInt(whole) * 100n + BigInt(fracPadded)
  return (cents * basisPoints) / 10_000n
}

// ---------- composition (pure function) ----------

export type QuotePriceComponentKind = CruisePriceComponent["kind"] | "single_supplement" | "other"

export type QuoteBookingTerms = {
  cancellationPolicy?: {
    summary?: string | null
    rules?: Array<{
      from?: string | null
      until?: string | null
      penaltyAmount?: string | null
      penaltyCurrency?: string | null
      penaltyPercent?: string | null
      description?: string | null
    }>
    [key: string]: unknown
  } | null
  paymentTerms?: {
    summary?: string | null
    depositAmount?: string | null
    depositCurrency?: string | null
    depositPercent?: string | null
    dueDate?: string | null
    schedule?: Array<Record<string, unknown>>
    [key: string]: unknown
  } | null
  supplierTermsUrl?: string | null
  notes?: string | null
  [key: string]: unknown
}

export type QuoteComponent = {
  kind: QuotePriceComponentKind
  label: string | null
  amount: string
  currency: string
  direction: CruisePriceComponent["direction"]
  perPerson: boolean
}

export type Quote = {
  fareCode: string | null
  fareCodeName: string | null
  fareVariant: CruisePrice["fareVariant"]
  currency: string
  occupancy: number
  guestCount: number
  basePerPerson: string
  originalPricePerPerson: string | null
  singlePricePerPerson: string | null
  earlyBookingDeadline: string | null
  earlyBookingBonusDescription: string | null
  components: QuoteComponent[]
  totalPerPerson: string
  totalForCabin: string
  bookingTerms?: QuoteBookingTerms | null
}

export type ComposeQuoteInput = {
  price: Pick<
    CruisePrice,
    | "pricePerPerson"
    | "originalPricePerPerson"
    | "secondGuestPricePerPerson"
    | "singlePricePerPerson"
    | "singleSupplementPercent"
    | "currency"
    | "fareCode"
    | "fareCodeName"
    | "fareVariant"
    | "earlyBookingDeadline"
    | "earlyBookingBonusDescription"
  >
  components: Array<
    Pick<CruisePriceComponent, "label" | "amount" | "currency" | "direction" | "perPerson"> & {
      kind: QuotePriceComponentKind
    }
  >
  occupancy: number
  guestCount: number
  bookingTerms?: QuoteBookingTerms | null
}

export function composeQuote(input: ComposeQuoteInput): Quote {
  const { price, components, occupancy, guestCount } = input

  if (occupancy < 1) throw new Error("occupancy must be >= 1")
  if (guestCount < 1) throw new Error("guestCount must be >= 1")
  if (guestCount > occupancy)
    throw new Error(`guestCount (${guestCount}) cannot exceed occupancy (${occupancy})`)

  const basePerPersonCents = decimalStringToCents(price.pricePerPerson)

  // Resolve effective base per cabin, accounting for second-guest reduction and single supplement.
  let baseCabinCents: bigint
  if (occupancy === 1 && price.singlePricePerPerson && guestCount === 1) {
    baseCabinCents = decimalStringToCents(price.singlePricePerPerson)
  } else if (occupancy === 1 && price.singleSupplementPercent && guestCount === 1) {
    const supplementCents = percentOf(basePerPersonCents, price.singleSupplementPercent)
    baseCabinCents = basePerPersonCents + supplementCents
  } else if (occupancy === 2 && price.secondGuestPricePerPerson && guestCount === 2) {
    const secondCents = decimalStringToCents(price.secondGuestPricePerPerson)
    baseCabinCents = basePerPersonCents + secondCents
  } else {
    baseCabinCents = basePerPersonCents * BigInt(guestCount)
  }

  // Apply price components.
  let cabinAdjustmentCents = 0n
  const renderedComponents: QuoteComponent[] = []

  for (const c of components) {
    if (c.currency !== price.currency) {
      throw new Error(
        `Component currency ${c.currency} does not match price currency ${price.currency}`,
      )
    }
    const amountCents = decimalStringToCents(c.amount)
    const componentTotalCents = c.perPerson ? amountCents * BigInt(guestCount) : amountCents

    if (c.direction === "addition") {
      cabinAdjustmentCents += componentTotalCents
    } else if (c.direction === "credit") {
      cabinAdjustmentCents -= componentTotalCents
    }
    // 'inclusion' is display-only — does not affect totals.

    renderedComponents.push({
      kind: c.kind,
      label: c.label ?? null,
      amount: c.amount,
      currency: c.currency,
      direction: c.direction,
      perPerson: c.perPerson,
    })
  }

  const totalForCabinCents = baseCabinCents + cabinAdjustmentCents
  const totalPerPersonCents = totalForCabinCents / BigInt(guestCount)

  return {
    fareCode: price.fareCode ?? null,
    fareCodeName: price.fareCodeName ?? null,
    fareVariant: price.fareVariant,
    currency: price.currency,
    occupancy,
    guestCount,
    basePerPerson: centsToDecimalString(basePerPersonCents),
    originalPricePerPerson: price.originalPricePerPerson ?? null,
    singlePricePerPerson: price.singlePricePerPerson ?? null,
    earlyBookingDeadline: price.earlyBookingDeadline ?? null,
    earlyBookingBonusDescription: price.earlyBookingBonusDescription ?? null,
    components: renderedComponents,
    totalPerPerson: centsToDecimalString(totalPerPersonCents),
    totalForCabin: centsToDecimalString(totalForCabinCents),
    bookingTerms: input.bookingTerms ?? null,
  }
}

// ---------- DB-bound service ----------

export type LowestPriceResult = {
  pricePerPerson: string
  currency: string
  cabinCategoryId: string
  fareCode: string | null
  fareVariant: CruisePrice["fareVariant"]
} | null

export type GridCell = {
  cabinCategoryId: string
  occupancy: number
  fareCode: string | null
  fareVariant: CruisePrice["fareVariant"]
  pricePerPerson: string
  originalPricePerPerson: string | null
  currency: string
  availability: CruisePrice["availability"]
}

export const pricingService = {
  async lowestAvailablePrice(
    db: PostgresJsDatabase,
    args: { sailingId: string; occupancy: number },
  ): Promise<LowestPriceResult> {
    const [row] = await db
      .select({
        pricePerPerson: cruisePrices.pricePerPerson,
        currency: cruisePrices.currency,
        cabinCategoryId: cruisePrices.cabinCategoryId,
        fareCode: cruisePrices.fareCode,
        fareVariant: cruisePrices.fareVariant,
      })
      .from(cruisePrices)
      .where(
        and(
          eq(cruisePrices.sailingId, args.sailingId),
          eq(cruisePrices.occupancy, args.occupancy),
          // agent-quality: raw-sql reviewed -- owner: cruises; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
          sql`${cruisePrices.availability} <> 'sold_out'`,
        ),
      )
      // agent-quality: raw-sql reviewed -- owner: cruises; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      .orderBy(asc(sql`${cruisePrices.pricePerPerson}::numeric`))
      .limit(1)

    return row ?? null
  },

  async gridForSailing(db: PostgresJsDatabase, sailingId: string): Promise<GridCell[]> {
    const rows = await db
      .select({
        cabinCategoryId: cruisePrices.cabinCategoryId,
        occupancy: cruisePrices.occupancy,
        fareCode: cruisePrices.fareCode,
        fareVariant: cruisePrices.fareVariant,
        pricePerPerson: cruisePrices.pricePerPerson,
        originalPricePerPerson: cruisePrices.originalPricePerPerson,
        currency: cruisePrices.currency,
        availability: cruisePrices.availability,
      })
      .from(cruisePrices)
      .where(eq(cruisePrices.sailingId, sailingId))
      .orderBy(
        asc(cruisePrices.cabinCategoryId),
        asc(cruisePrices.occupancy),
        // agent-quality: raw-sql reviewed -- owner: cruises; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
        asc(sql`${cruisePrices.pricePerPerson}::numeric`),
      )

    return rows
  },

  async assembleQuote(
    db: PostgresJsDatabase,
    args: {
      sailingId: string
      cabinCategoryId: string
      occupancy: number
      guestCount: number
      fareCode?: string | null
      fareVariant?: CruisePrice["fareVariant"] | null
    },
  ): Promise<Quote> {
    // Validate cabin category exists and respects occupancy bounds.
    const [category] = await db
      .select({
        id: cruiseCabinCategories.id,
        minOccupancy: cruiseCabinCategories.minOccupancy,
        maxOccupancy: cruiseCabinCategories.maxOccupancy,
      })
      .from(cruiseCabinCategories)
      .where(eq(cruiseCabinCategories.id, args.cabinCategoryId))
      .limit(1)

    if (!category) throw new Error(`Cabin category ${args.cabinCategoryId} not found`)
    if (args.guestCount < category.minOccupancy || args.guestCount > category.maxOccupancy) {
      throw new Error(
        `guestCount ${args.guestCount} outside category bounds [${category.minOccupancy}, ${category.maxOccupancy}]`,
      )
    }

    // Pick the cheapest matching price row.
    const conditions = [
      eq(cruisePrices.sailingId, args.sailingId),
      eq(cruisePrices.cabinCategoryId, args.cabinCategoryId),
      eq(cruisePrices.occupancy, args.occupancy),
    ]
    if (args.fareCode) conditions.push(eq(cruisePrices.fareCode, args.fareCode))
    if (args.fareVariant) conditions.push(eq(cruisePrices.fareVariant, args.fareVariant))

    const [price] = await db
      .select()
      .from(cruisePrices)
      .where(and(...conditions))
      // agent-quality: raw-sql reviewed -- owner: cruises; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      .orderBy(asc(sql`${cruisePrices.pricePerPerson}::numeric`))
      .limit(1)

    if (!price) {
      throw new Error(
        `No price found for sailing=${args.sailingId} category=${args.cabinCategoryId} occupancy=${args.occupancy}${
          args.fareCode ? ` fareCode=${args.fareCode}` : ""
        }${args.fareVariant ? ` fareVariant=${args.fareVariant}` : ""}`,
      )
    }

    const components = await db
      .select()
      .from(cruisePriceComponents)
      .where(eq(cruisePriceComponents.priceId, price.id))

    return composeQuote({
      price,
      components,
      occupancy: args.occupancy,
      guestCount: args.guestCount,
    })
  },
}
