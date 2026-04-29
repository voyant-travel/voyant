import type { RegistryMarketsMessages } from "./messages"

export const registryMarketsRo = {
  page: {
    title: "Piete",
    description: "Piete geografice cu moneda, limba si contextul fiscal implicit.",
    addMarket: "Adauga piata",
    empty: {
      loading: "Se incarca pietele...",
      noMarkets: "Nu exista piete inca.",
    },
    selected: {
      title: "Configurare",
      close: "Inchide",
    },
    columns: {
      code: "Cod",
      name: "Nume",
      country: "Tara",
      language: "Limba",
      currency: "Moneda",
      status: "Status",
      configure: "Configureaza",
    },
    actions: {
      deleteConfirm: "Stergi piata?",
    },
  },
  currenciesTab: {
    description: "Monede acceptate pentru afisare, decontare si raportare in aceasta piata.",
    add: "Adauga moneda",
    empty: {
      loading: "Se incarca monedele...",
      noCurrencies: "Nu exista monede inca.",
    },
    columns: {
      currency: "Moneda",
      default: "Implicita",
      settlement: "Decontare",
      reporting: "Raportare",
      sort: "Ordine",
      status: "Status",
    },
    values: {
      yes: "Da",
    },
    actions: {
      deleteConfirm: "Stergi moneda?",
    },
  },
  localesTab: {
    description: "Limbile suportate pentru aceasta piata.",
    add: "Adauga limba",
    empty: {
      loading: "Se incarca limbile...",
      noLocales: "Nu exista limbi inca.",
    },
    columns: {
      language: "Limba",
      default: "Implicita",
      sort: "Ordine",
      status: "Status",
    },
    actions: {
      deleteConfirm: "Stergi limba?",
    },
  },
} satisfies RegistryMarketsMessages
