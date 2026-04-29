import type { RegistrySellabilityMessages } from "./messages"

export const registrySellabilityRo = {
  page: {
    title: "Vandabilitate",
    description:
      "Politici declarative care decid cand ofertele pot fi vandute pe scope global, produs, optiune, piata si canal.",
    addPolicy: "Adauga politica",
    filters: {
      scopePlaceholder: "Scope",
      typePlaceholder: "Tip",
      statusPlaceholder: "Status",
      scopeAll: "Toate scope-urile",
      typeAll: "Toate tipurile",
      statusAll: "Toate statusurile",
      active: "Activ",
      inactive: "Inactiv",
    },
    empty: {
      loading: "Se incarca...",
      noPolicies: "Nu au fost gasite politici.",
    },
    columns: {
      name: "Nume",
      scope: "Scope",
      type: "Tip",
      priority: "Prioritate",
      status: "Status",
    },
    actions: {
      deleteConfirm: "Stergi politica?",
    },
  },
} satisfies RegistrySellabilityMessages
