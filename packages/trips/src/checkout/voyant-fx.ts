import type { FxQuote } from "./types.js"

export interface VoyantFxQuoteOptions {
  apiKey: string
  baseUrl?: string
  fetch?: typeof globalThis.fetch
}

/** Voyant Data FX client used by the Trips checkout runtime. */
export function createVoyantFxQuoter(options: VoyantFxQuoteOptions) {
  return async (sourceCurrency: string, targetCurrency: string): Promise<FxQuote> => {
    if (sourceCurrency === targetCurrency) {
      return { rate: 1, quotedAt: new Date().toISOString(), validUntil: null }
    }

    const url = new URL(
      `/data/fx/v1/fx/pair/${encodeURIComponent(sourceCurrency)}/${encodeURIComponent(targetCurrency)}`,
      `${(options.baseUrl ?? "https://api.voyant.travel").replace(/\/$/, "")}/`,
    )
    const response = await (options.fetch ?? globalThis.fetch)(url, {
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        "x-voyant-sdk": "voyant-trips",
      },
    })
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
    if (!response.ok) throw new Error(`trip_checkout_fx_quote_failed:${response.status}`)

    const body = asRecord(payload?.data) ?? payload
    const rate = numberValue(body?.conversionRate) ?? numberValue(body?.conversion_rate)
    if (!rate || rate <= 0) throw new Error("trip_checkout_fx_quote_invalid")

    return {
      rate,
      quotedAt:
        stringValue(body?.timeLastUpdateUtc) ??
        stringValue(body?.time_last_update_utc) ??
        unixSecondsToIso(
          numberValue(body?.timeLastUpdateUnix) ?? numberValue(body?.time_last_update_unix),
        ) ??
        new Date().toISOString(),
      validUntil:
        stringValue(body?.timeNextUpdateUtc) ??
        stringValue(body?.time_next_update_utc) ??
        unixSecondsToIso(
          numberValue(body?.timeNextUpdateUnix) ?? numberValue(body?.time_next_update_unix),
        ),
    }
  }
}

function unixSecondsToIso(value: number | null): string | null {
  return value && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}
