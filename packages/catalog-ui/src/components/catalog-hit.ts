import type { CatalogSearchHit } from "@voyantjs/catalog-react"

/**
 * Field-access helpers shared between the catalog table columns
 * (`catalog-page`) and the merchandising card (`catalog-card`). A search hit
 * carries its indexer document under `document.fields`; values are weakly
 * typed (`unknown`) because the index is vertical-agnostic, so every read
 * coerces defensively.
 */

/** Coerce a raw field value to a non-empty string, else `null`. */
export function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

/** Coerce a raw field value to a finite number, else `null`. */
export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Coerce a raw field value to a string array (dropping empties). */
export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === "string" && v.length > 0)
}

/** Read a string field off a hit, falling back to the supplied value. */
export function stringField<T>(hit: CatalogSearchHit, key: string, fallback: T): string | T {
  const v = hit.document.fields[key]
  return typeof v === "string" && v.length > 0 ? v : fallback
}

/** Read a numeric field off a hit, else `null`. */
export function numberField(hit: CatalogSearchHit, key: string): number | null {
  return asNumber(hit.document.fields[key])
}

/**
 * Format a money field pair (integer cents + ISO currency) as a localized
 * currency string with no fractional digits. Returns `null` when either side
 * is missing.
 */
export function formatHitPrice(
  hit: CatalogSearchHit,
  amountField: string,
  currencyField: string,
  unit: "minor" | "major" = "minor",
): string | null {
  const amount = numberField(hit, amountField)
  const currency = stringField(hit, currencyField, null)
  if (amount == null || !currency) return null
  // Most verticals index integer cents (`*AmountCents`); cruises cache the
  // "from" price in major currency units (`lowestPriceCached` = "5898.00").
  const major = unit === "major" ? amount : amount / 100
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(major)
}
