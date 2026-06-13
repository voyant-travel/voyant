import type { Supplier, SupplierRate, SupplierService } from "../index.js"

export type SupplierType = Supplier["type"]
export type SupplierStatus = Supplier["status"]
export type SupplierServiceType = SupplierService["serviceType"]
export type SupplierRateUnit = SupplierRate["unit"]

export type SuppliersUiMessages = {
  common: {
    edit: string
    delete: string
    add: string
    save: string
    create: string
    cancel: string
    back: string
    open: string
    active: string
    inactive: string
    none: string
    unknown: string
    maxPax: string
    supplierTypeLabels: Record<SupplierType, string>
    supplierStatusLabels: Record<SupplierStatus, string>
    serviceTypeLabels: Record<SupplierServiceType, string>
    rateUnitLabels: Record<SupplierRateUnit, string>
  }
  suppliersPage: {
    title: string
    description: string
    create: string
    searchPlaceholder: string
    summary: string
    previous: string
    next: string
    page: string
    filters: string
    clearFilters: string
    allTypes: string
    allStatuses: string
    countryPlaceholder: string
    currencyPlaceholder: string
    filterTypeLabel: string
    filterStatusLabel: string
    filterCountryLabel: string
    filterCurrencyLabel: string
    empty: string
    loadFailed: string
    columns: {
      name: string
      type: string
      status: string
      city: string
      country: string
      currency: string
    }
  }
  supplierDetailPage: {
    backToSuppliers: string
    notFound: string
    loadFailed: string
    details: string
    contact: string
    noContact: string
    services: string
    addService: string
    noServices: string
    notes: string
    notePlaceholder: string
    addNote: string
    noNotes: string
    deleteSupplierConfirm: string
    deleteServiceConfirm: string
    deleteRateConfirm: string
    labels: {
      type: string
      status: string
      city: string
      country: string
      currency: string
      reservationTimeout: string
      email: string
      phone: string
      website: string
      address: string
      contactName: string
      contactEmail: string
      contactPhone: string
      created: string
      updated: string
    }
  }
  supplierCombobox: {
    placeholder: string
    empty: string
    loading: string
  }
  dialogs: {
    supplier: SupplierFormMessages
    service: ServiceFormMessages
    rate: RateFormMessages
  }
  supplierServiceRow: {
    rates: string
    addRate: string
    noRates: string
    columns: {
      name: string
      amount: string
      unit: string
      valid: string
      pax: string
    }
    validFallback: string
  }
}

export type SupplierFormMessages = {
  newTitle: string
  editTitle: string
  nameLabel: string
  namePlaceholder: string
  typeLabel: string
  statusLabel: string
  descriptionLabel: string
  descriptionPlaceholder: string
  emailLabel: string
  emailPlaceholder: string
  phoneLabel: string
  phonePlaceholder: string
  websiteLabel: string
  websitePlaceholder: string
  addressLabel: string
  addressPlaceholder: string
  cityLabel: string
  cityPlaceholder: string
  countryLabel: string
  countryPlaceholder: string
  defaultCurrencyLabel: string
  defaultCurrencyPlaceholder: string
  reservationTimeoutLabel: string
  reservationTimeoutPlaceholder: string
  contactNameLabel: string
  contactNamePlaceholder: string
  contactEmailLabel: string
  contactEmailPlaceholder: string
  contactPhoneLabel: string
  contactPhonePlaceholder: string
  validationNameRequired: string
  validationIsoCurrency: string
  validationReservationTimeout: string
}

export type ServiceFormMessages = {
  newTitle: string
  editTitle: string
  serviceTypeLabel: string
  nameLabel: string
  namePlaceholder: string
  descriptionLabel: string
  descriptionPlaceholder: string
  durationLabel: string
  durationPlaceholder: string
  capacityLabel: string
  capacityPlaceholder: string
  activeLabel: string
  validationNameRequired: string
}

export type RateFormMessages = {
  newTitle: string
  editTitle: string
  seasonNameLabel: string
  seasonNamePlaceholder: string
  currencyLabel: string
  currencyPlaceholder: string
  amountLabel: string
  amountPlaceholder: string
  unitLabel: string
  validFromLabel: string
  validToLabel: string
  minPaxLabel: string
  minPaxPlaceholder: string
  maxPaxLabel: string
  maxPaxPlaceholder: string
  notesLabel: string
  notesPlaceholder: string
  validationNameRequired: string
  validationIsoCurrency: string
  validationNonNegative: string
}
