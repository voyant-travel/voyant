import type { AnyDrizzleDb } from "@voyant-travel/db"
import { and, eq, exists, gt, gte, isNull, or, sql } from "drizzle-orm"

import { cruiseSailings, type cruises } from "./schema-core.js"
import { cruisePrices } from "./schema-pricing.js"

type CruiseRow = typeof cruises.$inferSelect
type CruiseSailingRow = typeof cruiseSailings.$inferSelect
type CruisePriceRow = typeof cruisePrices.$inferSelect

export function currentDateIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function isCustomerCruisePriceAvailable(
  row: Pick<CruisePriceRow, "availability" | "availabilityCount">,
): boolean {
  return (
    row.availability === "available" && (row.availabilityCount == null || row.availabilityCount > 0)
  )
}

export function filterCustomerBookableCruiseSailings(
  sailings: ReadonlyArray<CruiseSailingRow>,
  prices: ReadonlyArray<CruisePriceRow>,
  asOfDate: string = currentDateIso(),
): CruiseSailingRow[] {
  const availableSailingIds = new Set(
    prices.filter(isCustomerCruisePriceAvailable).map((price) => price.sailingId),
  )
  return sailings.filter(
    (sailing) =>
      sailing.salesStatus === "open" &&
      dateValue(sailing.departureDate) >= asOfDate &&
      availableSailingIds.has(sailing.id),
  )
}

export async function isCustomerCruiseBookable(
  db: AnyDrizzleDb,
  row: CruiseRow,
  asOfDate: string = currentDateIso(),
): Promise<boolean> {
  if (row.status !== "live") return false

  const priceRows = await db
    .select()
    .from(cruisePrices)
    .where(
      and(
        eq(cruisePrices.availability, "available"),
        or(isNull(cruisePrices.availabilityCount), gt(cruisePrices.availabilityCount, 0)),
        exists(
          db
            .select({ one: sql`1` })
            .from(cruiseSailings)
            .where(
              and(
                eq(cruiseSailings.id, cruisePrices.sailingId),
                eq(cruiseSailings.cruiseId, row.id),
                eq(cruiseSailings.salesStatus, "open"),
                gte(cruiseSailings.departureDate, asOfDate),
              ),
            ),
        ),
      ),
    )
    .limit(1)
  return priceRows.some((price) => isCustomerCruisePriceAvailable(price))
}

function dateValue(value: string | Date): string {
  return typeof value === "string" ? value : value.toISOString().slice(0, 10)
}
