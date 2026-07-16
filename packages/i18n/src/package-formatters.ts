import { canonicalizeLocale, canonicalizeTimeZone } from "./locale.js"
import {
  formatIcuMessage,
  type MessageFormatOptions,
  type MessageValues,
} from "./message-format.js"

export interface LocaleFormatters {
  locale: string
  timeZone: string | null
  formatCurrency: (
    value: number | string | bigint,
    currency: string,
    options?: Omit<Intl.NumberFormatOptions, "currency" | "style">,
  ) => string
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string
  formatDateTime: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string
  formatNumber: (value: number | string | bigint, options?: Intl.NumberFormatOptions) => string
  formatMessage: (template: string, values: MessageValues) => string
}

function coerceNumber(value: number | string | bigint): number | bigint | null {
  if (typeof value === "number" || typeof value === "bigint") {
    return value
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function coerceDate(value: Date | string | number): Date | null {
  const normalizedValue =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value
  const date = normalizedValue instanceof Date ? normalizedValue : new Date(normalizedValue)
  return Number.isNaN(date.getTime()) ? null : date
}

function cacheKey(options: object | undefined): string {
  return JSON.stringify(options ?? {})
}

function boundedGetOrCreate<T>(cache: Map<string, T>, key: string, create: () => T): T {
  const existing = cache.get(key)
  if (existing) return existing
  if (cache.size >= 100) {
    const oldestKey = cache.keys().next().value
    if (oldestKey !== undefined) cache.delete(oldestKey)
  }
  const value = create()
  cache.set(key, value)
  return value
}

export function createLocaleFormatters(
  locale: string | null | undefined,
  timeZone?: string | null,
): LocaleFormatters {
  const resolvedLocale = canonicalizeLocale(locale)
  const resolvedTimeZone = canonicalizeTimeZone(timeZone)
  const numberFormatters = new Map<string, Intl.NumberFormat>()
  const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>()

  function getNumberFormatter(options: Intl.NumberFormatOptions) {
    return boundedGetOrCreate(
      numberFormatters,
      cacheKey(options),
      () => new Intl.NumberFormat(resolvedLocale, options),
    )
  }

  function getDateTimeFormatter(options: Intl.DateTimeFormatOptions | undefined) {
    const resolvedOptions = {
      ...(resolvedTimeZone ? { timeZone: resolvedTimeZone } : {}),
      ...options,
    }
    return boundedGetOrCreate(
      dateTimeFormatters,
      cacheKey(resolvedOptions),
      () => new Intl.DateTimeFormat(resolvedLocale, resolvedOptions),
    )
  }

  return {
    locale: resolvedLocale,
    timeZone: resolvedTimeZone,
    formatCurrency(value, currency, options) {
      const normalizedValue = coerceNumber(value)
      if (normalizedValue === null) {
        return `${currency} ${value}`
      }

      return getNumberFormatter({
        currency,
        style: "currency",
        ...options,
      }).format(normalizedValue)
    },
    formatDate(value, options) {
      const normalizedValue = coerceDate(value)
      if (!normalizedValue) {
        return String(value)
      }

      return getDateTimeFormatter(options).format(normalizedValue)
    },
    formatDateTime(value, options) {
      const normalizedValue = coerceDate(value)
      if (!normalizedValue) {
        return String(value)
      }

      return getDateTimeFormatter({
        dateStyle: "medium",
        timeStyle: "short",
        ...options,
      }).format(normalizedValue)
    },
    formatNumber(value, options) {
      const normalizedValue = coerceNumber(value)
      if (normalizedValue === null) {
        return String(value)
      }

      return getNumberFormatter(options ?? {}).format(normalizedValue)
    },
    formatMessage(template, values) {
      const options: MessageFormatOptions = {
        locale: resolvedLocale,
        timeZone: resolvedTimeZone,
      }
      return formatIcuMessage(template, values, options)
    },
  }
}
