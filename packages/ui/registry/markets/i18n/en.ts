import type { RegistryMarketsMessages } from "./messages"

export const registryMarketsEn = {
  page: {
    title: "Markets",
    description: "Geographic markets with their default currency, language and tax context.",
    addMarket: "Add Market",
    empty: {
      loading: "Loading markets...",
      noMarkets: "No markets yet.",
    },
    selected: {
      title: "Configuring",
      close: "Close",
    },
    columns: {
      code: "Code",
      name: "Name",
      country: "Country",
      language: "Language",
      currency: "Currency",
      status: "Status",
      configure: "Configure",
    },
    actions: {
      deleteConfirm: "Delete market?",
    },
  },
  currenciesTab: {
    description: "Currencies accepted for display, settlement and reporting in this market.",
    add: "Add Currency",
    empty: {
      loading: "Loading currencies...",
      noCurrencies: "No currencies yet.",
    },
    columns: {
      currency: "Currency",
      default: "Default",
      settlement: "Settlement",
      reporting: "Reporting",
      sort: "Sort",
      status: "Status",
    },
    values: {
      yes: "Yes",
    },
    actions: {
      deleteConfirm: "Delete currency?",
    },
  },
  localesTab: {
    description: "Supported languages for this market.",
    add: "Add Locale",
    empty: {
      loading: "Loading locales...",
      noLocales: "No locales yet.",
    },
    columns: {
      language: "Language",
      default: "Default",
      sort: "Sort",
      status: "Status",
    },
    actions: {
      deleteConfirm: "Delete locale?",
    },
  },
} satisfies RegistryMarketsMessages
