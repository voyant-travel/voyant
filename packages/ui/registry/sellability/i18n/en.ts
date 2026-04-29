import type { RegistrySellabilityMessages } from "./messages"

export const registrySellabilityEn = {
  page: {
    title: "Sellability",
    description:
      "Declarative policies that decide when offers can be sold across global, product, option, market, and channel scopes.",
    addPolicy: "Add Policy",
    filters: {
      scopePlaceholder: "Scope",
      typePlaceholder: "Type",
      statusPlaceholder: "Status",
      scopeAll: "All scopes",
      typeAll: "All types",
      statusAll: "All statuses",
      active: "Active",
      inactive: "Inactive",
    },
    empty: {
      loading: "Loading...",
      noPolicies: "No policies found.",
    },
    columns: {
      name: "Name",
      scope: "Scope",
      type: "Type",
      priority: "Priority",
      status: "Status",
    },
    actions: {
      deleteConfirm: "Delete policy?",
    },
  },
} satisfies RegistrySellabilityMessages
