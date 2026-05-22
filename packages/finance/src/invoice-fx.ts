import type { Extension } from "@voyantjs/core"
import { ApiHttpError, parseJsonBody } from "@voyantjs/hono"
import type { HonoExtension } from "@voyantjs/hono/module"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Hono } from "hono"
import { Hono as HonoApp } from "hono"
import { z } from "zod"

import type { Env } from "./routes-shared.js"

export type InvoiceFxSettings = {
  baseCurrency?: string | null
  fxCommissionBps?: number | null
  fxCommissionInvoiceMention?: string | null
}

export type ResolveInvoiceFxSettings = (
  db: PostgresJsDatabase,
) => InvoiceFxSettings | null | undefined | Promise<InvoiceFxSettings | null | undefined>

export type UpdateInvoiceFxSettings = (
  db: PostgresJsDatabase,
  settings: InvoiceFxSettings,
) => InvoiceFxSettings | null | undefined | Promise<InvoiceFxSettings | null | undefined>

export type ResolveInvoiceExchangeRateInput = {
  /** Currency being invoiced, e.g. EUR. */
  baseCurrency: string
  /** Operator accounting/reporting currency, e.g. RON. */
  quoteCurrency: string
  date?: string
}

export type ResolveInvoiceExchangeRate = (
  input: ResolveInvoiceExchangeRateInput,
) => number | null | undefined | Promise<number | null | undefined>

export interface InvoiceFxOptions {
  invoiceFxSettings?: InvoiceFxSettings | null
  resolveInvoiceFxSettings?: ResolveInvoiceFxSettings
  updateInvoiceFxSettings?: UpdateInvoiceFxSettings
  resolveInvoiceExchangeRate?: ResolveInvoiceExchangeRate
}

export interface InvoiceFxRouteOptions extends InvoiceFxOptions {}

export type InvoiceFxInvoice = {
  currency: string
  baseCurrency?: string | null
  issueDate?: string | Date | null
}

export type InvoiceFxContext = {
  baseCurrency: string
  fxRate: number
  fxCommissionBps: number
  effectiveRate: number
  fxCommissionInvoiceMention?: string
}

export type ResolvedInvoiceFxSettings = {
  baseCurrency: string
  fxCommissionBps: number
  fxCommissionInvoiceMention?: string
}

export type VoyantDataFxResolverOptions = {
  baseUrl?: string
  apiKey: string
  authHeader?: string
  authScheme?: string | null
  fetch?: typeof fetch
}

const DEFAULT_DATA_BASE_URL = "https://api.voyantjs.com"

const invoiceFxSettingsPatchSchema = z.object({
  baseCurrency: z.string().min(3).max(8).nullable().optional(),
  fxCommissionBps: z.number().int().min(0).max(100_000).nullable().optional(),
  fxCommissionInvoiceMention: z.string().nullable().optional(),
})

export async function resolveInvoiceFxSettingsOrDefault(
  db: PostgresJsDatabase,
  options: InvoiceFxOptions = {},
): Promise<ResolvedInvoiceFxSettings> {
  const settings = await resolveConfiguredInvoiceFxSettings(db, options)

  return {
    baseCurrency: normalizeCurrency(settings?.baseCurrency) ?? "RON",
    fxCommissionBps: normalizeBasisPoints(settings?.fxCommissionBps),
    fxCommissionInvoiceMention: normalizeOptionalText(settings?.fxCommissionInvoiceMention),
  }
}

export async function resolveInvoiceFxContext(
  db: PostgresJsDatabase,
  invoice: InvoiceFxInvoice,
  options: InvoiceFxOptions = {},
): Promise<InvoiceFxContext | null> {
  const settings = await resolveConfiguredInvoiceFxSettings(db, options)
  const baseCurrency =
    normalizeCurrency(settings?.baseCurrency) ?? normalizeCurrency(invoice.baseCurrency) ?? "RON"
  const invoiceCurrency = normalizeCurrency(invoice.currency)

  if (!baseCurrency || !invoiceCurrency || invoiceCurrency === baseCurrency) return null
  if (!options.resolveInvoiceExchangeRate) return null

  const fxRate = await options.resolveInvoiceExchangeRate({
    baseCurrency: invoiceCurrency,
    quoteCurrency: baseCurrency,
    date: toDateString(invoice.issueDate),
  })

  if (typeof fxRate !== "number" || !Number.isFinite(fxRate) || fxRate <= 0) return null

  const fxCommissionBps = normalizeBasisPoints(settings?.fxCommissionBps)
  const effectiveRate = roundRate(fxRate * (1 + fxCommissionBps / 10_000))

  return {
    baseCurrency,
    fxRate: roundRate(fxRate),
    fxCommissionBps,
    effectiveRate,
    ...(fxCommissionBps > 0 && normalizeOptionalText(settings?.fxCommissionInvoiceMention)
      ? { fxCommissionInvoiceMention: normalizeOptionalText(settings?.fxCommissionInvoiceMention) }
      : {}),
  }
}

export function createVoyantDataFxExchangeRateResolver(
  options: VoyantDataFxResolverOptions,
): ResolveInvoiceExchangeRate {
  const fetchImpl = options.fetch ?? fetch
  const baseUrl = options.baseUrl ?? DEFAULT_DATA_BASE_URL
  const authHeader = options.authHeader ?? "authorization"
  const authScheme = options.authScheme === undefined ? "Bearer" : options.authScheme

  return async ({ baseCurrency, quoteCurrency }) => {
    const url = new URL(
      `/data/fx/v1/fx/pair/${encodeURIComponent(baseCurrency)}/${encodeURIComponent(
        quoteCurrency,
      )}`,
      baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
    )
    const headers = new Headers()
    headers.set(authHeader, authScheme ? `${authScheme} ${options.apiKey}` : options.apiKey)
    headers.set("x-voyant-sdk", "voyant-finance")

    const response = await fetchImpl(url, { headers })
    const body = (await response.json()) as Record<string, unknown>
    if (!response.ok) {
      throw new Error(`Voyant Data FX request failed with status ${response.status}`)
    }

    const rate = body.conversionRate ?? body.conversion_rate
    return typeof rate === "number" && Number.isFinite(rate) ? rate : null
  }
}

export function createInvoiceFxRoutes(options: InvoiceFxRouteOptions = {}) {
  return new HonoApp<Env>()
    .get("/invoice-fx-settings", async (c) => {
      return c.json({
        data: await resolveInvoiceFxSettingsOrDefault(c.get("db"), options),
      })
    })
    .patch("/invoice-fx-settings", async (c) => {
      if (!options.updateInvoiceFxSettings) {
        throw new ApiHttpError("Invoice FX settings updates are not configured", {
          status: 501,
          code: "invoice_fx_settings_update_not_configured",
        })
      }

      const current = await resolveInvoiceFxSettingsOrDefault(c.get("db"), options)
      const patch = await parseJsonBody(c, invoiceFxSettingsPatchSchema)
      const next = await options.updateInvoiceFxSettings(c.get("db"), {
        ...current,
        ...patch,
      })

      return c.json({
        data: await resolveInvoiceFxSettingsOrDefault(c.get("db"), { invoiceFxSettings: next }),
      })
    })
}

export function mountInvoiceFxRoutes(hono: Hono, options: InvoiceFxRouteOptions = {}): Hono {
  hono.route("/v1/admin/finance", createInvoiceFxRoutes(options))
  return hono
}

export function createInvoiceFxHonoExtension(options: InvoiceFxRouteOptions = {}): HonoExtension {
  const extension: Extension = {
    name: "finance.invoice-fx",
    module: "finance",
  }

  return {
    extension,
    adminRoutes: createInvoiceFxRoutes(options),
    routes: createInvoiceFxRoutes(options),
  }
}

async function resolveConfiguredInvoiceFxSettings(
  db: PostgresJsDatabase,
  options: InvoiceFxOptions,
) {
  return options.invoiceFxSettings !== undefined
    ? options.invoiceFxSettings
    : ((await options.resolveInvoiceFxSettings?.(db)) ?? null)
}

function normalizeCurrency(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase()
  return normalized ? normalized : null
}

function normalizeBasisPoints(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : 0
}

function normalizeOptionalText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

function toDateString(value: string | Date | null | undefined) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function roundRate(value: number) {
  return Number(value.toFixed(8))
}
