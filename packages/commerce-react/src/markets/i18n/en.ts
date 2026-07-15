import type { MarketsUiMessages } from "./messages.js"

export const marketsUiEn = {
  settingsPage: {
    title: "Markets",
    description: "Manage selling regions, default languages, currencies, and tax context.",
    empty: "No markets configured yet.",
    add: "Add market",
  },
  common: {
    cancel: "Cancel",
    saveChanges: "Save Changes",
    active: "Active",
    default: "Default",
    marketStatusLabels: {
      active: "Active",
      inactive: "Inactive",
      archived: "Archived",
    },
  },
  marketDialog: {
    titles: {
      create: "Add Market",
      edit: "Edit Market",
    },
    fields: {
      code: "Code",
      name: "Name",
      status: "Status",
      regionCode: "Region code",
      country: "Country",
      languageTag: "Language tag",
      defaultCurrency: "Default currency",
      timezone: "Timezone",
      taxContext: "Tax context",
    },
    placeholders: {
      code: "EU-DE",
      name: "Germany",
      regionCode: "EU, APAC...",
      languageTag: "en, de-DE...",
      timezone: "Europe/Berlin",
      taxContext: "EU-VAT, US-Sales-Tax...",
    },
    actions: {
      create: "Add Market",
    },
    validation: {
      codeRequired: "Code is required",
      nameRequired: "Name is required",
      currencyThreeChars: "Currency must be 3 chars",
    },
  },
  marketCurrencyDialog: {
    titles: {
      create: "Add Currency",
      edit: "Edit Currency",
    },
    fields: {
      currencyCode: "Currency code",
      sortOrder: "Sort order",
      isDefault: "Default",
      isSettlement: "Settlement",
      isReporting: "Reporting",
      active: "Active",
    },
    actions: {
      create: "Add Currency",
    },
    validation: {
      currencyThreeChars: "Currency must be 3 chars",
    },
  },
  marketLocaleDialog: {
    titles: {
      create: "Add Locale",
      edit: "Edit Locale",
    },
    fields: {
      languageTag: "Language tag",
      sortOrder: "Sort order",
      isDefault: "Default",
      active: "Active",
    },
    placeholders: {
      languageTag: "en-GB, de-DE...",
    },
    actions: {
      create: "Add Locale",
    },
    validation: {
      languageTagRequired: "Language tag is required",
    },
  },
} satisfies MarketsUiMessages
