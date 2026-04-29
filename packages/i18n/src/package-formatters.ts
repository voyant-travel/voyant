export interface LocaleFormatters {
  locale: string
  formatCurrency: (
    value: number | string | bigint,
    currency: string,
    options?: Omit<Intl.NumberFormatOptions, "currency" | "style">,
  ) => string
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string
  formatDateTime: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string
  formatNumber: (value: number | string | bigint, options?: Intl.NumberFormatOptions) => string
}

function normalizeLocale(locale: string | null | undefined): string {
  return (locale ?? "").trim() || "en"
}

function coerceNumber(value: number | string | bigint): number | bigint | null {
  if (typeof value === "number" || typeof value === "bigint") {
    return value
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function coerceDate(value: Date | string | number): Date | null {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function createLocaleFormatters(locale: string | null | undefined): LocaleFormatters {
  const resolvedLocale = normalizeLocale(locale)

  return {
    locale: resolvedLocale,
    formatCurrency(value, currency, options) {
      const normalizedValue = coerceNumber(value)
      if (normalizedValue === null) {
        return `${currency} ${value}`
      }

      return new Intl.NumberFormat(resolvedLocale, {
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

      return new Intl.DateTimeFormat(resolvedLocale, options).format(normalizedValue)
    },
    formatDateTime(value, options) {
      const normalizedValue = coerceDate(value)
      if (!normalizedValue) {
        return String(value)
      }

      return new Intl.DateTimeFormat(resolvedLocale, {
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

      return new Intl.NumberFormat(resolvedLocale, options).format(normalizedValue)
    },
  }
}
