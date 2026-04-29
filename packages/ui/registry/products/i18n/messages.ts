import type { ProductsUiMessages } from "@voyantjs/products-ui"

export type RegistryProductsMessages = ProductsUiMessages & {
  common: ProductsUiMessages["common"] & {
    serviceTypeLabels: {
      accommodation: string
      transfer: string
      experience: string
      guide: string
      meal: string
      other: string
    }
    productStatusLabels: {
      draft: string
      active: string
      archived: string
    }
  }
  productDialog: {
    titles: {
      create: string
      edit: string
    }
    descriptions: {
      create: string
      edit: string
    }
  }
  productForm: {
    fields: {
      name: string
      description: string
      tags: string
      status: string
      bookingMode: string
      productType: string
      sellCurrency: string
      sellAmount: string
      costAmount: string
    }
    placeholders: {
      name: string
      description: string
      tags: string
      productType: string
      sellAmount: string
      costAmount: string
    }
    validation: {
      nameRequired: string
      sellCurrencyInvalid: string
      saveFailed: string
    }
    actions: {
      createProduct: string
      saving: string
      removeTag: string
    }
    bookingModeLabels: {
      date: string
      date_time: string
      open: string
      stay: string
      transfer: string
      itinerary: string
      other: string
    }
  }
  productList: {
    searchPlaceholder: string
    createProduct: string
    columns: {
      name: string
      status: string
      sellAmount: string
      pax: string
      startDate: string
    }
    loadingError: string
    empty: string
    showingSummary: string
  }
  productDepartureDialog: {
    titles: {
      create: string
      edit: string
    }
    descriptions: {
      create: string
      edit: string
    }
  }
  productDepartureForm: {
    fields: {
      startDate: string
      startTime: string
      endDate: string
      endTime: string
      timezone: string
      status: string
      unlimitedCapacity: string
      initialCapacity: string
      days: string
      nights: string
      notes: string
    }
    placeholders: {
      startDate: string
      endDate: string
      notes: string
    }
    validation: {
      startDateRequired: string
      startTimeRequired: string
      timezoneRequired: string
      endDateInvalid: string
      endTimeInvalid: string
      saveFailed: string
    }
    derived: {
      multiDayDeparture: string
    }
    actions: {
      createDeparture: string
      saveDeparture: string
    }
  }
  productAvailability: {
    title: string
    description: string
    titleSchedules: string
    descriptionSchedules: string
    createDeparture: string
    createSchedule: string
    loadingDeparturesError: string
    loadingSchedulesError: string
    emptyDepartures: string
    emptySchedules: string
    deleteDepartureConfirm: string
    deleteScheduleConfirm: string
    scheduleSummary: string
    cutoffSummary: string
    minPaxSummary: string
    inactiveBadge: string
    unlimitedCapacity: string
    durationUnits: {
      day: string
      days: string
      night: string
      nights: string
      hourSuffix: string
    }
    statusLabels: {
      open: string
      closed: string
      sold_out: string
      cancelled: string
    }
    columns: {
      start: string
      end: string
      duration: string
      status: string
      capacity: string
      timezone: string
    }
  }
  productScheduleDialog: {
    titles: {
      create: string
      edit: string
    }
    descriptions: {
      create: string
      edit: string
    }
  }
  productScheduleForm: {
    fields: {
      repeats: string
      every: string
      weekdays: string
      monthDays: string
      timezone: string
      status: string
      maxCapacity: string
      maxPickupCapacity: string
      minTotalPax: string
      cutoffMinutes: string
      earlyBookingLimitMinutes: string
      active: string
    }
    placeholders: {
      timezone: string
      selectSupplierService: string
    }
    validation: {
      timezoneRequired: string
      weekdayRequired: string
      monthDayRequired: string
      saveFailed: string
    }
    preview: {
      chooseWeekdays: string
      chooseDays: string
      everyUnit: string
      everyIntervalUnits: string
      onWeekdays: string
      onMonthDays: string
      units: {
        day: string
        days: string
        week: string
        weeks: string
        month: string
        months: string
      }
      weekdayLabels: {
        MO: string
        TU: string
        WE: string
        TH: string
        FR: string
        SA: string
        SU: string
      }
    }
    frequencyLabels: {
      DAILY: string
      WEEKLY: string
      MONTHLY: string
    }
    actions: {
      createSchedule: string
      saveSchedule: string
    }
  }
  productDayServiceDialog: {
    titles: {
      create: string
      edit: string
    }
    descriptions: {
      create: string
      edit: string
    }
  }
  productDayServiceForm: {
    fields: {
      supplierService: string
      serviceType: string
      name: string
      description: string
      supplierServiceId: string
      sortOrder: string
      currency: string
      cost: string
      quantity: string
      notes: string
    }
    placeholders: {
      supplierService: string
      name: string
      description: string
      supplierServiceId: string
      notes: string
      loadingSupplierServices: string
      supplierFallback: string
    }
    validation: {
      nameRequired: string
      costInvalid: string
      quantityInvalid: string
      saveFailed: string
    }
    actions: {
      addService: string
      saveService: string
    }
  }
  productItinerarySection: {
    titles: {
      default: string
      multiple: string
      media: string
    }
    descriptions: {
      default: string
      multiple: string
      media: string
    }
    actions: {
      addDay: string
      newItinerary: string
      renameItinerary: string
      duplicateItinerary: string
      rename: string
      duplicate: string
      setDefault: string
      delete: string
      addService: string
    }
    loadingError: {
      itineraries: string
      days: string
      services: string
    }
    empty: {
      itineraries: string
      days: string
      services: string
    }
    headings: {
      services: string
    }
    badges: {
      default: string
    }
    columns: {
      name: string
      type: string
      cost: string
      quantity: string
    }
    labels: {
      day: string
    }
    confirmations: {
      deleteDay: string
      deleteService: string
      deleteItineraryTitle: string
      deleteItineraryDescription: string
    }
    aria: {
      itineraryOptions: string
      itineraryItemOptions: string
    }
  }
}
