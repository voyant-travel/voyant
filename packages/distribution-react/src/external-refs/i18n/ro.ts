import type { ExternalRefsUiMessages } from "./messages.js"

export const externalRefsUiRo: ExternalRefsUiMessages = {
  common: {
    refStatusLabels: {
      active: "Activ",
      inactive: "Inactiv",
      archived: "Arhivat",
    },
  },
  externalRefsPage: {
    title: "Referinte externe",
    description:
      "Leaga inregistrari din Voyant de ID-urile lor din alte sisteme. Alege ce vrei sa legi, apoi adauga ID-ul extern.",
    fields: {
      entityType: "Tip inregistrare",
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
    empty: {
      none: "Nu exista inca referinte externe.",
      loading: "Se incarca referintele externe...",
    },
    columns: {
      sourceSystem: "Sistem sursa",
      objectType: "Tip obiect",
      externalId: "ID extern",
      namespace: "Namespace",
      status: "Status",
      primary: "Primara",
    },
    actions: {
      edit: "Editeaza referinta externa",
      delete: "Sterge referinta externa",
      deleteConfirm: "Stergi referinta externa?",
    },
    pagination: {
      previous: "Pagina anterioara",
      next: "Pagina urmatoare",
      page: "Pagina",
      of: "din",
    },
  },
  externalRefDialog: {
    titles: {
      edit: "Editeaza referinta externa",
      add: "Adauga referinta externa",
    },
    labels: {
      sourceSystem: "Sistem sursa",
      objectType: "Tip obiect",
      namespace: "Namespace",
      externalId: "ID extern",
      externalParentId: "ID parinte extern",
      status: "Status",
      primary: "Primar",
      metadataJson: "Metadata (JSON)",
    },
    placeholders: {
      sourceSystem: "bokun, pipedrive, stripe...",
      objectType: "booking, person, product...",
      namespace: "default",
      externalId: "abc-123",
      externalParentId: "parent-id...",
      metadataJson: '{ "key": "value" }',
    },
    actions: {
      cancel: "Anuleaza",
      saveChanges: "Salveaza modificarile",
      addExternalRef: "Adauga referinta externa",
    },
    validation: {
      sourceSystemRequired: "Sistemul sursa este obligatoriu",
      objectTypeRequired: "Tipul obiectului este obligatoriu",
      externalIdRequired: "ID-ul extern este obligatoriu",
      metadataMustBeObject: "Trebuie sa fie un obiect JSON",
    },
  },
}
