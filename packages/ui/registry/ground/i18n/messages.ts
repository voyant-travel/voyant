export type RegistryGroundMessages = {
  common: {
    yes: string
    no: string
    active: string
    inactive: string
    cancel: string
    saveChanges: string
    categoryLabels: Record<
      "car" | "sedan" | "suv" | "van" | "minibus" | "bus" | "boat" | "train" | "other",
      string
    >
    classLabels: Record<
      "economy" | "standard" | "premium" | "luxury" | "accessible" | "other",
      string
    >
  }
  page: {
    title: string
    tabs: {
      operators: string
      vehicles: string
      drivers: string
    }
  }
  operatorsTab: {
    description: string
    add: string
    empty: {
      loading: string
      none: string
    }
    columns: {
      name: string
      code: string
      supplier: string
      facility: string
      status: string
    }
    actions: {
      deleteConfirm: string
    }
  }
  operatorDialog: {
    addTitle: string
    editTitle: string
    fields: {
      name: string
      code: string
      supplier: string
      facility: string
      notes: string
      active: string
    }
    placeholders: {
      name: string
      code: string
      supplier: string
      supplierEmpty: string
      facility: string
      facilityEmpty: string
    }
    errors: {
      nameRequired: string
    }
    actions: {
      add: string
    }
  }
  driversTab: {
    description: string
    add: string
    empty: {
      loading: string
      none: string
    }
    columns: {
      resource: string
      operator: string
      license: string
      languages: string
      guide: string
      meetAndGreet: string
      status: string
    }
    actions: {
      deleteConfirm: string
    }
  }
  driverDialog: {
    addTitle: string
    editTitle: string
    fields: {
      resource: string
      operator: string
      licenseNumber: string
      spokenLanguages: string
      notes: string
      guide: string
      meetAndGreet: string
      active: string
    }
    placeholders: {
      resource: string
      resourceEmpty: string
      operator: string
      operatorEmpty: string
      spokenLanguages: string
    }
    errors: {
      resourceRequired: string
    }
    actions: {
      add: string
    }
  }
  vehiclesTab: {
    description: string
    add: string
    empty: {
      loading: string
      none: string
    }
    columns: {
      resource: string
      operator: string
      category: string
      class: string
      passengers: string
      accessible: string
      status: string
    }
    actions: {
      deleteConfirm: string
    }
  }
  vehicleDialog: {
    addTitle: string
    editTitle: string
    fields: {
      resource: string
      operator: string
      category: string
      class: string
      passengers: string
      checkedBags: string
      carryOn: string
      wheelchairs: string
      childSeats: string
      notes: string
      accessible: string
      active: string
    }
    placeholders: {
      resource: string
      resourceEmpty: string
      operator: string
      operatorEmpty: string
    }
    errors: {
      resourceRequired: string
    }
    actions: {
      add: string
    }
  }
}
