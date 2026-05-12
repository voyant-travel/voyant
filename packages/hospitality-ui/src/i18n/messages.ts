export const inventoryModes = ["virtual", "pooled", "serialized"] as const
export const roomUnitStatuses = ["active", "inactive", "out_of_order", "archived"] as const
export const maintenanceBlockStatuses = ["open", "in_progress", "resolved", "cancelled"] as const
export const roomBlockStatuses = ["draft", "held", "confirmed", "released", "cancelled"] as const
export const chargeFrequencies = [
  "per_night",
  "per_stay",
  "per_person_per_night",
  "per_person_per_stay",
] as const
export const guaranteeModes = ["none", "deposit", "on_request", "card_hold", "full_prepay"] as const
export const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const

export type InventoryMode = (typeof inventoryModes)[number]
export type RoomUnitStatus = (typeof roomUnitStatuses)[number]
export type MaintenanceBlockStatus = (typeof maintenanceBlockStatuses)[number]
export type RoomBlockStatus = (typeof roomBlockStatuses)[number]
export type ChargeFrequency = (typeof chargeFrequencies)[number]
export type GuaranteeMode = (typeof guaranteeModes)[number]
export type Weekday = (typeof weekdays)[number]

export type HospitalityUiMessages = {
  common: {
    cancel: string
    saveChanges: string
    add: string
    loading: string
    none: string
    noneOption: string
    all: string
    previous: string
    next: string
    page: string
    showingRange: string
    active: string
    inactive: string
    stop: string
    mealInclusions: {
      breakfast: string
      lunch: string
      dinner: string
      drinks: string
    }
    inventoryModeLabels: Record<InventoryMode, string>
    roomUnitStatusLabels: Record<RoomUnitStatus, string>
    maintenanceBlockStatusLabels: Record<MaintenanceBlockStatus, string>
    roomBlockStatusLabels: Record<RoomBlockStatus, string>
    chargeFrequencyLabels: Record<ChargeFrequency, string>
    guaranteeModeLabels: Record<GuaranteeMode, string>
    weekdayLabels: Record<Weekday, string>
  }
  comboboxes: {
    mealPlan: {
      placeholder: string
      empty: string
    }
    roomType: {
      placeholder: string
      empty: string
    }
    roomUnit: {
      placeholder: string
      empty: string
    }
    cancellationPolicy: {
      placeholder: string
      empty: string
    }
    priceCatalog: {
      placeholder: string
      empty: string
    }
    ratePlan: {
      placeholder: string
      empty: string
    }
  }
  catalogCard: {
    untitled: string
    ratePerNight: string
    sleeps: string
  }
  mealPlansTab: {
    description: string
    add: string
    empty: string
    columns: {
      code: string
      name: string
      includes: string
      status: string
    }
    deleteConfirm: string
  }
  roomTypesTab: {
    description: string
    add: string
    empty: string
    columns: {
      name: string
      code: string
      mode: string
      occupancy: string
      status: string
    }
    deleteConfirm: string
  }
  roomUnitsTab: {
    description: string
    add: string
    empty: string
    columns: {
      roomNumber: string
      roomType: string
      floor: string
      wing: string
      status: string
    }
    deleteConfirm: string
  }
  maintenanceBlocksTab: {
    description: string
    add: string
    empty: string
    columns: {
      dates: string
      roomTypeUnit: string
      reason: string
      status: string
    }
    deleteConfirm: string
  }
  roomBlocksTab: {
    description: string
    add: string
    empty: string
    columns: {
      dates: string
      roomTypeUnit: string
      quantity: string
      reason: string
      status: string
    }
    deleteConfirm: string
  }
  ratePlansTab: {
    description: string
    add: string
    empty: string
    columns: {
      code: string
      name: string
      catalog: string
      cancellation: string
      mealPlan: string
      currency: string
      charge: string
      status: string
    }
    deleteConfirm: string
  }
  roomInventoryTab: {
    description: string
    add: string
    filters: {
      roomType: string
      from: string
      to: string
      allRoomTypes: string
    }
    empty: string
    columns: {
      date: string
      roomType: string
      total: string
      available: string
      held: string
      sold: string
      outOfOrder: string
      stop: string
    }
    deleteConfirm: string
  }
  stayRulesTab: {
    description: string
    add: string
    empty: string
    columns: {
      ratePlan: string
      roomType: string
      valid: string
      nights: string
      flags: string
      status: string
    }
    flags: {
      closedToArrival: string
      closedToDeparture: string
    }
    deleteConfirm: string
  }
  mealPlanDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      code: string
      name: string
      description: string
      sortOrder: string
      breakfast: string
      lunch: string
      dinner: string
      drinks: string
      active: string
    }
    placeholders: {
      code: string
      name: string
    }
    validation: {
      codeRequired: string
      nameRequired: string
    }
    actions: {
      create: string
    }
  }
  roomTypeDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      name: string
      code: string
      description: string
      inventoryMode: string
      sortOrder: string
      standardOccupancy: string
      minOccupancy: string
      maxOccupancy: string
      maxAdults: string
      maxChildren: string
      maxInfants: string
      bedrooms: string
      bathrooms: string
      smokingAllowed: string
      active: string
    }
    placeholders: {
      name: string
      code: string
    }
    validation: {
      nameRequired: string
    }
    actions: {
      create: string
    }
  }
  roomUnitDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      roomType: string
      roomNumber: string
      code: string
      floor: string
      wing: string
      status: string
      viewCode: string
      accessibility: string
      genderRestriction: string
      notes: string
    }
    placeholders: {
      roomType: string
      roomNumber: string
      code: string
      floor: string
      wing: string
      viewCode: string
      accessibility: string
      genderRestriction: string
    }
    validation: {
      roomTypeRequired: string
    }
    actions: {
      create: string
    }
  }
  maintenanceBlockDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      roomType: string
      roomUnit: string
      startsOn: string
      endsOn: string
      status: string
      reason: string
      notes: string
    }
    placeholders: {
      roomType: string
      roomUnit: string
      startsOn: string
      endsOn: string
      reason: string
    }
    validation: {
      startsOnRequired: string
      endsOnRequired: string
    }
    actions: {
      create: string
    }
  }
  roomBlockDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      roomType: string
      roomUnit: string
      startsOn: string
      endsOn: string
      status: string
      quantity: string
      reason: string
      notes: string
    }
    placeholders: {
      roomType: string
      roomUnit: string
      startsOn: string
      endsOn: string
      reason: string
    }
    validation: {
      startsOnRequired: string
      endsOnRequired: string
      quantityMin: string
    }
    actions: {
      create: string
    }
  }
  roomInventoryDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      roomType: string
      date: string
      total: string
      available: string
      held: string
      sold: string
      outOfOrder: string
      overbookLimit: string
      stopSell: string
      notes: string
    }
    placeholders: {
      roomType: string
      date: string
    }
    validation: {
      roomTypeRequired: string
      dateRequired: string
      nonNegative: string
    }
    actions: {
      create: string
    }
  }
  ratePlanDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      code: string
      name: string
      description: string
      currency: string
      chargeFrequency: string
      guarantee: string
      mealPlan: string
      priceCatalog: string
      cancellationPolicy: string
      commissionable: string
      refundable: string
      active: string
      sortOrder: string
    }
    placeholders: {
      code: string
      name: string
      mealPlan: string
      priceCatalog: string
      cancellationPolicy: string
    }
    validation: {
      codeRequired: string
      nameRequired: string
      currencyLength: string
    }
    actions: {
      create: string
    }
  }
  stayRuleDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      ratePlan: string
      roomType: string
      validFrom: string
      validTo: string
      minNights: string
      maxNights: string
      releaseDays: string
      minAdvanceDays: string
      maxAdvanceDays: string
      priority: string
      arrivalWeekdays: string
      departureWeekdays: string
      closedToArrival: string
      closedToDeparture: string
      active: string
      notes: string
    }
    placeholders: {
      ratePlan: string
      roomType: string
      validFrom: string
      validTo: string
    }
    validation: {
      nonNegative: string
    }
    actions: {
      create: string
    }
  }
}
