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
    },
    loadFailed: "Incarcarea persoanelor a esuat.",
    empty: "Nu au fost gasite persoane.",
  },
  organizationList: {
    searchPlaceholder: "Cauta organizatii...",
    create: "Organizatie noua",
    columns: {
      name: "Nume",
      industry: "Industrie",
      relation: "Relatie",
      website: "Website",
      updated: "Actualizat",
    },
    loadFailed: "Incarcarea organizatiilor a esuat.",
    empty: "Nu au fost gasite organizatii.",
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
} satisfies CrmUiMessages
