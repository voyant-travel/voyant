import type { RegistryExtrasMessages } from "./messages"

export const registryExtrasEn = {
  common: {
    active: "Active",
    inactive: "Inactive",
    cancel: "Cancel",
    saveChanges: "Save Changes",
    selectionTypeLabels: {
      optional: "Optional",
      required: "Required",
      default_selected: "Default selected",
      unavailable: "Unavailable",
    },
    pricingModeLabels: {
      included: "Included",
      per_person: "Per person",
      per_booking: "Per booking",
      quantity_based: "Quantity based",
      on_request: "On request",
      free: "Free",
    },
  },
  extrasPage: {
    title: "Extras",
    description: "Configure optional add-ons travelers can choose alongside a product.",
    fields: {
      product: "Product",
      search: "Search extras",
    },
    placeholders: {
      product: "Select a product...",
      search: "Search extras...",
    },
    help: {
      product:
        "Pick a product to manage optional add-ons such as transfers, upgrades, and tastings.",
    },
    empty: {
      selectProduct: "Select a product above to configure its extras.",
      loading: "Loading extras...",
      noExtras: "No extras found.",
    },
    section: {
      title: "Product Extras",
      description: "Optional add-ons travelers can select during booking.",
      add: "Add Extra",
    },
    columns: {
      name: "Name",
      code: "Code",
      selection: "Selection",
      pricing: "Pricing",
      quantity: "Qty",
      sort: "Sort",
      status: "Status",
    },
    labels: {
      perPerson: "per person",
      deleteConfirm: "Delete extra?",
      defaultQuantity: "default",
      infinity: "infinity",
    },
  },
  productExtraDialog: {
    titles: {
      create: "Add Extra",
      edit: "Edit Extra",
    },
    fields: {
      name: "Name",
      code: "Code",
      description: "Description",
      selectionType: "Selection type",
      pricingMode: "Pricing mode",
      minQuantity: "Min quantity",
      maxQuantity: "Max quantity",
      defaultQuantity: "Default quantity",
      sortOrder: "Sort order",
      pricedPerPerson: "Per person",
      active: "Active",
    },
    placeholders: {
      name: "Airport transfer",
      code: "airport-transfer",
      description: "Shown to travelers when choosing extras...",
    },
    validation: {
      nameRequired: "Name is required",
    },
    actions: {
      create: "Add Extra",
    },
  },
} satisfies RegistryExtrasMessages
