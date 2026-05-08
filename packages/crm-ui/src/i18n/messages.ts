export const crmRelationTypes = ["client", "partner", "supplier", "other"] as const
export const crmRecordStatuses = ["active", "inactive", "archived"] as const
export const crmActivityTypes = ["note", "call", "email", "meeting", "task", "follow_up"] as const
export const crmActivityStatuses = ["planned", "done", "cancelled"] as const
export const crmEntityTypes = ["none", "person", "organization", "opportunity", "quote"] as const

export type CrmRelationType = (typeof crmRelationTypes)[number]
export type CrmRecordStatus = (typeof crmRecordStatuses)[number]
export type CrmActivityType = (typeof crmActivityTypes)[number]
export type CrmActivityStatus = (typeof crmActivityStatuses)[number]
export type CrmEntityType = (typeof crmEntityTypes)[number]

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
}
