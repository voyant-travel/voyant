import type { RegistryGroundMessages } from "./messages"

export const registryGroundEn: RegistryGroundMessages = {
  common: {
    yes: "Yes",
    no: "No",
    active: "Active",
    inactive: "Inactive",
    cancel: "Cancel",
    saveChanges: "Save Changes",
    categoryLabels: {
      car: "Car",
      sedan: "Sedan",
      suv: "SUV",
      van: "Van",
      minibus: "Minibus",
      bus: "Bus",
      boat: "Boat",
      train: "Train",
      other: "Other",
    },
    classLabels: {
      economy: "Economy",
      standard: "Standard",
      premium: "Premium",
      luxury: "Luxury",
      accessible: "Accessible",
      other: "Other",
    },
  },
  page: {
    title: "Ground Operations",
    tabs: {
      operators: "Operators",
      vehicles: "Vehicles",
      drivers: "Drivers",
    },
  },
  operatorsTab: {
    description: "Transport operators such as DMC fleets, transfer partners and rental companies.",
    add: "Add Operator",
    empty: {
      loading: "Loading operators...",
      none: "No operators yet.",
    },
    columns: {
      name: "Name",
      code: "Code",
      supplier: "Supplier",
      facility: "Facility",
      status: "Status",
    },
    actions: {
      deleteConfirm: "Delete this operator?",
    },
  },
  operatorDialog: {
    addTitle: "Add Operator",
    editTitle: "Edit Operator",
    fields: {
      name: "Name",
      code: "Code",
      supplier: "Supplier (optional)",
      facility: "Facility (optional)",
      notes: "Notes",
      active: "Active",
    },
    placeholders: {
      name: "Istanbul Transfer Co.",
      code: "istanbul-transfer",
      supplier: "Search suppliers...",
      supplierEmpty: "No suppliers found.",
      facility: "Search facilities...",
      facilityEmpty: "No facilities found.",
    },
    errors: {
      nameRequired: "Name is required",
    },
    actions: {
      add: "Add Operator",
    },
  },
  driversTab: {
    description: "Drivers attached to operators. Each driver is backed by a resource.",
    add: "Add Driver",
    empty: {
      loading: "Loading drivers...",
      none: "No drivers yet.",
    },
    columns: {
      resource: "Resource",
      operator: "Operator",
      license: "License",
      languages: "Languages",
      guide: "Guide",
      meetAndGreet: "M&G",
      status: "Status",
    },
    actions: {
      deleteConfirm: "Delete this driver?",
    },
  },
  driverDialog: {
    addTitle: "Add Driver",
    editTitle: "Edit Driver",
    fields: {
      resource: "Resource",
      operator: "Operator (optional)",
      licenseNumber: "License number",
      spokenLanguages: "Spoken languages (comma-separated)",
      notes: "Notes",
      guide: "Guide",
      meetAndGreet: "Meet & greet",
      active: "Active",
    },
    placeholders: {
      resource: "Search resources...",
      resourceEmpty: "No resources found.",
      operator: "Search operators...",
      operatorEmpty: "No operators found.",
      spokenLanguages: "en, tr, ar",
    },
    errors: {
      resourceRequired: "Resource ID is required",
    },
    actions: {
      add: "Add Driver",
    },
  },
  vehiclesTab: {
    description: "Vehicles attached to operators. Each vehicle is backed by a resource.",
    add: "Add Vehicle",
    empty: {
      loading: "Loading vehicles...",
      none: "No vehicles yet.",
    },
    columns: {
      resource: "Resource",
      operator: "Operator",
      category: "Category",
      class: "Class",
      passengers: "Pax",
      accessible: "Accessible",
      status: "Status",
    },
    actions: {
      deleteConfirm: "Delete this vehicle?",
    },
  },
  vehicleDialog: {
    addTitle: "Add Vehicle",
    editTitle: "Edit Vehicle",
    fields: {
      resource: "Resource",
      operator: "Operator (optional)",
      category: "Category",
      class: "Class",
      passengers: "Passengers",
      checkedBags: "Checked bags",
      carryOn: "Carry-on",
      wheelchairs: "Wheelchairs",
      childSeats: "Child seats",
      notes: "Notes",
      accessible: "Accessible",
      active: "Active",
    },
    placeholders: {
      resource: "Search resources...",
      resourceEmpty: "No resources found.",
      operator: "Search operators...",
      operatorEmpty: "No operators found.",
    },
    errors: {
      resourceRequired: "Resource ID is required",
    },
    actions: {
      add: "Add Vehicle",
    },
  },
}
