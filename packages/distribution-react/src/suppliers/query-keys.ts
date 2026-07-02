export interface PaginationFilters {
  limit?: number | undefined
  offset?: number | undefined
}

export type SuppliersListSortField = "name" | "type" | "status" | "defaultCurrency" | "createdAt"

export type SuppliersListSortDir = "asc" | "desc"

export interface SuppliersListFilters extends PaginationFilters {
  type?: string | undefined
  status?: string | undefined
  country?: string | undefined
  defaultCurrency?: string | undefined
  primaryFacilityId?: string | undefined
  search?: string | undefined
  sortBy?: SuppliersListSortField | undefined
  sortDir?: SuppliersListSortDir | undefined
}

export interface SupplierAvailabilityFilters {
  from?: string | undefined
  to?: string | undefined
}

export const suppliersQueryKeys = {
  all: ["voyant", "suppliers"] as const,

  suppliers: () => [...suppliersQueryKeys.all, "suppliers"] as const,
  suppliersList: (filters: SuppliersListFilters) =>
    [...suppliersQueryKeys.suppliers(), "list", filters] as const,
  supplierDetail: (id: string) => [...suppliersQueryKeys.suppliers(), "detail", id] as const,

  services: () => [...suppliersQueryKeys.all, "services"] as const,
  supplierServices: (supplierId: string) =>
    [...suppliersQueryKeys.services(), "list", supplierId] as const,

  notes: () => [...suppliersQueryKeys.all, "notes"] as const,
  supplierNotes: (supplierId: string) =>
    [...suppliersQueryKeys.notes(), "list", supplierId] as const,

  contactPoints: () => [...suppliersQueryKeys.all, "contact-points"] as const,
  supplierContactPoints: (supplierId: string) =>
    [...suppliersQueryKeys.contactPoints(), "list", supplierId] as const,

  contacts: () => [...suppliersQueryKeys.all, "contacts"] as const,
  supplierContacts: (supplierId: string) =>
    [...suppliersQueryKeys.contacts(), "list", supplierId] as const,

  addresses: () => [...suppliersQueryKeys.all, "addresses"] as const,
  supplierAddresses: (supplierId: string) =>
    [...suppliersQueryKeys.addresses(), "list", supplierId] as const,

  availability: () => [...suppliersQueryKeys.all, "availability"] as const,
  supplierAvailability: (supplierId: string, filters: SupplierAvailabilityFilters = {}) =>
    [...suppliersQueryKeys.availability(), "list", supplierId, filters] as const,

  contracts: () => [...suppliersQueryKeys.all, "contracts"] as const,
  supplierContracts: (supplierId: string) =>
    [...suppliersQueryKeys.contracts(), "list", supplierId] as const,

  rates: () => [...suppliersQueryKeys.all, "rates"] as const,
  supplierServiceRates: (supplierId: string, serviceId: string) =>
    [...suppliersQueryKeys.rates(), "list", supplierId, serviceId] as const,
} as const
