import { crmUiEn } from "../../../../crm-ui/src/i18n/en"

import type { RegistryCrmMessages } from "./messages"

export const registryCrmEn = {
  ...crmUiEn,
  common: {
    ...crmUiEn.common,
    opportunityStatusLabels: {
      open: "Open",
      won: "Won",
      lost: "Lost",
      archived: "Archived",
    },
    quoteStatusLabels: {
      draft: "Draft",
      sent: "Sent",
      accepted: "Accepted",
      expired: "Expired",
      rejected: "Rejected",
      archived: "Archived",
    },
  },
  createQuoteDialog: {
    title: "New quote",
    fields: {
      opportunity: "Opportunity",
      currency: "Currency",
      validUntil: "Valid until",
    },
    placeholders: {
      searchOpportunities: "Search opportunities...",
      pickDate: "Pick a date",
    },
    empty: {
      loading: "Loading...",
      noOpportunities: "No opportunities found.",
      noCurrencies: "No currency found.",
    },
    validation: {
      selectOpportunity: "Please select an opportunity",
      selectCurrency: "Please select a currency",
      createFailed: "Failed to create quote",
    },
    actions: {
      create: "Create",
    },
  },
  opportunitiesBoard: {
    fallbackName: "Unnamed stage",
  },
  opportunitySummaryCard: {
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
      openOpportunities: "Open opportunities",
      pipelineValue: "Pipeline value",
      won: "Won",
    },
    tabs: {
      overview: "Overview",
      people: "People",
      opportunities: "Opportunities",
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
      noOpportunities: "No opportunities.",
      noActivities: "No activities yet.",
    },
    hint: "Fields update on the left panel. Hover to reveal the edit icon.",
  },
  quoteLinesCard: {
    title: "Line items",
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
  quotesPage: {
    title: "Quotes",
    description: "Quotes issued for opportunities in your pipeline.",
    create: "New quote",
    filters: {
      status: "Status",
      allStatuses: "All statuses",
    },
    columns: {
      quote: "Quote",
      status: "Status",
      total: "Total",
      validUntil: "Valid until",
      updated: "Updated",
    },
    loadFailed: "Failed to load quotes.",
    empty: "No quotes found.",
  },
} satisfies RegistryCrmMessages
