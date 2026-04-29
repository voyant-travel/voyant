import type { RegistryExternalRefsMessages } from "./messages"

export const registryExternalRefsRo = {
  externalRefsPage: {
    title: "Referinte externe",
    description:
      "ID-uri din sisteme terte legate de entitati Voyant. Introdu tipul entitatii si ID-ul de mai jos pentru a gestiona referintele externe.",
    fields: {
      entityType: "Tip entitate",
      entityId: "ID entitate",
    },
    placeholders: {
      entityType: "person, booking, product...",
      entityId: "pers_... / book_... / prod_...",
    },
    emptyScope: "Introdu mai sus tipul entitatii si ID-ul pentru a vedea referintele externe.",
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
