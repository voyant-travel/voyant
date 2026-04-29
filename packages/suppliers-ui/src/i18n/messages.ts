import type { Supplier, SupplierRate, SupplierService } from "@voyantjs/suppliers-react"

export type SupplierType = Supplier["type"]
export type SupplierStatus = Supplier["status"]
export type SupplierServiceType = SupplierService["serviceType"]
export type SupplierRateUnit = SupplierRate["unit"]

export type SuppliersUiMessages = {
  common: {
    edit: string
    delete: string
    add: string
    open: string
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
    columns: {
      name: string
      type: string
      status: string
      city: string
      country: string
      currency: string
    }
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
