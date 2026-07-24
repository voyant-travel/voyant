export const crmUiEnCommerceMessages = {
  createActivityDialog: {
    title: "New activity",
    description: "Log a call, email, meeting, or task.",
    fields: {
      subject: "Subject",
      type: "Type",
      status: "Status",
      description: "Description",
      linkTo: "Link to",
      entityId: "Linked to",
    },
    placeholders: {
      subject: "Discovery call with Acme",
      entityId: "Search a person, company, or quote",
    },
    validation: {
      subjectRequired: "Subject is required",
      createFailed: "Failed to create activity",
    },
  },
  createQuoteDialog: {
    title: "New quote",
    fields: {
      title: "Title",
      stage: "Stage",
    },
    placeholders: {
      title: "New quote",
      stage: "Select stage...",
    },
    validation: {
      titleRequired: "Title is required",
      stageRequired: "Stage is required",
      createFailed: "Failed to create quote",
    },
  },
  quotesBoard: {
    fallbackName: "Unnamed stage",
  },
  quoteSummaryCard: {
    unknown: "Unknown",
    expectedClose: "Expected close",
  },
  inlineEditor: {
    failedToSave: "Failed to save.",
    notSet: "Not set",
    selectPlaceholder: "Select...",
    noneOption: "None",
    invalidNumber: "Enter a valid number.",
    minNumber: "Must be at least {min}.",
    maxNumber: "Must be at most {max}.",
    searchCurrencyPlaceholder: "Search currency...",
    noCurrenciesFound: "No currencies found.",
    searchLanguagePlaceholder: "Search language...",
    noLanguagesFound: "No languages found.",
    addTemplate: "Add {label}",
    addTagPlaceholder: "Add tag...",
    tagAlreadyAdded: "Tag already added.",
    addTagFailed: "Failed to add tag.",
    removeTagFailed: "Failed to remove tag.",
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
      selectCurrency: "Select currency...",
      pickDate: "Pick a date",
    },
    empty: {
      loading: "Loading...",
      noQuotes: "No quotes found.",
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
  quoteVersionLinesCard: {
    title: "Version line items",
    empty: "No line items yet.",
    fields: {
      description: "Description",
      quantity: "Qty",
      priceCents: "Unit price",
    },
    validation: {
      descriptionRequired: "Description is required",
      addFailed: "Failed to add line",
    },
    subtotal: "Subtotal",
  },
  activitiesPage: {
    title: "Activities",
    description: "Your logged calls, emails, and meetings.",
    create: "New activity",
    filters: {
      type: "Type",
      status: "Status",
      allTypes: "All types",
      allStatuses: "All statuses",
    },
    empty: "No activities match your filters.",
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
} as const
