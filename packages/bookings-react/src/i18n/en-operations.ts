import type { BookingsUiOperationsMessages } from "./messages-operations.js"

export const bookingsUiEnOperations = {
  statusChangeDialog: {
    title: "Change booking status",
    fields: {
      status: "New status",
      note: "Note (optional)",
      suppressNotifications: "Don't notify the customer",
    },
    placeholders: {
      note: "Reason for status change...",
    },
    helpers: {
      suppressNotifications:
        "Confirm silently — skip the confirmation email and any document bundle that would normally go out.",
    },
    actions: {
      updateStatus: "Update status",
    },
  },
  supplierStatusDialog: {
    titles: {
      create: "Add supplier status",
      edit: "Update supplier status",
    },
    fields: {
      serviceName: "Service name",
      status: "Status",
      costCurrency: "Cost currency",
      costAmountCents: "Cost amount",
      supplierReference: "Supplier reference",
      notes: "Notes",
    },
    placeholders: {
      serviceName: "Hotel Dubrovnik Palace",
      supplierReference: "CONF-12345",
      notes: "Additional notes...",
    },
    validation: {
      serviceNameRequired: "Service name is required",
      costCurrencyInvalid: "Use 3-letter ISO code",
    },
    actions: {
      addSupplierStatus: "Add",
    },
  },
  bookingItemList: {
    title: "Items",
    addItem: "Add item",
    empty: "No items yet.",
    values: {
      totalUnavailable: "-",
      costUnavailable: "-",
      serviceDateUnavailable: "-",
    },
    columns: {
      title: "Title",
      option: "Option",
      unit: "Unit",
      type: "Type",
      status: "Status",
      quantity: "Qty",
      total: "Total",
      cost: "Cost",
      serviceDate: "Dates",
    },
    detail: {
      description: "Description",
      dates: "Dates",
      cost: "Cost",
      catalogSource: "Catalog source",
      productLink: "Open product",
      noDescription: "No description captured for this item.",
    },
    actions: {
      deleteConfirm: {
        title: "Delete this item?",
        description: "This removes the item from the booking. This action cannot be undone.",
        cancel: "Cancel",
        confirm: "Delete",
      },
      expandItem: "Expand item",
      collapseItem: "Collapse item",
      viewItem: "View item",
      editItem: "Edit item",
      deleteItem: "Delete item",
    },
    snapshot: {
      title: "Item snapshot",
      subtitle: "Captured at booking time — never updated.",
      sectionSummary: "Summary",
      sectionPricing: "Pricing",
      sectionMeta: "Meta",
      productLabel: "Product",
      optionLabel: "Option",
      unitLabel: "Unit",
      descriptionLabel: "Description",
      typeLabel: "Type",
      statusLabel: "Status",
      datesLabel: "Dates",
      quantityLabel: "Quantity",
      unitSellLabel: "Unit sell",
      totalSellLabel: "Total sell",
      unitCostLabel: "Unit cost",
      totalCostLabel: "Total cost",
      notesLabel: "Notes",
      createdAtLabel: "Created",
      updatedAtLabel: "Updated",
      empty: "—",
    },
  },
  bookingPaymentScheduleList: {
    title: "Payment schedule",
    addSchedule: "Add schedule",
    empty: "No payment schedules yet.",
    values: {
      notesUnavailable: "-",
      proformaSuffix: "proforma",
    },
    columns: {
      type: "Type",
      status: "Status",
      dueDate: "Due date",
      amount: "Amount",
      notes: "Notes",
      invoice: "Invoice",
    },
    actions: {
      deleteConfirm: {
        title: "Delete this payment schedule?",
        description:
          "This removes the schedule entry from the booking. This action cannot be undone.",
        cancel: "Cancel",
        confirm: "Delete",
      },
      editSchedule: "Edit schedule",
      deleteSchedule: "Delete schedule",
      issueDocument: "Issue document",
      issueInvoice: "Issue invoice",
      issueProforma: "Issue proforma",
      issueDocumentSuccess: "Document issued.",
      issueDocumentFailure: "Could not issue document",
      issueDocumentErrors: {
        invoice_number_series_not_found:
          "The selected number series was not found. Review Finance > Number Series before issuing this document.",
        invoice_number_series_inactive:
          "The selected number series is inactive. Activate it in Finance > Number Series before issuing this document.",
        invoice_number_series_scope_mismatch:
          "The selected number series does not match this document type. Choose a matching series in Finance > Number Series.",
        no_active_series_for_scope:
          "No active number series exists for this document type. Create or activate one in Finance > Number Series.",
      },
    },
  },
  bookingPaymentReconciliationBanner: {
    title: "Payment reconciliation",
    loading: "Checking payment sources...",
    empty: "No invoices, payments, or schedule rows have been recorded yet.",
    reconciledDescription:
      "Invoice paid totals, recorded payments, and paid schedule rows currently agree.",
    driftDescription:
      "Invoice paid totals, recorded payments, and paid schedule rows disagree. Review the source rows before collecting or recording more money.",
    reconciledBadge: "Reconciled",
    driftBadge: "Needs review",
    billed: "Billed",
    invoicePaid: "Paid on invoices",
    recordedPayments: "Recorded payments",
    schedulePaid: "Paid schedule rows",
    drift: "Drift",
    emptyValue: "-",
  },
  supplierStatusList: {
    title: "Supplier confirmations",
    addSupplier: "Add supplier",
    empty: "No supplier statuses yet.",
    values: {
      costUnavailable: "-",
      referenceUnavailable: "-",
      confirmedUnavailable: "-",
    },
    columns: {
      service: "Service",
      status: "Status",
      cost: "Cost",
      reference: "Reference",
      confirmed: "Confirmed",
      actions: "Actions",
    },
    actions: {
      edit: "Edit supplier status",
    },
  },
  bookingCancellationDialog: {
    title: "Cancel booking",
    summary: {
      booking: "Booking",
      startDate: "Start date",
      total: "Total",
      daysBeforeDeparture: "Days before departure",
    },
    values: {
      startDateTbd: "TBD",
      amountUnavailable: "-",
      ruleFallback: "-",
      ruleDaysBeforeDeparture: ">= {days} days",
    },
    policy: {
      applicablePolicy: "Applicable policy",
      refund: "Refund",
      penalty: "Penalty",
      rule: "Rule",
      resolving: "Resolving cancellation policy...",
      missing: "No cancellation policy configured for this booking.",
      missingHint:
        "Proceeding will cancel without a refund preview. Paid bookings will be marked for settlement review.",
      calculating: "Calculating refund...",
      noTotalAmount: "Booking has no total amount. Refund cannot be calculated.",
    },
    paidSettlement: {
      title: "Paid booking settlement required",
      description:
        "Cancelling keeps existing invoices and payments intact and records an action-required finance note to review a refund, credit note, or no-refund decision.",
    },
    refundTypeLabels: {
      cash: "Cash refund",
      credit: "Credit",
      cash_or_credit: "Cash or credit",
      none: "No refund",
    },
    fields: {
      reason: "Reason",
    },
    placeholders: {
      reason: "Why is this booking being cancelled?",
    },
    validation: {
      cancellationFailed: "Cancellation failed",
    },
    actions: {
      close: "Close",
      confirm: "Confirm cancellation",
    },
  },
  bookingBillingDialog: {
    title: "Edit billing contact",
    fields: {
      partyType: "Billing type",
      firstName: "First name",
      lastName: "Last name",
      companyName: "Name",
      taxId: "Tax ID",
      email: "Email",
      phone: "Phone",
      addressLine1: "Address line 1",
      addressLine2: "Address line 2",
      city: "City",
      region: "Region / state",
      postalCode: "Postal code",
      country: "Country",
    },
    partyTypeLabels: {
      individual: "Individual",
      company: "Company",
    },
    crmPicker: {
      label: "CRM source",
      personSearchPlaceholder: "Search people...",
      personEmpty: "No people found.",
      organizationSearchPlaceholder: "Search organizations...",
      organizationEmpty: "No organizations found.",
    },
    actions: {
      cancel: "Cancel",
      selectFromCrm: "Select from CRM",
      hideCrmPicker: "Hide CRM picker",
      save: "Save changes",
    },
  },
  bookingGuaranteeDialog: {
    titles: {
      create: "Add guarantee",
      edit: "Edit guarantee",
    },
    guaranteeTypeLabels: {
      deposit: "Deposit",
      credit_card: "Credit card",
      preauth: "Preauthorization",
      card_on_file: "Card on file",
      bank_transfer: "Bank transfer",
      voucher: "Voucher",
      agency_letter: "Agency letter",
      other: "Other",
    },
    guaranteeStatusLabels: {
      pending: "Pending",
      active: "Active",
      released: "Released",
      failed: "Failed",
      cancelled: "Cancelled",
      expired: "Expired",
    },
    fields: {
      type: "Type",
      status: "Status",
      currency: "Currency",
      amountCents: "Amount",
      provider: "Provider",
      referenceNumber: "Reference number",
      expiresAt: "Expires at",
      notes: "Notes",
    },
    placeholders: {
      provider: "Stripe, bank name...",
      referenceNumber: "External reference...",
      expiresAt: "Select expiry date & time",
      notes: "Guarantee notes...",
    },
    actions: {
      addGuarantee: "Add guarantee",
    },
  },
  bookingGuaranteeList: {
    title: "Guarantees",
    addGuarantee: "Add guarantee",
    empty: "No guarantees yet.",
    values: {
      amountUnavailable: "-",
      providerUnavailable: "-",
      referenceUnavailable: "-",
      expiresUnavailable: "-",
    },
    columns: {
      type: "Type",
      status: "Status",
      amount: "Amount",
      provider: "Provider",
      reference: "Reference",
      expires: "Expires",
    },
    actions: {
      deleteConfirm: {
        title: "Delete this guarantee?",
        description:
          "This removes the guarantee record from the booking. This action cannot be undone.",
        cancel: "Cancel",
        confirm: "Delete",
      },
      editGuarantee: "Edit guarantee",
      deleteGuarantee: "Delete guarantee",
    },
  },
  bookingGroupLinkDialog: {
    title: "Link booking to shared room",
    modes: {
      join: "Join existing",
      create: "Create new",
    },
    fields: {
      existingGroups: "Existing groups",
      groupLabel: "Group label",
    },
    placeholders: {
      selectGroup: "Select a group...",
      noExistingGroups: "No existing groups",
      groupLabel: "e.g. Smith + Jones, Room 204",
    },
    hints: {
      productFiltered: "Filtered to groups for the booking's product.",
      primaryMember: "This booking will be marked as the primary member.",
    },
    validation: {
      selectGroup: "Select a group to join",
      linkFailed: "Failed to link booking",
    },
    actions: {
      createAndLink: "Create & link",
      linkToGroup: "Link to group",
    },
    labels: {
      generatedLabelPrefix: "Shared room",
    },
  },
  bookingGroupSection: {
    title: "Shared room",
    empty: "This booking is not linked to a shared-room group.",
    group: "Group",
    siblingBookings: "Sibling bookings ({count})",
    noSiblingBookings:
      "No other bookings linked yet. Share the group id with another booking to link them.",
    primaryBadge: "Primary",
    sharedRoomKind: "Shared room",
    actions: {
      removeFromGroup: "Remove from group",
      linkToSharedRoom: "Link to shared room",
      removeConfirm: "Remove this booking from the shared-room group?",
    },
  },
} satisfies BookingsUiOperationsMessages
