import type { CrmUiMessages } from "./messages.js"

export const crmUiRo = {
  common: {
    cancel: "Anuleaza",
    saveChanges: "Salveaza modificarile",
    create: "Creeaza",
    saving: "Se salveaza...",
    none: "—",
    unknownError: "Eroare necunoscuta",
    today: "azi",
    previous: "Anterior",
    next: "Urmator",
    page: "Pagina",
    pageSummary: "Afisezi {shown} din {total}",
    loading: "Se incarca...",
    activityTypeLabels: {
      note: "Nota",
      call: "Apel",
      email: "Email",
      meeting: "Intalnire",
      task: "Sarcina",
      follow_up: "Urmarire",
    },
    activityStatusLabels: {
      planned: "Planificat",
      done: "Finalizat",
      cancelled: "Anulat",
    },
    relationTypeLabels: {
      client: "Client",
      partner: "Partener",
      supplier: "Furnizor",
      other: "Altul",
    },
    recordStatusLabels: {
      active: "Activ",
      inactive: "Inactiv",
      archived: "Arhivat",
    },
    entityTypeLabels: {
      none: "Niciunul",
      person: "Persoana",
      organization: "Organizatie",
      opportunity: "Oportunitate",
      quote: "Oferta",
    },
    opportunityStatusLabels: {
      open: "Deschisa",
      won: "Castigata",
      lost: "Pierduta",
      archived: "Arhivata",
    },
    quoteStatusLabels: {
      draft: "Draft",
      sent: "Trimisa",
      accepted: "Acceptata",
      expired: "Expirata",
      rejected: "Respinsa",
      archived: "Arhivata",
    },
    relativeTime: {
      daysAgo: "acum {count}z",
      weeksAgo: "acum {count}s",
      monthsAgo: "acum {count}l",
      yearsAgo: "acum {count}a",
    },
  },
  organizationForm: {
    fields: {
      name: "Nume",
      legalName: "Nume legal",
      website: "Website",
      industry: "Industrie",
    },
    actions: {
      create: "Creeaza organizatia",
    },
    validation: {
      nameRequired: "Numele organizatiei este obligatoriu.",
      saveFailed: "Salvarea organizatiei a esuat.",
    },
  },
  personForm: {
    fields: {
      firstName: "Prenume",
      lastName: "Nume",
      jobTitle: "Functie",
      email: "Email",
      phone: "Telefon",
    },
    actions: {
      create: "Creeaza persoana",
    },
    validation: {
      nameRequired: "Prenumele si numele sunt obligatorii.",
      saveFailed: "Salvarea persoanei a esuat.",
    },
  },
  organizationDialog: {
    titles: {
      create: "Organizatie noua",
      edit: "Editeaza organizatia",
    },
    descriptions: {
      create: "Adauga o companie noua in CRM-ul tau.",
      edit: "Actualizeaza detaliile companiei si metadatele contului.",
    },
  },
  personDialog: {
    titles: {
      create: "Persoana noua",
      edit: "Editeaza persoana",
    },
    descriptions: {
      create: "Adauga o persoana noua in CRM-ul tau.",
      edit: "Actualizeaza datele de contact si informatiile de referinta.",
    },
  },
  personCard: {
    unnamed: "Fara nume",
  },
  personCardConnected: {
    loadFailed: "Incarcarea persoanei a esuat:",
  },
  personList: {
    searchPlaceholder: "Cauta persoane...",
    create: "Persoana noua",
    columns: {
      name: "Nume",
      email: "Email",
      phone: "Telefon",
      relation: "Relatie",
      status: "Status",
    },
    filters: {
      button: "Filtre",
      relationLabel: "Relatie",
      relationAll: "Toate relatiile",
      statusLabel: "Status",
      statusAll: "Toate statusurile",
      organizationLabel: "Organizatie",
      organizationAny: "Orice organizatie",
      organizationEmpty: "Nicio organizatie gasita.",
      clear: "Sterge filtre",
    },
    loadFailed: "Incarcarea persoanelor a esuat.",
    empty: "Nu au fost gasite persoane.",
  },
  peoplePage: {
    title: "Persoane",
    description: "Contacte, calatori, agenti si parteneri din CRM-ul tau.",
  },
  organizationList: {
    searchPlaceholder: "Cauta organizatii...",
    create: "Organizatie noua",
    columns: {
      name: "Nume",
      industry: "Industrie",
      relation: "Relatie",
      website: "Website",
      status: "Status",
      updated: "Actualizat",
    },
    filters: {
      button: "Filtre",
      relationLabel: "Relatie",
      relationAll: "Toate relatiile",
      statusLabel: "Status",
      statusAll: "Toate statusurile",
      clear: "Sterge filtre",
    },
    loadFailed: "Incarcarea organizatiilor a esuat.",
    empty: "Nu au fost gasite organizatii.",
  },
  organizationsPage: {
    title: "Organizatii",
    description: "Companii, agentii, furnizori si relatii de cont.",
  },
  createActivityDialog: {
    title: "Activitate noua",
    description: "Inregistreaza un apel, email, intalnire sau sarcina.",
    fields: {
      subject: "Subiect",
      type: "Tip",
      status: "Status",
      description: "Descriere",
      linkTo: "Leaga de",
      entityId: "ID entitate",
    },
    placeholders: {
      subject: "Apel de descoperire cu Acme",
      entityId: "pers_...",
    },
    validation: {
      subjectRequired: "Subiectul este obligatoriu",
      createFailed: "Crearea activitatii a esuat",
    },
  },
  createOpportunityDialog: {
    title: "Oportunitate noua",
    fields: {
      title: "Titlu",
      stage: "Etapa",
    },
    placeholders: {
      title: "Oportunitate noua",
      stage: "Selecteaza etapa...",
    },
    validation: {
      titleRequired: "Titlul este obligatoriu",
      stageRequired: "Etapa este obligatorie",
      createFailed: "Crearea oportunitatii a esuat",
    },
  },
  createQuoteDialog: {
    title: "Oferta noua",
    fields: {
      opportunity: "Oportunitate",
      currency: "Moneda",
      validUntil: "Valabila pana la",
    },
    placeholders: {
      searchOpportunities: "Cauta oportunitati...",
      selectCurrency: "Selecteaza moneda...",
      pickDate: "Alege o data",
    },
    empty: {
      loading: "Se incarca...",
      noOpportunities: "Nu au fost gasite oportunitati.",
    },
    validation: {
      selectOpportunity: "Selecteaza o oportunitate",
      selectCurrency: "Selecteaza o moneda",
      createFailed: "Crearea ofertei a esuat",
    },
    actions: {
      create: "Creeaza",
    },
  },
  activitiesPage: {
    title: "Activitati",
    description: "Apeluri, emailuri, intalniri, sarcini si urmariri din CRM-ul tau.",
    create: "Activitate noua",
    filters: {
      type: "Tip",
      status: "Status",
      allTypes: "Toate tipurile",
      allStatuses: "Toate statusurile",
    },
    empty: "Nicio activitate nu corespunde filtrelor.",
  },
  quotesPage: {
    title: "Oferte",
    description: "Oferte emise pentru oportunitatile din pipeline.",
    create: "Oferta noua",
    filters: {
      status: "Status",
      allStatuses: "Toate statusurile",
    },
    columns: {
      quote: "Oferta",
      status: "Status",
      total: "Total",
      validUntil: "Valabila pana la",
      updated: "Actualizat",
    },
    loadFailed: "Incarcarea ofertelor a esuat.",
    empty: "Nu au fost gasite oferte.",
  },
} satisfies CrmUiMessages
