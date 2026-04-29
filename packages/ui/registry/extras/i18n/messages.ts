export type RegistryExtrasSelectionType =
  | "optional"
  | "required"
  | "default_selected"
  | "unavailable"

export type RegistryExtrasPricingMode =
  | "included"
  | "per_person"
  | "per_booking"
  | "quantity_based"
  | "on_request"
  | "free"

export type RegistryExtrasMessages = {
  common: {
    active: string
    inactive: string
    cancel: string
    saveChanges: string
    selectionTypeLabels: Record<RegistryExtrasSelectionType, string>
    pricingModeLabels: Record<RegistryExtrasPricingMode, string>
  }
  extrasPage: {
    title: string
    description: string
    fields: {
      product: string
      search: string
    }
    placeholders: {
      product: string
      search: string
    }
    help: {
      product: string
    }
    empty: {
      selectProduct: string
      loading: string
      noExtras: string
    }
    section: {
      title: string
      description: string
      add: string
    }
    columns: {
      name: string
      code: string
      selection: string
      pricing: string
      quantity: string
      sort: string
      status: string
    }
    labels: {
      perPerson: string
      deleteConfirm: string
      defaultQuantity: string
      infinity: string
    }
  }
  productExtraDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      name: string
      code: string
      description: string
      selectionType: string
      pricingMode: string
      minQuantity: string
      maxQuantity: string
      defaultQuantity: string
      sortOrder: string
      pricedPerPerson: string
      active: string
    }
    placeholders: {
      name: string
      code: string
      description: string
    }
    validation: {
      nameRequired: string
    }
    actions: {
      create: string
    }
  }
}
