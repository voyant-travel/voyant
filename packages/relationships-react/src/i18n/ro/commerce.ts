export const crmUiRoCommerceMessages = {
  createActivityDialog: {
    title: "Activitate noua",
    description: "Inregistreaza un apel, email, intalnire sau sarcina.",
    fields: {
      subject: "Subiect",
      type: "Tip",
      status: "Status",
      description: "Descriere",
      linkTo: "Leaga de",
      entityId: "Legat de",
    },
    placeholders: {
      subject: "Apel de descoperire cu Acme",
      entityId: "Cauta o persoana, companie sau oferta",
    },
    validation: {
      subjectRequired: "Subiectul este obligatoriu",
      createFailed: "Crearea activitatii a esuat",
    },
  },
  createQuoteDialog: {
    title: "Oferta noua",
    fields: {
      title: "Titlu",
      stage: "Etapa",
    },
    placeholders: {
      title: "Oferta noua",
      stage: "Selecteaza etapa...",
    },
    validation: {
      titleRequired: "Titlul este obligatoriu",
      stageRequired: "Etapa este obligatorie",
      createFailed: "Crearea ofertei a esuat",
    },
  },
  quotesBoard: {
    fallbackName: "Etapa fara nume",
  },
  quoteSummaryCard: {
    unknown: "Necunoscut",
    expectedClose: "Inchidere estimata",
  },
  inlineEditor: {
    failedToSave: "Salvarea a esuat.",
    notSet: "Nesetat",
    selectPlaceholder: "Selecteaza...",
    noneOption: "Niciunul",
    invalidNumber: "Introdu un numar valid.",
    minNumber: "Trebuie sa fie cel putin {min}.",
    maxNumber: "Trebuie sa fie cel mult {max}.",
    searchCurrencyPlaceholder: "Cauta moneda...",
    noCurrenciesFound: "Nu au fost gasite monede.",
    searchLanguagePlaceholder: "Cauta limba...",
    noLanguagesFound: "Nu au fost gasite limbi.",
    addTemplate: "Adauga {label}",
    addTagPlaceholder: "Adauga eticheta...",
    tagAlreadyAdded: "Eticheta este deja adaugata.",
    addTagFailed: "Adaugarea etichetei a esuat.",
    removeTagFailed: "Stergerea etichetei a esuat.",
  },
  createQuoteVersionDialog: {
    title: "Versiune de oferta noua",
    fields: {
      quote: "Oferta",
      currency: "Moneda",
      validUntil: "Valabila pana la",
    },
    placeholders: {
      searchQuotes: "Cauta oferte...",
      selectCurrency: "Selecteaza moneda...",
      pickDate: "Alege o data",
    },
    empty: {
      loading: "Se incarca...",
      noQuotes: "Nu au fost gasite oferte.",
    },
    validation: {
      selectQuote: "Selecteaza o oferta",
      selectCurrency: "Selecteaza o moneda",
      createFailed: "Crearea versiunii de oferta a esuat",
    },
    actions: {
      create: "Creeaza",
    },
  },
  quoteVersionLinesCard: {
    title: "Linii versiune oferta",
    empty: "Nu exista inca linii.",
    fields: {
      description: "Descriere",
      quantity: "Cant.",
      priceCents: "Pret",
    },
    validation: {
      descriptionRequired: "Descrierea este obligatorie",
      addFailed: "Adaugarea liniei a esuat",
    },
    subtotal: "Subtotal",
  },
  activitiesPage: {
    title: "Activitati",
    description: "Apelurile, emailurile si intalnirile inregistrate.",
    create: "Activitate noua",
    filters: {
      type: "Tip",
      status: "Status",
      allTypes: "Toate tipurile",
      allStatuses: "Toate statusurile",
    },
    empty: "Nicio activitate nu corespunde filtrelor.",
  },
  quoteVersionsPage: {
    title: "Versiuni oferta",
    description: "Versiuni emise pentru ofertele din pipeline.",
    create: "Versiune oferta noua",
    filters: {
      status: "Status",
      allStatuses: "Toate statusurile",
    },
    columns: {
      quoteVersion: "Versiune",
      status: "Status",
      total: "Total",
      validUntil: "Valabila pana la",
      updated: "Actualizat",
    },
    loadFailed: "Incarcarea ofertelor a esuat.",
    empty: "Nu au fost gasite oferte.",
  },
} as const
