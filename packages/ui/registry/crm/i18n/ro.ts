import { crmUiRo } from "../../../../crm-ui/src/i18n/ro"

import type { RegistryCrmMessages } from "./messages"

export const registryCrmRo = {
  ...crmUiRo,
  common: {
    ...crmUiRo.common,
    opportunityStatusLabels: {
      open: "Deschisa",
      won: "Castigata",
      lost: "Pierduta",
      archived: "Arhivata",
    },
    quoteStatusLabels: {
      draft: "Ciorna",
      sent: "Trimisa",
      accepted: "Acceptata",
      expired: "Expirata",
      rejected: "Respinsa",
      archived: "Arhivata",
    },
  },
  createQuoteDialog: {
    title: "Cotatie noua",
    fields: {
      opportunity: "Oportunitate",
      currency: "Moneda",
      validUntil: "Valabila pana la",
    },
    placeholders: {
      searchOpportunities: "Cauta oportunitati...",
      pickDate: "Alege o data",
    },
    empty: {
      loading: "Se incarca...",
      noOpportunities: "Nu au fost gasite oportunitati.",
      noCurrencies: "Nu a fost gasita nicio moneda.",
    },
    validation: {
      selectOpportunity: "Selecteaza o oportunitate",
      selectCurrency: "Selecteaza o moneda",
      createFailed: "Nu am putut crea cotatia",
    },
    actions: {
      create: "Creeaza",
    },
  },
  opportunitiesBoard: {
    fallbackName: "Etapa fara nume",
  },
  opportunitySummaryCard: {
    unknown: "Necunoscut",
    expectedClose: "Inchidere estimata",
  },
  organizationDetailPage: {
    notFound: "Organizatia nu a fost gasita",
    backToOrganizations: "Inapoi la organizatii",
  },
  organizationDetail: {
    topBar: {
      organizations: "Organizatii",
      delete: "Sterge",
      deleteTitle: "Stergi aceasta organizatie?",
      deleteDescription:
        "Aceasta actiune va sterge definitiv organizatia. Persoanele asociate vor ramane.",
    },
    sidebar: {
      about: "Despre",
      tags: "Etichete",
      fields: {
        name: "Nume",
        legalName: "Denumire legala",
        website: "Website",
        industry: "Industrie",
        relation: "Relatie",
        status: "Status",
        defaultCurrency: "Moneda implicita",
        preferredLanguage: "Limba preferata",
        paymentTerms: "Termene de plata (zile)",
        source: "Sursa",
      },
    },
    metrics: {
      people: "Persoane",
      openOpportunities: "Oportunitati deschise",
      pipelineValue: "Valoare pipeline",
      won: "Castigate",
    },
    tabs: {
      overview: "Prezentare",
      people: "Persoane",
      opportunities: "Oportunitati",
      activities: "Activitati",
    },
    sections: {
      created: "Creat",
      updated: "Actualizat",
      notes: "Note",
    },
    empty: {
      noPeople: "Nu exista persoane asociate acestei organizatii.",
      unnamed: "Fara nume",
      noOpportunities: "Nu exista oportunitati.",
      noActivities: "Nu exista activitati.",
    },
    hint: "Campurile se actualizeaza din panoul din stanga. Treci cu mouse-ul pentru a vedea iconita de editare.",
  },
  quoteLinesCard: {
    title: "Linii cotatie",
    empty: "Nu exista inca linii.",
    fields: {
      description: "Descriere",
      quantity: "Cant.",
      priceCents: "Pret (centi)",
    },
    validation: {
      descriptionRequired: "Descrierea este obligatorie",
      addFailed: "Nu am putut adauga linia",
    },
    subtotal: "Subtotal",
  },
  quotesPage: {
    title: "Cotatii",
    description: "Cotatiile emise pentru oportunitatile din pipeline.",
    create: "Cotatie noua",
    filters: {
      status: "Status",
      allStatuses: "Toate statusurile",
    },
    columns: {
      quote: "Cotatie",
      status: "Status",
      total: "Total",
      validUntil: "Valabila pana la",
      updated: "Actualizat",
    },
    loadFailed: "Nu am putut incarca cotatiile.",
    empty: "Nu exista cotatii.",
  },
} satisfies RegistryCrmMessages
