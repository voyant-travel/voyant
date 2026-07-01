import type {
  CreditNoteStatus,
  InvoiceStatus,
  InvoiceType,
  PaymentMethod,
  SupplierPaymentMethod,
  SupplierPaymentStatus,
} from "./core.js"

export type CommonMessages = {
  cancel: string
  saveChanges: string
  invoiceStatusLabels: Record<InvoiceStatus, string>
  paymentMethodLabels: Record<PaymentMethod, string>
  supplierPaymentMethodLabels: Record<SupplierPaymentMethod, string>
  supplierPaymentStatusLabels: Record<SupplierPaymentStatus, string>
}

export type InvoiceDialogMessages = {
  titles: {
    create: string
    edit: string
  }
  fields: {
    invoiceNumber: string
    status: string
    bookingId: string
    currency: string
    subtotalCents: string
    taxCents: string
    totalCents: string
    issueDate: string
    dueDate: string
    notes: string
    /** Document kind: `Invoice` or `Proforma`. */
    type: string
    /** Source-of-truth selector: custom, from schedule. */
    source: string
    /** Picker shown when source is "from schedule". */
    schedule: string
    /** Toggle: also create a fully-paid payment for the new invoice. */
    markAsPaid: string
    /** Payment method picker shown when markAsPaid is on. */
    markAsPaidMethod: string
    /** Payment date picker shown when markAsPaid is on. */
    markAsPaidDate: string
    /** Toggle: push the document to SmartBill (or any active e-invoicing plugin). */
    syncToSmartbill: string
    /** Attachment dropzone label shown when syncToSmartbill is off. */
    attachments: string
  }
  typeLabels: {
    invoice: string
    proforma: string
  }
  sourceLabels: {
    custom: string
    schedule: string
  }
  schedulePlaceholder: string
  scheduleEmpty: string
  scheduleLoadError: string
  /** Description shown when source is "from schedule" — amounts are locked. */
  scheduleLockedHint: string
  attachmentsHint: string
  /** Hint shown under the invoice number field when SmartBill assigns it. */
  invoiceNumberAutoHint: string
  placeholders: {
    invoiceNumber: string
    bookingId: string
    issueDate: string
    dueDate: string
    notes: string
  }
  actions: {
    create: string
  }
  validation: {
    invoiceNumberRequired: string
    bookingIdRequired: string
    currencyIsoCode: string
    issueDateRequired: string
    dueDateRequired: string
    lineItemInvalid: string
  }
  lineItems: {
    sectionTitle: string
    addRow: string
    empty: string
    description: string
    quantity: string
    unitPrice: string
    taxPercent: string
    lineTotal: string
    remove: string
  }
}

export type InvoicesPageMessages = {
  title: string
  description: string
  searchPlaceholder: string
  actions: {
    newInvoice: string
  }
  bulkActions: {
    selectionSummary: string
    clearSelection: string
    markPaid: string
    markPaidConfirm: string
    markPaidTitle: string
    markPaidDescription: string
    selectAllOnPage: string
    selectInvoice: string
    successTitle: string
    successDescription: string
    partialTitle: string
    partialDescription: string
  }
  filters: {
    button: string
    statusLabel: string
    statusAll: string
    currencyLabel: string
    currencyAny: string
    dueDateLabel: string
    dateAny: string
    clear: string
  }
  columns: {
    invoiceNumber: string
    status: string
    total: string
    paid: string
    balanceDue: string
    dueDate: string
  }
  empty: string
  loadFailed: string
  pagination: {
    showing: string
    page: string
    previous: string
    next: string
  }
}

export type InvoiceDetailPageMessages = {
  title: string
  invoiceTypeLabels: Record<InvoiceType, string>
  actions: {
    back: string
    edit: string
    convertToInvoice: string
    convertToInvoiceTitle: string
    convertToInvoiceDescription: string
    void: string
    voidTitle: string
    voidDescription: string
    voidUnavailable: string
    voidReasonPlaceholder: string
    delete: string
    deleteTitle: string
    deleteDescription: string
    deleteOnlyDraft: string
    mutationFailed: string
    viewBooking: string
    viewPerson: string
    viewOrganization: string
    addLineItem: string
    editLineItem: string
    deleteLineItemShort: string
    deleteLineItemTitle: string
    deleteLineItemDescription: string
    recordPayment: string
    addCreditNote: string
    addNote: string
    addAttachment: string
    editAttachment: string
    deleteAttachmentShort: string
    deleteAttachmentTitle: string
    deleteAttachmentDescription: string
    loadOlderActionLedger: string
  }
  titles: {
    summary: string
    links: string
    lineItems: string
    payments: string
    creditNotes: string
    notes: string
    attachments: string
    actionLedger: string
  }
  fields: {
    currency: string
    subtotal: string
    tax: string
    total: string
    paid: string
    balanceDue: string
    status: string
    issueDate: string
    dueDate: string
    booking: string
    person: string
    organization: string
    notes: string
    createdAt: string
    updatedAt: string
    name: string
    kind: string
    mimeType: string
    fileSize: string
    storageKey: string
    checksum: string
  }
  columns: {
    description: string
    quantity: string
    unitPrice: string
    total: string
    taxRate: string
    name: string
    kind: string
    mimeType: string
    size: string
  }
  states: {
    loading: string
    loadFailed: string
    notFound: string
    noValue: string
    noLineItems: string
    noPayments: string
    noCreditNotes: string
    noNotes: string
    noAttachments: string
    noActionLedger: string
    actionLedgerLoadFailed: string
  }
  placeholders: {
    note: string
    attachmentName: string
    attachmentKind: string
    attachmentMimeType: string
    attachmentFileSize: string
    attachmentStorageKey: string
    attachmentChecksum: string
  }
  attachmentDialog: {
    createTitle: string
    editTitle: string
    createAction: string
    nameRequired: string
  }
  noteDialog: {
    title: string
    createAction: string
    contentRequired: string
  }
  creditNoteStatusLabels: Record<CreditNoteStatus, string>
}
