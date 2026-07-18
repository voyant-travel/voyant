import type { reportFieldValueTypeSchema } from "@voyant-travel/reporting-contracts"
import type { z } from "zod"

export type ReportFieldValueType = z.infer<typeof reportFieldValueTypeSchema>

export interface FormatOptions {
  /** BCP-47 locale for `Intl` formatters. */
  locale?: string
  /** ISO currency code used when the value type is `currency`. */
  currency?: string
  /** IANA time zone for date/datetime formatting. */
  timeZone?: string
}

/**
 * Format a raw report cell value for display, keyed by its declared field value
 * type. Deliberately dataset-semantics-neutral: it never rescales values (e.g.
 * it does not assume currency is stored in minor units), it only presents them.
 */
export function formatReportValue(
  value: unknown,
  valueType: ReportFieldValueType,
  options: FormatOptions = {},
): string {
  if (value === null || value === undefined) return "—"
  const { locale, currency = "USD", timeZone } = options

  switch (valueType) {
    case "integer":
    case "number": {
      const numeric = toNumber(value)
      return numeric === undefined ? String(value) : new Intl.NumberFormat(locale).format(numeric)
    }
    case "currency": {
      const numeric = toNumber(value)
      if (numeric === undefined) return String(value)
      return new Intl.NumberFormat(locale, { style: "currency", currency }).format(numeric)
    }
    case "boolean":
      return value ? "Yes" : "No"
    case "date": {
      const date = toDate(value)
      return date
        ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(date)
        : String(value)
    }
    case "datetime": {
      const date = toDate(value)
      return date
        ? new Intl.DateTimeFormat(locale, {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone,
          }).format(date)
        : String(value)
    }
    case "json":
      return typeof value === "string" ? value : JSON.stringify(value)
    default:
      return String(value)
  }
}

/** Coerce a report cell into a finite number, or `undefined` if it is not numeric. */
export function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function toDate(value: unknown): Date | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? undefined : date
  }
  return undefined
}
