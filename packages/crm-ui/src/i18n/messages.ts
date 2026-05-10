export const crmRelationTypes = ["client", "partner", "supplier", "other"] as const
export const crmRecordStatuses = ["active", "inactive", "archived"] as const
export const crmActivityTypes = ["note", "call", "email", "meeting", "task", "follow_up"] as const
export const crmActivityStatuses = ["planned", "done", "cancelled"] as const
export const crmEntityTypes = ["none", "person", "organization", "opportunity", "quote"] as const
export const crmOpportunityStatuses = ["open", "won", "lost", "archived"] as const
export const crmQuoteStatuses = [
  "draft",
  "sent",
  "accepted",
  "expired",
  "rejected",
  "archived",
] as const

export type CrmRelationType = (typeof crmRelationTypes)[number]
export type CrmRecordStatus = (typeof crmRecordStatuses)[number]
export type CrmActivityType = (typeof crmActivityTypes)[number]
export type CrmActivityStatus = (typeof crmActivityStatuses)[number]
export type CrmEntityType = (typeof crmEntityTypes)[number]
export type CrmOpportunityStatus = (typeof crmOpportunityStatuses)[number]
export type CrmQuoteStatus = (typeof crmQuoteStatuses)[number]

export type CrmUiMessages = {
  common: {
    cancel: string
    saveChanges: string
    create: string
    saving: string
    none: string
    unknownError: string
    today: string
    previous: string
    next: string
    page: string
    pageSummary: string
    loading: string
    activityTypeLabels: Record<CrmActivityType, string>
    activityStatusLabels: Record<CrmActivityStatus, string>
    relationTypeLabels: Record<CrmRelationType, string>
    recordStatusLabels: Record<CrmRecordStatus, string>
    entityTypeLabels: Record<CrmEntityType, string>
    opportunityStatusLabels: Record<CrmOpportunityStatus, string>
    quoteStatusLabels: Record<CrmQuoteStatus, string>
    relativeTime: {
      daysAgo: string
      weeksAgo: string
      monthsAgo: string
      yearsAgo: string
    }
  }
  organizationForm: {
    fields: {
      name: string
      legalName: string
      website: string
      industry: string
    }
    actions: {
      create: string
    }
    validation: {
      nameRequired: string
      saveFailed: string
    }
  }
  personForm: {
    fields: {
      firstName: string
      lastName: string
      jobTitle: string
      email: string
      phone: string
    }
    actions: {
      create: string
    }
    validation: {
      nameRequired: string
      saveFailed: string
    }
  }
  organizationDialog: {
    titles: {
      create: string
      edit: string
    }
    descriptions: {
      create: string
      edit: string
    }
  }
  personDialog: {
    titles: {
      create: string
      edit: string
    }
    descriptions: {
      create: string
      edit: string
    }
  }
  personCard: {
    unnamed: string
  }
  personCardConnected: {
    loadFailed: string
  }
  personList: {
    searchPlaceholder: string
    create: string
    columns: {
      name: string
      email: string
      phone: string
      relation: string
      status: string
    }
    filters: {
      button: string
      relationLabel: string
      relationAll: string
      statusLabel: string
      statusAll: string
      organizationLabel: string
      organizationAny: string
      organizationEmpty: string
      clear: string
    }
    loadFailed: string
    empty: string
  }
  peoplePage: {
    title: string
    description: string
  }
  organizationList: {
    searchPlaceholder: string
    create: string
    columns: {
      name: string
      industry: string
      relation: string
      website: string
      status: string
      updated: string
    }
    filters: {
      button: string
      relationLabel: string
      relationAll: string
      statusLabel: string
      statusAll: string
      clear: string
    }
    loadFailed: string
    empty: string
  }
  organizationsPage: {
    title: string
    description: string
  }
  createActivityDialog: {
    title: string
    description: string
    fields: {
      subject: string
      type: string
      status: string
      description: string
      linkTo: string
      entityId: string
    }
    placeholders: {
      subject: string
      entityId: string
    }
    validation: {
      subjectRequired: string
      createFailed: string
    }
  }
  createOpportunityDialog: {
    title: string
    fields: {
      title: string
      stage: string
    }
    placeholders: {
      title: string
      stage: string
    }
    validation: {
      titleRequired: string
      stageRequired: string
      createFailed: string
    }
  }
  opportunitiesBoard: {
    fallbackName: string
  }
  opportunitySummaryCard: {
    unknown: string
    expectedClose: string
  }
  inlineEditor: {
    failedToSave: string
    notSet: string
    selectPlaceholder: string
    noneOption: string
    invalidNumber: string
    minNumber: string
    maxNumber: string
    searchCurrencyPlaceholder: string
    noCurrenciesFound: string
    searchLanguagePlaceholder: string
    noLanguagesFound: string
    addTemplate: string
    addTagPlaceholder: string
    tagAlreadyAdded: string
    addTagFailed: string
    removeTagFailed: string
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
  personDetailPage: {
    notFound: string
    backToPeople: string
  }
  personDetail: {
    topBar: {
      people: string
      edit: string
      delete: string
      deleteTitle: string
      deleteDescription: string
    }
    sidebar: {
      about: string
      tags: string
      openWebsite: string
      fields: {
        firstName: string
        lastName: string
        jobTitle: string
        email: string
        phone: string
        website: string
        relation: string
        status: string
        preferredCurrency: string
        preferredLanguage: string
        birthday: string
        source: string
      }
    }
    metrics: {
      openOpportunities: string
      pipelineValue: string
      documents: string
      activities: string
    }
    tabs: {
      overview: string
      opportunities: string
      activities: string
      relationships: string
      documents: string
    }
    sections: {
      created: string
      updated: string
      organization: string
      birthday: string
      notes: string
      travelProfile: string
      dateOfBirth: string
      dietaryRequirements: string
      accessibilityNeeds: string
      passportExpiry: string
      passportIssuingCountry: string
      passportIssuingAuthority: string
      primary: string
    }
    relationshipKindLabels: {
      spouse: string
      partner: string
      parent: string
      child: string
      sibling: string
      guardian: string
      ward: string
      emergency_contact: string
      friend: string
      travel_companion: string
      other: string
    }
    documentTypeLabels: {
      passport: string
      id_card: string
      driver_license: string
      visa: string
      other: string
    }
    empty: {
      noOpportunities: string
      noActivities: string
      noRelationships: string
      noDocuments: string
      noTravelProfile: string
    }
    hint: string
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
      selectCurrency: string
      pickDate: string
    }
    empty: {
      loading: string
      noOpportunities: string
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
  activitiesPage: {
    title: string
    description: string
    create: string
    filters: {
      type: string
      status: string
      allTypes: string
      allStatuses: string
    }
    empty: string
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
