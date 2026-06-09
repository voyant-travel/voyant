import { crmUiRo } from "../../../../crm-ui/src/i18n/ro"

import type { RegistryCrmMessages } from "./messages"

export const registryCrmRo = {
  ...crmUiRo,
  common: {
    ...crmUiRo.common,
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
      pickDate: "Alege o data",
    },
    empty: {
      loading: "Se incarca...",
      noQuotes: "Nu au fost gasite oferte.",
      noCurrencies: "Nu a fost gasita nicio moneda.",
    },
    validation: {
      selectQuote: "Selecteaza o oferta",
      selectCurrency: "Selecteaza o moneda",
      createFailed: "Nu am putut crea versiunea de oferta",
    },
    actions: {
      create: "Creeaza",
    },
  },
  quotesBoard: {
    fallbackName: "Etapa fara nume",
  },
  quoteSummaryCard: {
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
      openQuotes: "Oferte deschise",
      pipelineValue: "Valoare pipeline",
      won: "Castigate",
    },
    tabs: {
      overview: "Prezentare",
      people: "Persoane",
      quotes: "Oferte",
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
      noQuotes: "Nu exista oferte.",
      noActivities: "Nu exista activitati.",
    },
    hint: "Campurile se actualizeaza din panoul din stanga. Treci cu mouse-ul pentru a vedea iconita de editare.",
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
      addFailed: "Nu am putut adauga linia",
    },
    subtotal: "Subtotal",
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
    loadFailed: "Nu am putut incarca cotatiile.",
    empty: "Nu exista cotatii.",
  },
} satisfies RegistryCrmMessages
