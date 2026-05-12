import type { RegistryExternalRefsMessages } from "./messages"

export const registryExternalRefsRo = {
  externalRefsPage: {
    title: "Referinte externe",
    description:
      "ID-uri din sisteme terte legate de entitati Voyant. Introdu tipul entitatii si ID-ul de mai jos pentru a gestiona referintele externe.",
    fields: {
      entityType: "Tip entitate",
      entity: "Entitate",
      customEntityType: "Alt tip de entitate",
    },
    placeholders: {
      entityType: "person, booking, product...",
      entity: "Insereaza o referinta pentru tipuri custom",
    },
    entityTypeLabels: {
      person: "Persoana",
      organization: "Organizatie",
      supplier: "Furnizor",
      booking: "Rezervare",
      product: "Produs",
    },
    emptyScope: "Alege o entitate mai sus pentru a vedea referintele externe.",
  },
  externalRefsTab: {
    description: "Legaturi intre aceasta entitate si ID-uri din sisteme externe.",
    add: "Adauga referinta externa",
    empty: "Nu exista inca referinte externe.",
    loading: "Se incarca referintele externe...",
    columns: {
      sourceSystem: "Sistem sursa",
      objectType: "Tip obiect",
      externalId: "ID extern",
      namespace: "Namespace",
      status: "Status",
      primary: "Primara",
    },
    actions: {
      deleteConfirm: "Stergi referinta externa?",
    },
  },
} satisfies RegistryExternalRefsMessages
