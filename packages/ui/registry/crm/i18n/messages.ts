import type { CrmUiMessages } from "../../../../crm-ui/src/i18n/messages"

export type RegistryCrmMessages = CrmUiMessages & {
  common: CrmUiMessages["common"] & {
    opportunityStatusLabels: {
      open: string
      won: string
      lost: string
      archived: string
    }
    quoteStatusLabels: {
      draft: string
      sent: string
      accepted: string
      expired: string
      rejected: string
      archived: string
    }
  }
  createQuoteDialog: {
    title: string
    fields: {
      opportunity: string
      currency: string
      validUntil: string
    }
    placeholders: {
      searchOpportunities: string
      pickDate: string
    }
    empty: {
      loading: string
      noOpportunities: string
      noCurrencies: string
    }
    validation: {
      selectOpportunity: string
      selectCurrency: string
      createFailed: string
    }
    actions: {
      create: string
    }
  }
  opportunitiesBoard: {
    fallbackName: string
  }
  opportunitySummaryCard: {
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
      openOpportunities: string
      pipelineValue: string
      won: string
    }
    tabs: {
      overview: string
      people: string
      opportunities: string
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
      noOpportunities: string
      noActivities: string
    }
    hint: string
  }
  quoteLinesCard: {
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
  quotesPage: {
    title: string
    description: string
    create: string
    filters: {
      status: string
      allStatuses: string
    }
    columns: {
      quote: string
      status: string
      total: string
      validUntil: string
      updated: string
    }
    loadFailed: string
    empty: string
  }
}
