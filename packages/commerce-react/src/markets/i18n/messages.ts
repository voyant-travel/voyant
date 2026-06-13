import type {
  CreateMarketInput,
  MarketCurrencyRecord,
  MarketLocaleRecord,
  MarketRecord,
} from "../index.js"

export type MarketStatus = NonNullable<CreateMarketInput["status"]>
export type MarketLocaleLanguageTag = MarketLocaleRecord["languageTag"]
export type MarketCurrencyCode = MarketCurrencyRecord["currencyCode"]
export type MarketRegionCode = MarketRecord["regionCode"]
export type MarketCountryCode = MarketRecord["countryCode"]

export type MarketsUiMessages = {
  common: {
    cancel: string
    saveChanges: string
    active: string
    default: string
    marketStatusLabels: Record<MarketStatus, string>
  }
  marketDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      code: string
      name: string
      status: string
      regionCode: string
      country: string
      languageTag: string
      defaultCurrency: string
      timezone: string
      taxContext: string
    }
    placeholders: {
      code: string
      name: string
      regionCode: string
      languageTag: string
      timezone: string
      taxContext: string
    }
    actions: {
      create: string
    }
    validation: {
      codeRequired: string
      nameRequired: string
      currencyThreeChars: string
    }
  }
  marketCurrencyDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      currencyCode: string
      sortOrder: string
      isDefault: string
      isSettlement: string
      isReporting: string
      active: string
    }
    actions: {
      create: string
    }
    validation: {
      currencyThreeChars: string
    }
  }
  marketLocaleDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      languageTag: string
      sortOrder: string
      isDefault: string
      active: string
    }
    placeholders: {
      languageTag: string
    }
    actions: {
      create: string
    }
    validation: {
      languageTagRequired: string
    }
  }
}
