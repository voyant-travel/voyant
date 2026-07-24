import type { MarketsUiMessages } from "./messages.js"

export const marketsUiRo = {
  settingsPage: {
    title: "Piete",
    description: "Gestioneaza regiunile de vanzare, limbile, monedele si regulile fiscale.",
    empty: "Nu exista piete configurate.",
    add: "Adauga piata",
  },
  common: {
    cancel: "Anuleaza",
    saveChanges: "Salveaza Modificarile",
    active: "Activ",
    default: "Implicit",
    marketStatusLabels: {
      active: "Activ",
      inactive: "Inactiv",
      archived: "Arhivat",
    },
  },
  marketDialog: {
    titles: {
      create: "Adauga Piata",
      edit: "Editeaza Piata",
    },
    fields: {
      code: "Cod",
      name: "Nume",
      status: "Status",
      regionCode: "Cod regiune",
      country: "Tara",
      languageTag: "Eticheta limba",
      defaultCurrency: "Moneda implicita",
      timezone: "Fus orar",
      taxContext: "Reguli fiscale",
    },
    placeholders: {
      code: "EU-DE",
      name: "Germania",
      regionCode: "EU, APAC...",
      languageTag: "en, de-DE...",
      timezone: "Europe/Berlin",
      taxContext: "EU-VAT, US-Sales-Tax...",
    },
    actions: {
      create: "Adauga Piata",
    },
    validation: {
      codeRequired: "Codul este obligatoriu",
      nameRequired: "Numele este obligatoriu",
      currencyThreeChars: "Moneda trebuie sa aiba 3 caractere",
    },
  },
  marketCurrencyDialog: {
    titles: {
      create: "Adauga Moneda",
      edit: "Editeaza Moneda",
    },
    fields: {
      currencyCode: "Cod moneda",
      sortOrder: "Ordine",
      isDefault: "Implicit",
      isSettlement: "Decontare",
      isReporting: "Raportare",
      active: "Activ",
    },
    actions: {
      create: "Adauga Moneda",
    },
    validation: {
      currencyThreeChars: "Moneda trebuie sa aiba 3 caractere",
    },
  },
  marketLocaleDialog: {
    titles: {
      create: "Adauga Limba",
      edit: "Editeaza Limba",
    },
    fields: {
      languageTag: "Eticheta limba",
      sortOrder: "Ordine",
      isDefault: "Implicit",
      active: "Activ",
    },
    placeholders: {
      languageTag: "en-GB, de-DE...",
    },
    actions: {
      create: "Adauga Limba",
    },
    validation: {
      languageTagRequired: "Eticheta limbii este obligatorie",
    },
  },
} satisfies MarketsUiMessages
