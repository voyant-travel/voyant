export const queryKeys = {
  contacts: {
    all: ["contacts"] as const,
    list: (search?: string) => [...queryKeys.contacts.all, "list", { search }] as const,
    detail: (id: string) => [...queryKeys.contacts.all, "detail", id] as const,
    notes: (id: string) => [...queryKeys.contacts.all, id, "notes"] as const,
    communications: (id: string) => [...queryKeys.contacts.all, id, "communications"] as const,
  },
  suppliers: {
    all: ["suppliers"] as const,
    list: (search?: string) => [...queryKeys.suppliers.all, "list", { search }] as const,
    detail: (id: string) => [...queryKeys.suppliers.all, "detail", id] as const,
    services: (id: string) => [...queryKeys.suppliers.all, id, "services"] as const,
    rates: (id: string) => [...queryKeys.suppliers.all, id, "rates"] as const,
    notes: (id: string) => [...queryKeys.suppliers.all, id, "notes"] as const,
    availability: (id: string) => [...queryKeys.suppliers.all, id, "availability"] as const,
    contracts: (id: string) => [...queryKeys.suppliers.all, id, "contracts"] as const,
  },
  products: {
    all: ["products"] as const,
    list: (search?: string) => [...queryKeys.products.all, "list", { search }] as const,
    detail: (id: string) => [...queryKeys.products.all, "detail", id] as const,
    days: (id: string) => [...queryKeys.products.all, id, "days"] as const,
    versions: (id: string) => [...queryKeys.products.all, id, "versions"] as const,
    notes: (id: string) => [...queryKeys.products.all, id, "notes"] as const,
  },
  bookings: {
    all: ["bookings"] as const,
    list: (search?: string) => [...queryKeys.bookings.all, "list", { search }] as const,
    detail: (id: string) => [...queryKeys.bookings.all, "detail", id] as const,
    travelers: (id: string) => [...queryKeys.bookings.all, id, "travelers"] as const,
    supplierStatuses: (id: string) => [...queryKeys.bookings.all, id, "supplierStatuses"] as const,
    activityLog: (id: string) => [...queryKeys.bookings.all, id, "activityLog"] as const,
    actionLedger: (id: string) => [...queryKeys.bookings.all, id, "actionLedger"] as const,
    notes: (id: string) => [...queryKeys.bookings.all, id, "notes"] as const,
    documents: (id: string) => [...queryKeys.bookings.all, id, "documents"] as const,
  },
  actionLedger: {
    all: ["actionLedger"] as const,
    entries: (filtersKey?: string) =>
      [...queryKeys.actionLedger.all, "entries", filtersKey ?? ""] as const,
    approvals: (status?: string) =>
      [...queryKeys.actionLedger.all, "approvals", { status }] as const,
  },
  inviteTokens: {
    all: ["inviteTokens"] as const,
    list: (operatorId: string) => ["inviteTokens", operatorId, "list"] as const,
  },
  grants: {
    all: ["grants"] as const,
    list: (operatorId: string) => ["grants", operatorId, "list"] as const,
  },
  finance: {
    all: ["finance"] as const,
    invoices: {
      all: ["finance", "invoices"] as const,
      list: (search?: string) => ["finance", "invoices", "list", { search }] as const,
      detail: (id: string) => ["finance", "invoices", "detail", id] as const,
    },
    payments: (invoiceId: string) => ["finance", "payments", invoiceId] as const,
    creditNotes: {
      all: ["finance", "creditNotes"] as const,
      list: () => ["finance", "creditNotes", "list"] as const,
    },
    supplierPayments: {
      all: ["finance", "supplierPayments"] as const,
      list: () => ["finance", "supplierPayments", "list"] as const,
    },
    notes: (entityType: string, entityId: string) =>
      ["finance", "notes", entityType, entityId] as const,
    reports: {
      revenue: (from?: string, to?: string) =>
        ["finance", "reports", "revenue", { from, to }] as const,
      aging: () => ["finance", "reports", "aging"] as const,
      profitability: (from?: string, to?: string) =>
        ["finance", "reports", "profitability", { from, to }] as const,
    },
  },
}
