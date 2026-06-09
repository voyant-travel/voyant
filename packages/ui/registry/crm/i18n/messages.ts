import type { CrmUiMessages } from "../../../../crm-ui/src/i18n/messages"

export type RegistryCrmMessages = CrmUiMessages & {
  createQuoteVersionDialog: CrmUiMessages["createQuoteVersionDialog"] & {
    title: string
    fields: {
      quote: string
      currency: string
      validUntil: string
    }
    placeholders: {
      searchQuotes: string
      pickDate: string
    }
    empty: {
      loading: string
      noQuotes: string
      noCurrencies: string
    }
    validation: {
      selectQuote: string
      selectCurrency: string
      createFailed: string
    }
    actions: {
      create: string
    }
  }
  quotesBoard: {
    fallbackName: string
  }
  quoteSummaryCard: {
    unknown: string
    expectedClose: string
  }
  organizationDetailPage: {
    notFound: string
    backToOrganizations: string
  }
  organizationDetail: {
    topBar: {
      organizations: string
      delete: string
      deleteTitle: string
      deleteDescription: string
    }
    sidebar: {
      about: string
      tags: string
      fields: {
        name: string
        legalName: string
        website: string
        industry: string
        relation: string
        status: string
        defaultCurrency: string
        preferredLanguage: string
        paymentTerms: string
        source: string
      }
    }
    metrics: {
      people: string
      openQuotes: string
      pipelineValue: string
      won: string
    }
    tabs: {
      overview: string
      people: string
      quotes: string
      activities: string
    }
    sections: {
      created: string
      updated: string
      notes: string
    }
    empty: {
      noPeople: string
      unnamed: string
      noQuotes: string
      noActivities: string
    }
    hint: string
  }
  quoteVersionLinesCard: {
    title: string
    empty: string
    fields: {
      description: string
      quantity: string
      priceCents: string
    }
    validation: {
      descriptionRequired: string
      addFailed: string
    }
    subtotal: string
  }
  quoteVersionsPage: {
    title: string
    description: string
    create: string
    filters: {
      status: string
      allStatuses: string
    }
    columns: {
      quoteVersion: string
      status: string
      total: string
      validUntil: string
      updated: string
    }
    loadFailed: string
    empty: string
  }
}
