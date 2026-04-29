import type { ExternalRefsUiMessages } from "./messages"

export const externalRefsUiRo: ExternalRefsUiMessages = {
  common: {
    refStatusLabels: {
      active: "Activ",
      inactive: "Inactiv",
      archived: "Arhivat",
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
