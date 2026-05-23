import type {
  CreditNoteRecord,
  InvoiceRecord,
  SupplierPaymentRecord,
} from "@voyantjs/finance-react"

export const invoiceStatuses = [
  "draft",
  "pending_external_allocation",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "void",
] as const

export const supplierPaymentMethods = [
  "bank_transfer",
  "credit_card",
  "cash",
  "cheque",
  "other",
] as const

export const paymentMethods = [
  "bank_transfer",
  "credit_card",
  "debit_card",
  "cash",
  "cheque",
  "wallet",
  "direct_bill",
  "voucher",
  "other",
] as const

export const supplierPaymentStatuses = ["pending", "completed", "failed", "refunded"] as const

export type InvoiceStatus = InvoiceRecord["status"]
export type InvoiceType = NonNullable<InvoiceRecord["invoiceType"]>
export type PaymentMethod = (typeof paymentMethods)[number]
export type SupplierPaymentMethod = (typeof supplierPaymentMethods)[number]
export type SupplierPaymentStatus = SupplierPaymentRecord["status"]
export type CreditNoteStatus = CreditNoteRecord["status"]

export type TaxesPageMessageKey =
  | "title"
  | "description"
  | "addTax"
  | "empty"
  | "inactive"
  | "edit"
  | "delete"
  | "deleteConfirm"
  | "editSheetTitle"
  | "newSheetTitle"
  | "taxClassBadge"
  | "defaultRegimeLabel"
  | "regimeOverridesLabel"
  | "regimeOverrideCount"
  | "taxClassSectionTitle"
  | "taxClassSectionDescription"
  | "defaultRegimeSectionTitle"
  | "defaultRegimeSectionDescription"
  | "regimeOverridesSectionTitle"
  | "regimeOverridesSectionDescription"
  | "addRegimeOverride"
  | "removeRegimeOverride"
  | "noRegimeOverrides"
  | "appliesToLabel"
  | "taxRegimeLabel"
  | "appliesToBase"
  | "appliesToAddon"
  | "appliesToAccommodation"
  | "appliesToAll"
  | "taxClassLabelLabel"
  | "taxClassLabelPlaceholder"
  | "taxClassCodeLabel"
  | "taxClassCodePlaceholder"
  | "taxClassDescriptionLabel"
  | "taxClassDescriptionPlaceholder"
  | "regimeNameLabel"
  | "regimeNamePlaceholder"
  | "regimeCodeLabel"
  | "rateLabel"
  | "jurisdictionLabel"
  | "legalReferenceLabel"
  | "legalReferencePlaceholder"
  | "regimeDescriptionLabel"
  | "regimeDescriptionPlaceholder"
  | "activeLabel"
  | "cancel"
  | "saveChanges"
  | "createTax"
  | "validationNameRequired"
  | "validationRateInvalid"
  | "saveFailed"
  | "policyTitle"
  | "policyDescription"
  | "addPolicyProfile"
  | "addPolicyRule"
  | "policyEmpty"
  | "policyRulesEmpty"
  | "deletePolicyProfileConfirm"
  | "deletePolicyRuleConfirm"
  | "editPolicyProfileSheetTitle"
  | "newPolicyProfileSheetTitle"
  | "editPolicyRuleSheetTitle"
  | "newPolicyRuleSheetTitle"
  | "policyProfileNameLabel"
  | "policyProfileNamePlaceholder"
  | "policyProfileCodeLabel"
  | "policyProfileCodePlaceholder"
  | "policyProfileDescriptionLabel"
  | "policyProfileDescriptionPlaceholder"
  | "policyPriorityLabel"
  | "policySideLabel"
  | "policyRuleNameLabel"
  | "policyRuleNamePlaceholder"
  | "policyConditionLabel"
  | "policyConditionSectionTitle"
  | "policyConditionSectionDescription"
  | "policyConditionModeLabel"
  | "policyConditionAlways"
  | "policyConditionAlwaysDescription"
  | "policyConditionModeAll"
  | "policyConditionModeAny"
  | "addPolicyCondition"
  | "removePolicyCondition"
  | "policyFactLabel"
  | "policyFactHasAccommodation"
  | "policyFactAccommodationCountries"
  | "policyOperatorLabel"
  | "policyOperatorEquals"
  | "policyOperatorContains"
  | "policyValueLabel"
  | "policyValueYes"
  | "policyValueNo"
  | "policyActionsLabel"
  | "policySideSell"
  | "policySideBuy"
  | "createPolicyProfile"
  | "createPolicyRule"
  | "validationPolicyProfileNameRequired"
  | "validationPolicyProfileRequired"
  | "validationPolicyRuleNameRequired"
  | "validationPolicyRuleRegimeRequired"
  | "validationPolicyRulePriorityInvalid"
  | "validationPolicyRuleConditionInvalid"
  | "savePolicyProfileFailed"
  | "savePolicyRuleFailed"

export type FinanceUiMessages = {
  common: {
    cancel: string
    saveChanges: string
    invoiceStatusLabels: Record<InvoiceStatus, string>
    paymentMethodLabels: Record<PaymentMethod, string>
    supplierPaymentMethodLabels: Record<SupplierPaymentMethod, string>
    supplierPaymentStatusLabels: Record<SupplierPaymentStatus, string>
  }
  invoiceDialog: {
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
    }
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
    }
  }
  invoicesPage: {
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
  paymentsPage: {
    title: string
    description: string
    searchPlaceholder: string
    actions: {
      recordPayment: string
    }
    kindLabels: {
      customer: string
      supplier: string
    }
    filters: {
      button: string
      kindLabel: string
      kindAll: string
      statusLabel: string
      statusAll: string
      methodLabel: string
      methodAll: string
      supplierLabel: string
      supplierAny: string
      supplierEmpty: string
      currencyLabel: string
      currencyAny: string
      paymentDateLabel: string
      dateAny: string
      clear: string
    }
    columns: {
      kind: string
      reference: string
      party: string
      amount: string
      status: string
      date: string
      method: string
    }
    noValue: string
    empty: string
    loadFailed: string
    pagination: {
      showing: string
      page: string
      previous: string
      next: string
    }
  }
  paymentDetailPage: {
    actions: {
      back: string
      viewInvoice: string
      viewBooking: string
      viewPerson: string
      viewOrganization: string
      viewSupplier: string
    }
    titles: {
      summary: string
      links: string
      metadata: string
    }
    fields: {
      amount: string
      baseAmount: string
      fxRate: string
      status: string
      method: string
      date: string
      reference: string
      notes: string
      kind: string
      paidBy: string
      paidTo: string
      organization: string
      invoice: string
      booking: string
      createdAt: string
      updatedAt: string
    }
    states: {
      loading: string
      loadFailed: string
      notFound: string
      noValue: string
    }
  }
  invoiceDetailPage: {
    title: string
    invoiceTypeLabels: Record<InvoiceType, string>
    actions: {
      back: string
      edit: string
      delete: string
      deleteTitle: string
      deleteDescription: string
      deleteOnlyDraft: string
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
  paymentPolicy: {
    form: {
      inherit: {
        label: string
        help: string
        tooltipLabel: string
      }
      depositKind: {
        label: string
        options: Record<"none" | "percent" | "fixed_cents", string>
      }
      depositValue: {
        percentLabel: string
        fixedLabel: string
      }
      depositHints: Record<"none" | "percent" | "fixed_cents", string>
      days: {
        minDaysLabel: string
        minDaysHelp: string
        balanceDaysLabel: string
        balanceDaysHelp: string
        graceDaysLabel: string
        graceDaysHelp: string
        tooltipLabel: string
        suffix: string
      }
    }
    preview: {
      inheriting: string
      sample: string
      scheduleTypes: Record<"deposit" | "balance" | "full", string>
      due: string
    }
  }
  taxesPage: Record<TaxesPageMessageKey, string>
  supplierPaymentDialog: {
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
  recordBookingPaymentDialog: {
    title: string
    /** Body intro. Includes the `{generateLink}` placeholder bolded by the dialog. */
    description: string
    /** Inline emphasized label used inside `description`. */
    generateLinkLabel: string
    fields: {
      invoice: string
      amountCents: string
      currency: string
      baseAmountCents: string
      fxRate: string
      paymentDate: string
      paymentMethod: string
      status: string
      referenceNumber: string
      notes: string
    }
    placeholders: {
      invoice: string
      currency: string
      /** Placeholder for manual FX rate. Placeholders: `{invoiceCurrency} {paymentCurrency}`. */
      fxRate: string
      referenceNumber: string
    }
    fx: {
      title: string
      /** Help text. Placeholders: `{invoiceCurrency} {paymentCurrency}`. */
      help: string
      /** Inline hint. Placeholders: `{invoiceCurrency} {paymentCurrency}`. */
      rateHint: string
      loadingRate: string
      /** Auto-rate hint. Placeholders: `{invoiceCurrency} {paymentCurrency}`. */
      autoRateHint: string
    }
    /** Per-row option label. Placeholders: `{number} {status} {balance} {currency}`. */
    invoiceOption: string
    /** Caption under the picker. Placeholders: `{total} {paid} {due} {currency}`. */
    invoiceMeta: string
    loadingInvoices: string
    noInvoices: string
    actions: {
      record: string
    }
    validation: {
      invoiceRequired: string
      amountMinimum: string
      baseAmountRequired: string
      recordFailed: string
    }
  }
}
