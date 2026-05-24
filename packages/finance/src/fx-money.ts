import { and, desc, eq, isNull, lte, or } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type {
  InvoiceExchangeRateResolution,
  InvoiceFxOptions,
  InvoiceFxSettings,
  ResolveInvoiceExchangeRateInput,
} from "./invoice-fx.js"
import { exchangeRatesRef } from "./markets-ref.js"

export type FxMoneyInput = {
  amountCents: number
  currency: string
  baseCurrency?: string | null
  baseAmountCents?: number | null
  fxRateSetId?: string | null
}

export type ResolveFxMoneyBaseAmountOptions = InvoiceFxOptions & {
  targetBaseCurrency?: string | null
  fallbackFxRateSetId?: string | null
  date?: string | Date | null
  setBaseCurrencyWhenUnresolved?: boolean
}

type PersistedRate = {
  rate: number
  fxRateSetId: string
}

export async function resolveFxMoneyBaseAmount<T extends FxMoneyInput>(
  db: PostgresJsDatabase,
  input: T,
  options: ResolveFxMoneyBaseAmountOptions = {},
): Promise<T> {
  const settings = await resolveConfiguredFxSettings(db, options)
  const currency = normalizeCurrency(input.currency) ?? input.currency
  const configuredBaseCurrency = normalizeCurrency(settings?.baseCurrency)
  const targetBaseCurrency =
    normalizeCurrency(input.baseCurrency) ??
    normalizeCurrency(options.targetBaseCurrency) ??
    configuredBaseCurrency

  if (!targetBaseCurrency) {
    return {
      ...input,
      currency,
      baseCurrency: normalizeCurrency(input.baseCurrency) ?? input.baseCurrency ?? null,
      fxRateSetId: normalizeOptionalText(input.fxRateSetId) ?? input.fxRateSetId ?? null,
    }
  }

  const existingBaseAmountCents = normalizeAmount(input.baseAmountCents)
  const fallbackFxRateSetId =
    normalizeOptionalText(input.fxRateSetId) ??
    normalizeOptionalText(options.fallbackFxRateSetId) ??
    null

  if (existingBaseAmountCents !== null) {
    return {
      ...input,
      currency,
      baseCurrency: targetBaseCurrency,
      baseAmountCents: existingBaseAmountCents,
      fxRateSetId: currency === targetBaseCurrency ? null : fallbackFxRateSetId,
    }
  }

  if (currency === targetBaseCurrency) {
    return {
      ...input,
      currency,
      baseCurrency: targetBaseCurrency,
      baseAmountCents: input.amountCents,
      fxRateSetId: null,
    }
  }

  const persistedRate = await resolvePersistedExchangeRate(db, currency, targetBaseCurrency, {
    fxRateSetId: fallbackFxRateSetId,
    date: options.date,
  })
  const resolvedRate = persistedRate
    ? { rate: persistedRate.rate, fxRateSetId: persistedRate.fxRateSetId }
    : await resolveRuntimeExchangeRate(currency, targetBaseCurrency, options)

  if (!resolvedRate) {
    return {
      ...input,
      currency,
      baseCurrency: options.setBaseCurrencyWhenUnresolved
        ? targetBaseCurrency
        : (normalizeCurrency(input.baseCurrency) ?? input.baseCurrency ?? null),
      baseAmountCents: input.baseAmountCents ?? null,
      fxRateSetId: fallbackFxRateSetId,
    }
  }

  const fxCommissionBps = normalizeBasisPoints(settings?.fxCommissionBps)
  const effectiveRate = resolvedRate.rate * (1 + fxCommissionBps / 10_000)

  return {
    ...input,
    currency,
    baseCurrency: targetBaseCurrency,
    baseAmountCents: Math.round(input.amountCents * effectiveRate),
    fxRateSetId: resolvedRate.fxRateSetId ?? null,
  }
}

async function resolveConfiguredFxSettings(
  db: PostgresJsDatabase,
  options: InvoiceFxOptions,
): Promise<InvoiceFxSettings | null> {
  if (options.invoiceFxSettings !== undefined) return options.invoiceFxSettings
  return (await options.resolveInvoiceFxSettings?.(db)) ?? null
}

async function resolveRuntimeExchangeRate(
  baseCurrency: string,
  quoteCurrency: string,
  options: ResolveFxMoneyBaseAmountOptions,
) {
  if (!options.resolveInvoiceExchangeRate) return null

  const input: ResolveInvoiceExchangeRateInput = {
    baseCurrency,
    quoteCurrency,
    date: toDateString(options.date),
  }

  try {
    return normalizeExchangeRateResolution(await options.resolveInvoiceExchangeRate(input))
  } catch (error) {
    try {
      await options.onInvoiceFxResolutionError?.(error, input)
    } catch {
      // FX resolution failure hooks should not mask the original write path.
    }
    return null
  }
}

async function resolvePersistedExchangeRate(
  db: PostgresJsDatabase,
  baseCurrency: string,
  quoteCurrency: string,
  options: { fxRateSetId?: string | null; date?: string | Date | null },
): Promise<PersistedRate | null> {
  if (options.fxRateSetId) {
    return (
      (await queryPersistedExchangeRate(db, baseCurrency, quoteCurrency, {
        fxRateSetId: options.fxRateSetId,
      })) ??
      (await queryPersistedExchangeRate(db, quoteCurrency, baseCurrency, {
        fxRateSetId: options.fxRateSetId,
        inverse: true,
      }))
    )
  }

  const asOf = toDateEnd(options.date)
  return (
    (await queryPersistedExchangeRate(db, baseCurrency, quoteCurrency, { asOf })) ??
    (await queryPersistedExchangeRate(db, quoteCurrency, baseCurrency, {
      asOf,
      inverse: true,
    })) ??
    (await queryPersistedExchangeRate(db, baseCurrency, quoteCurrency, {})) ??
    (await queryPersistedExchangeRate(db, quoteCurrency, baseCurrency, { inverse: true }))
  )
}

async function queryPersistedExchangeRate(
  db: PostgresJsDatabase,
  baseCurrency: string,
  quoteCurrency: string,
  options: { fxRateSetId?: string | null; asOf?: Date | null; inverse?: boolean },
): Promise<PersistedRate | null> {
  const conditions = [
    eq(exchangeRatesRef.baseCurrency, baseCurrency),
    eq(exchangeRatesRef.quoteCurrency, quoteCurrency),
  ]
  if (options.fxRateSetId) {
    conditions.push(eq(exchangeRatesRef.fxRateSetId, options.fxRateSetId))
  }
  if (options.asOf) {
    const asOfCondition = or(
      isNull(exchangeRatesRef.observedAt),
      lte(exchangeRatesRef.observedAt, options.asOf),
    )
    if (asOfCondition) conditions.push(asOfCondition)
  }

  const [row] = await db
    .select({
      fxRateSetId: exchangeRatesRef.fxRateSetId,
      rateDecimal: exchangeRatesRef.rateDecimal,
      inverseRateDecimal: exchangeRatesRef.inverseRateDecimal,
    })
    .from(exchangeRatesRef)
    .where(and(...conditions))
    .orderBy(desc(exchangeRatesRef.observedAt), desc(exchangeRatesRef.createdAt))
    .limit(1)

  if (!row) return null
  const rate = options.inverse
    ? (normalizeRate(row.inverseRateDecimal) ?? inverseRate(row.rateDecimal))
    : normalizeRate(row.rateDecimal)

  return rate ? { rate, fxRateSetId: row.fxRateSetId } : null
}

function normalizeExchangeRateResolution(
  resolution: number | InvoiceExchangeRateResolution | null | undefined,
): (InvoiceExchangeRateResolution & { fxRateSetId?: string }) | null {
  if (typeof resolution === "number") {
    return Number.isFinite(resolution) && resolution > 0 ? { rate: resolution } : null
  }
  if (!resolution || typeof resolution !== "object") return null
  if (typeof resolution.rate !== "number" || !Number.isFinite(resolution.rate)) return null
  if (resolution.rate <= 0) return null

  const fxRateSetId = normalizeOptionalText(resolution.fxRateSetId)
  return {
    rate: resolution.rate,
    ...(fxRateSetId ? { fxRateSetId } : {}),
  }
}

function normalizeAmount(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null
}

function normalizeRate(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value ?? "")
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function inverseRate(value: string | number | null | undefined) {
  const rate = normalizeRate(value)
  return rate ? 1 / rate : null
}

function normalizeBasisPoints(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : 0
}

function normalizeCurrency(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase()
  return normalized ? normalized : null
}

function normalizeOptionalText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

function toDateString(value: string | Date | null | undefined) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function toDateEnd(value: string | Date | null | undefined) {
  if (value instanceof Date) return value
  if (!value) return null
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T23:59:59.999Z`)
    : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
