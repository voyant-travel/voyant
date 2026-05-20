import {
  formatAmount,
  formatUnit,
  getSupplierNotesQueryOptions as getSupplierNotesQueryOptionsBase,
  getSupplierQueryOptions as getSupplierQueryOptionsBase,
  getSupplierServiceRatesQueryOptions as getSupplierServiceRatesQueryOptionsBase,
  getSupplierServicesQueryOptions as getSupplierServicesQueryOptionsBase,
  getSuppliersQueryOptions as getSuppliersQueryOptionsBase,
  type Supplier,
  type SupplierNote,
  type SupplierRate,
  type SupplierService,
  type SuppliersListFilters,
  statusVariant,
  suppliersQueryKeys,
} from "@voyantjs/suppliers-react"
import type { AdminMessages } from "@/lib/admin-i18n"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

// operatorFetcher so SSR loaders forward the request cookie.
const client = { baseUrl: getApiUrl(), fetcher: operatorFetcher }

export type { Supplier, SupplierNote, SupplierRate, SupplierService }
export { formatAmount, formatUnit, statusVariant, suppliersQueryKeys }

export function getSupplierTypeLabel(type: Supplier["type"], messages: AdminMessages) {
  return messages.suppliers.typeLabels[type]
}

export function getSupplierStatusLabel(status: Supplier["status"], messages: AdminMessages) {
  return messages.suppliers.statusLabels[status]
}

export function getServiceTypeLabel(
  serviceType: SupplierService["serviceType"],
  messages: AdminMessages,
) {
  return messages.suppliers.serviceTypeLabels[serviceType]
}

export function getRateUnitLabel(unit: SupplierRate["unit"], messages: AdminMessages) {
  return messages.suppliers.rateUnitLabels[unit]
}

export function getSuppliersQueryOptions(options: SuppliersListFilters = {}) {
  return getSuppliersQueryOptionsBase(client, options)
}

export function getSupplierQueryOptions(id: string) {
  return getSupplierQueryOptionsBase(client, id)
}

export function getSupplierServicesQueryOptions(id: string) {
  return getSupplierServicesQueryOptionsBase(client, id)
}

export function getSupplierNotesQueryOptions(id: string) {
  return getSupplierNotesQueryOptionsBase(client, id)
}

export function getSupplierServiceRatesQueryOptions(supplierId: string, serviceId: string) {
  return getSupplierServiceRatesQueryOptionsBase(client, supplierId, serviceId)
}
