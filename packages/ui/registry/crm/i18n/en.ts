import { crmUiEn } from "../../../../crm-ui/src/i18n/en"

import type { RegistryCrmMessages } from "./messages"

export const registryCrmEn = {
  ...crmUiEn,
  common: {
    ...crmUiEn.common,
  },
  createQuoteVersionDialog: {
    title: "New quote version",
    fields: {
      quote: "Quote",
      currency: "Currency",
      validUntil: "Valid until",
    },
    placeholders: {
      searchQuotes: "Search quotes...",
      pickDate: "Pick a date",
    },
    empty: {
      loading: "Loading...",
      noQuotes: "No quotes found.",
      noCurrencies: "No currency found.",
    },
    validation: {
      selectQuote: "Please select a quote",
      selectCurrency: "Please select a currency",
      createFailed: "Failed to create quote version",
    },
    actions: {
      create: "Create",
    },
  },
  quotesBoard: {
    fallbackName: "Unnamed stage",
  },
  quoteSummaryCard: {
    unknown: "Unknown",
    expectedClose: "Expected close",
  },
  organizationDetailPage: {
    notFound: "Organization not found",
    backToOrganizations: "Back to Organizations",
  },
  organizationDetail: {
    topBar: {
      organizations: "Organizations",
      delete: "Delete",
      deleteTitle: "Delete this organization?",
      deleteDescription:
        "This will permanently remove the organization. People linked to it will remain.",
    },
    sidebar: {
      about: "About",
      tags: "Tags",
      fields: {
        name: "Name",
        legalName: "Legal name",
        website: "Website",
        industry: "Industry",
        relation: "Relation",
        status: "Status",
        defaultCurrency: "Default currency",
        preferredLanguage: "Preferred language",
        paymentTerms: "Payment terms (days)",
        source: "Source",
      },
    },
    metrics: {
      people: "People",
      openQuotes: "Open quotes",
      pipelineValue: "Pipeline value",
      won: "Won",
    },
    tabs: {
      overview: "Overview",
      people: "People",
      quotes: "Quotes",
      activities: "Activities",
    },
    sections: {
      created: "Created",
      updated: "Updated",
      notes: "Notes",
    },
    empty: {
      noPeople: "No people linked to this organization.",
      unnamed: "Unnamed",
      noQuotes: "No quotes.",
      noActivities: "No activities yet.",
    },
    hint: "Fields update on the left panel. Hover to reveal the edit icon.",
  },
  quoteVersionLinesCard: {
    title: "Version line items",
    empty: "No line items yet.",
    fields: {
      description: "Description",
      quantity: "Qty",
      priceCents: "Price",
    },
    validation: {
      descriptionRequired: "Description is required",
      addFailed: "Failed to add line",
    },
    subtotal: "Subtotal",
  },
  quoteVersionsPage: {
    title: "Quote versions",
    description: "Quote versions issued for quotes in your pipeline.",
    create: "New quote version",
    filters: {
      status: "Status",
      allStatuses: "All statuses",
    },
    columns: {
      quoteVersion: "Version",
      status: "Status",
      total: "Total",
      validUntil: "Valid until",
      updated: "Updated",
    },
    loadFailed: "Failed to load quotes.",
    empty: "No quotes found.",
  },
} satisfies RegistryCrmMessages
