import type { CrmUiMessages } from "./messages.js"

export const crmUiEn = {
  common: {
    cancel: "Cancel",
    saveChanges: "Save changes",
    create: "Create",
    saving: "Saving...",
    none: "—",
    unknownError: "Unknown error",
    today: "today",
    previous: "Previous",
    next: "Next",
    page: "Page",
    pageSummary: "Showing {shown} of {total}",
    loading: "Loading...",
    activityTypeLabels: {
      note: "Note",
      call: "Call",
      email: "Email",
      meeting: "Meeting",
      task: "Task",
      follow_up: "Follow-up",
    },
    activityStatusLabels: {
      planned: "Planned",
      done: "Done",
      cancelled: "Cancelled",
    },
    relationTypeLabels: {
      client: "Client",
      partner: "Partner",
      supplier: "Supplier",
      other: "Other",
    },
    recordStatusLabels: {
      active: "Active",
      inactive: "Inactive",
      archived: "Archived",
    },
    entityTypeLabels: {
      none: "None",
      person: "Person",
      organization: "Organization",
      opportunity: "Opportunity",
      quote: "Quote",
    },
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
    relativeTime: {
      daysAgo: "{count}d ago",
      weeksAgo: "{count}w ago",
      monthsAgo: "{count}mo ago",
      yearsAgo: "{count}y ago",
    },
  },
  organizationForm: {
    fields: {
      name: "Name",
      legalName: "Legal name",
      website: "Website",
      industry: "Industry",
    },
    actions: {
      create: "Create organization",
    },
    validation: {
      nameRequired: "Organization name is required.",
      saveFailed: "Failed to save organization.",
    },
  },
  personForm: {
    fields: {
      firstName: "First name",
      lastName: "Last name",
      jobTitle: "Job title",
      email: "Email",
      phone: "Phone",
    },
    actions: {
      create: "Create person",
    },
    validation: {
      nameRequired: "First and last name are required.",
      saveFailed: "Failed to save person.",
    },
  },
  organizationDialog: {
    titles: {
      create: "New organization",
      edit: "Edit organization",
    },
    descriptions: {
      create: "Add a new company to your CRM.",
      edit: "Update company details and account metadata.",
    },
  },
  personDialog: {
    titles: {
      create: "New person",
      edit: "Edit person",
    },
    descriptions: {
      create: "Add a new person to your CRM.",
      edit: "Update contact details and reference information.",
    },
  },
  personCard: {
    unnamed: "Unnamed",
  },
  personCardConnected: {
    loadFailed: "Failed to load person:",
  },
  personList: {
    searchPlaceholder: "Search people...",
    create: "New person",
    columns: {
      name: "Name",
      email: "Email",
      phone: "Phone",
      relation: "Relation",
      status: "Status",
    },
    filters: {
      button: "Filters",
      relationLabel: "Relation",
      relationAll: "All relations",
      statusLabel: "Status",
      statusAll: "All statuses",
      organizationLabel: "Organization",
      organizationAny: "Any organization",
      organizationEmpty: "No organizations found.",
      clear: "Clear",
    },
    loadFailed: "Failed to load people.",
    empty: "No people found.",
  },
  peoplePage: {
    title: "People",
    description: "Contacts, travelers, agents, and partners across your CRM.",
  },
  organizationList: {
    searchPlaceholder: "Search organizations...",
    create: "New organization",
    columns: {
      name: "Name",
      industry: "Industry",
      relation: "Relation",
      website: "Website",
      status: "Status",
      updated: "Updated",
    },
    filters: {
      button: "Filters",
      relationLabel: "Relation",
      relationAll: "All relations",
      statusLabel: "Status",
      statusAll: "All statuses",
      clear: "Clear",
    },
    loadFailed: "Failed to load organizations.",
    empty: "No organizations found.",
  },
  organizationsPage: {
    title: "Organizations",
    description: "Companies, agencies, suppliers, and account relationships.",
  },
  createActivityDialog: {
    title: "New activity",
    description: "Log a call, email, meeting, or task.",
    fields: {
      subject: "Subject",
      type: "Type",
      status: "Status",
      description: "Description",
      linkTo: "Link to",
      entityId: "Entity ID",
    },
    placeholders: {
      subject: "Discovery call with Acme",
      entityId: "pers_...",
    },
    validation: {
      subjectRequired: "Subject is required",
      createFailed: "Failed to create activity",
    },
  },
  createOpportunityDialog: {
    title: "New opportunity",
    fields: {
      title: "Title",
      stage: "Stage",
    },
    placeholders: {
      title: "New opportunity",
      stage: "Select stage...",
    },
    validation: {
      titleRequired: "Title is required",
      stageRequired: "Stage is required",
      createFailed: "Failed to create opportunity",
    },
  },
  opportunitiesBoard: {
    fallbackName: "Unnamed stage",
  },
  opportunitySummaryCard: {
    unknown: "Unknown",
    expectedClose: "Expected close",
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
      selectCurrency: "Select currency...",
      pickDate: "Pick a date",
    },
    empty: {
      loading: "Loading...",
      noOpportunities: "No opportunities found.",
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
  quoteLinesCard: {
    title: "Line items",
    empty: "No line items yet.",
    fields: {
      description: "Description",
      quantity: "Qty",
      priceCents: "Price (cents)",
    },
    validation: {
      descriptionRequired: "Description is required",
      addFailed: "Failed to add line",
    },
    subtotal: "Subtotal",
  },
  activitiesPage: {
    title: "Activities",
    description: "Calls, emails, meetings, tasks, and follow-ups across your CRM.",
    create: "New activity",
    filters: {
      type: "Type",
      status: "Status",
      allTypes: "All types",
      allStatuses: "All statuses",
    },
    empty: "No activities match your filters.",
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
} satisfies CrmUiMessages
