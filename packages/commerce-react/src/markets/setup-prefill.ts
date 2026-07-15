export const COMMERCE_MARKET_SETUP_STEP_ID = "@voyant-travel/commerce#setup.market"

export interface MarketSetupPrefill {
  code?: string
  name?: string
  regionCode?: string
  countryCode?: string
  defaultLanguageTag?: string
  defaultCurrency?: string
  timezone?: string
  taxContext?: string
}

const fields = [
  "code",
  "name",
  "regionCode",
  "countryCode",
  "defaultLanguageTag",
  "defaultCurrency",
  "timezone",
  "taxContext",
] as const satisfies readonly (keyof MarketSetupPrefill)[]

export function parseMarketSetupPrefill(value: unknown): MarketSetupPrefill {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    fields.flatMap((field) =>
      typeof value[field] === "string" ? [[field, value[field].trim()]] : [],
    ),
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
