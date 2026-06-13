import type {
  ApServiceType,
  CostAllocationTargetType,
  SupplierInvoiceDetailPaymentMethod,
  SupplierInvoiceStatus,
} from "./core.js"

export type SupplierInvoicesPageMessages = {
  title: string
  description: string
  recordInvoice: string
  searchPlaceholder: string
  statusAll: string
  statusLabels: Record<SupplierInvoiceStatus, string>
  columns: {
    invoiceNo: string
    supplier: string
    status: string
    total: string
    balanceDue: string
    dueDate: string
  }
  empty: string
  loadFailed: string
  noDueDate: string
}

export type SupplierInvoiceDetailMessages = {
  loading: string
  notFound: string
  document: string
  breadcrumbRoot: string
  actions: {
    edit: string
    delete: string
  }
  deleteDialog: {
    title: string
    body: string
    cancel: string
    confirm: string
  }
  form: {
    editTitle: string
    supplierId: string
    supplierInvoiceNo: string
    status: string
    currency: string
    issueDate: string
    dueDate: string
    internalRef: string
    notes: string
    save: string
    saving: string
    /** Optional AI/OCR extraction extension point (shown only when wired). */
    extractUpload: string
    extracting: string
    /** Supplier picker (shown only when a search resolver is wired). */
    supplierSearchPlaceholder: string
    /** Inline "create supplier" row label; `{name}` = typed query. */
    supplierCreate: string
  }
  summary: {
    subtotal: string
    tax: string
    total: string
    paid: string
    balanceDue: string
    issueDate: string
    dueDate: string
    noValue: string
  }
  lines: {
    title: string
    description: string
    service: string
    qty: string
    unit: string
    tax: string
    total: string
    empty: string
    add: string
    edit: string
    remove: string
  }
  lineForm: {
    addTitle: string
    editTitle: string
    description: string
    serviceType: string
    costCategory: string
    costCategoryNone: string
    quantity: string
    unitAmount: string
    taxAmount: string
    total: string
    save: string
    serviceTypeLabels: Record<ApServiceType, string>
  }
  allocation: {
    title: string
    add: string
    target: string
    /** Header for the allocation target reference column. */
    reference: string
    /** Templated with `{currency}`. */
    amountLabel: string
    none: string
    /** Templated with `{amount}`. */
    remainder: string
    /** Templated with `{amount}`. */
    overAllocated: string
    save: string
    saving: string
    saveFailed: string
    targetTypeLabels: Record<CostAllocationTargetType, string>
  }
  payments: {
    title: string
    date: string
    method: string
    status: string
    amount: string
    empty: string
    /** Templated with `{currency}`. */
    amountLabel: string
    methodLabel: string
    dateLabel: string
    record: string
    recordTitle: string
    recording: string
    methodLabels: Record<SupplierInvoiceDetailPaymentMethod, string>
  }
  attachments: {
    title: string
    upload: string
    uploading: string
    empty: string
    name: string
    size: string
    download: string
    remove: string
  }
}

export type SupplierPaymentDialogMessages = {
  title: string
  fields: {
    bookingId: string
    supplierId: string
    amountCents: string
    currency: string
    paymentDate: string
    paymentMethod: string
    status: string
    referenceNumber: string
    notes: string
  }
  placeholders: {
    bookingId: string
    supplierId: string
    paymentDate: string
    referenceNumber: string
    notes: string
  }
  actions: {
    create: string
  }
  validation: {
    bookingIdRequired: string
    amountMinimum: string
    paymentDateRequired: string
  }
}
