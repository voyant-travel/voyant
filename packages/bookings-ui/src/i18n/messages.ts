export type BookingsUiMessages = {
  common: {
    cancel: string
    saveChanges: string
    add: string
    loading: string
    bookingStatusLabels: Record<
      | "draft"
      | "on_hold"
      | "awaiting_payment"
      | "confirmed"
      | "in_progress"
      | "completed"
      | "expired"
      | "cancelled",
      string
    >
    supplierStatusLabels: Record<"pending" | "confirmed" | "rejected" | "cancelled", string>
  }
  bookingsPage: {
    title: string
    description: string
  }
  bookingCreatePage: {
    title: string
    description: string
  }
  bookingCombobox: {
    placeholder: string
    empty: string
    loading: string
  }
  bookingQuickViewSheet: {
    loadingTitle: string
    viewFullAction: string
    paxSuffix: string
    travelerUnnamed: string
    sectionPayer: string
    sectionTravelers: string
    sectionTravelerDocuments: string
    travelerReveal: {
      showAction: string
      hideAction: string
      empty: string
      error: string
      dateOfBirth: string
      nationality: string
      documentType: string
      documentNumber: string
      documentExpiry: string
      documentIssuingCountry: string
      documentIssuingAuthority: string
      dietaryRequirements: string
      accessibilityNeeds: string
      bedPreference: string
      address: string
    }
    travelersEmpty: string
    travelerCategoryLabels: Record<"adult" | "child" | "infant" | "lead", string>
    sectionPayments: string
    paymentsPaid: string
    paymentsRemaining: string
    sectionInvoices: string
    invoicesEmpty: string
    invoiceStatusLabels: Record<
      "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "void",
      string
    >
    sectionPaymentSchedule: string
    scheduleCountSuffix: string
    scheduleEmpty: string
    scheduleTypeLabels: Record<"deposit" | "installment" | "balance" | "hold" | "other", string>
    sectionContracts: string
    contractsEmpty: string
    contractStatusLabels: Record<
      "draft" | "issued" | "sent" | "signed" | "executed" | "expired" | "void",
      string
    >
  }
  bookingDetailPage: {
    notFound: string
    backToBookings: string
    breadcrumbBookings: string
    editAction: string
    changeStatusAction: string
    cancelBookingAction: string
    deleteAction: string
    deleteConfirm: string
    /** Body copy under the delete confirmation title. `{number}` interpolates the booking number. */
    deleteConfirmDescription: string
    /** Fallback description used when the booking has no number (rare). */
    deleteConfirmDescriptionFallback: string
    deleteConfirmAction: string
    deleteCancel: string
    collectPaymentAction: string
    recordPaymentAction: string
    noValue: string
    tbd: string
    summaryTotal: string
    summaryPaid: string
    summaryPriceOverride: string
    summaryCostMargin: string
    summaryDates: string
    summaryTravelers: string
    summaryPerson: string
    summaryOrganization: string
    summaryCreated: string
    summaryUpdated: string
    tabOverview: string
    tabMetadata: string
    tabTravelers: string
    tabFinance: string
    tabInvoices: string
    tabSuppliers: string
    tabDocuments: string
    tabActivity: string
    metadataSection: {
      title: string
      bookingId: string
      bookingNumber: string
      status: string
      communicationLanguage: string
      created: string
      updated: string
    }
    internalNotesLabel: string
    billingPayer: string
    billingTaxId: string
    billingEmail: string
    billingPhone: string
    billingAddress: string
    documentsSlotEmpty: string
  }
  travelerDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      firstName: string
      lastName: string
      email: string
      phone: string
      specialRequests: string
      travelDetailsHeading: string
      documentType: string
      documentNumber: string
      documentExpiry: string
      documentIssuingCountry: string
      documentIssuingAuthority: string
      dateOfBirth: string
      dietaryRequirements: string
      accessibilityNeeds: string
      linkedPerson: string
    }
    documentTypeLabels: Record<"passport" | "id_card" | "driver_license" | "visa" | "other", string>
    placeholders: {
      firstName: string
      lastName: string
      email: string
      phone: string
      specialRequests: string
      documentNumber: string
      documentExpiry: string
      documentIssuingCountry: string
      documentIssuingAuthority: string
      dateOfBirth: string
      dietaryRequirements: string
      accessibilityNeeds: string
    }
    validation: {
      firstNameRequired: string
      lastNameRequired: string
    }
    actions: {
      addTraveler: string
      prefillFromProfile: string
      saveToProfile: string
    }
    hints: {
      prefilledFromProfile: string
      savedToProfile: string
    }
  }
  travelerList: {
    title: string
    addTraveler: string
    empty: string
    values: {
      emailUnavailable: string
      phoneUnavailable: string
      documentsUnavailable: string
      fieldUnavailable: string
      noAdditionalContext: string
    }
    columns: {
      name: string
      email: string
      phone: string
      role: string
      dobAge: string
      documents: string
    }
    roles: {
      primary: string
      lead: string
    }
    context: {
      nationality: string
      document: string
      documentExpiry: string
      language: string
      dietary: string
      accessibility: string
      specialRequests: string
      notes: string
      documentLabel: string
    }
    loading: {
      decrypting: string
    }
    actions: {
      deleteConfirm: {
        title: string
        description: string
        cancel: string
        confirm: string
      }
      revealContactDetails: string
      hideContactDetails: string
      revealTravelerContactDetails: string
      hideTravelerContactDetails: string
      viewTraveler: string
      editTraveler: string
      deleteTraveler: string
    }
    snapshot: {
      title: string
      subtitle: string
      sectionContact: string
      sectionTravel: string
      sectionDocuments: string
      sectionMeta: string
      nameLabel: string
      emailLabel: string
      phoneLabel: string
      languageLabel: string
      roleLabel: string
      dobLabel: string
      nationalityLabel: string
      documentLabel: string
      documentExpiryLabel: string
      dietaryLabel: string
      accessibilityLabel: string
      specialRequestsLabel: string
      notesLabel: string
      noDocuments: string
      createdAtLabel: string
      updatedAtLabel: string
      empty: string
    }
    validation: {
      revealFailed: string
    }
  }
  bookingItemDialog: {
    titles: {
      create: string
      edit: string
    }
    itemTypeLabels: Record<
      | "unit"
      | "extra"
      | "service"
      | "fee"
      | "tax"
      | "discount"
      | "adjustment"
      | "accommodation"
      | "transport"
      | "other",
      string
    >
    itemStatusLabels: Record<
      "draft" | "on_hold" | "confirmed" | "cancelled" | "expired" | "fulfilled",
      string
    >
    fields: {
      title: string
      type: string
      status: string
      quantity: string
      sellCurrency: string
      unitSellAmountCents: string
      totalSellAmountCents: string
      costCurrency: string
      unitCostAmountCents: string
      totalCostAmountCents: string
      serviceDate: string
      description: string
      notes: string
    }
    placeholders: {
      title: string
      unitSellAmountCents: string
      totalSellAmountCents: string
      unitCostAmountCents: string
      totalCostAmountCents: string
      serviceDate: string
      description: string
      notes: string
    }
    validation: {
      titleRequired: string
    }
    actions: {
      addItem: string
    }
  }
  bookingItemTravelers: {
    title: string
    empty: string
    selectTravelerPlaceholder: string
    primaryBadge: string
    roleLabels: Record<
      "traveler" | "occupant" | "primary_contact" | "service_assignee" | "beneficiary" | "other",
      string
    >
    actions: {
      assign: string
      removeConfirm: string
    }
  }
  paymentScheduleDialog: {
    titles: {
      create: string
      edit: string
    }
    scheduleTypeLabels: Record<"deposit" | "installment" | "balance" | "hold" | "other", string>
    scheduleStatusLabels: Record<
      "pending" | "due" | "paid" | "waived" | "cancelled" | "expired",
      string
    >
    fields: {
      type: string
      status: string
      dueDate: string
      currency: string
      amountCents: string
      notes: string
    }
    placeholders: {
      dueDate: string
      notes: string
    }
    validation: {
      dueDateRequired: string
      amountRequired: string
    }
    actions: {
      addSchedule: string
    }
  }
  fileDropzone: {
    helperText: string
    uploading: string
    acceptedPrefix: string
    removeFileAriaLabel: string
    validation: {
      fileTooLarge: string
      uploadFailedWithStatus: string
      uploadFailed: string
    }
  }
  voucherPickerSection: {
    labels: {
      heading: string
      codePlaceholder: string
      apply: string
      clear: string
      remainingLabel: string
      invalidLabel: string
    }
    reasonMessages: Record<
      | "not_found"
      | "inactive"
      | "not_started"
      | "expired"
      | "booking_mismatch"
      | "currency_mismatch"
      | "insufficient_balance",
      string
    >
    validation: {
      invalid: string
      lookupFailed: string
      amountUnavailable: string
    }
  }
  productPickerSection: {
    labels: {
      product: string
      productSearchPlaceholder: string
      productSelectPlaceholder: string
      productEmpty: string
      option: string
      optionNone: string
      /** Badge for an owned-inventory product in a catalog-aware picker. */
      owned: string
      /** Badge for a supplier-sourced product in a catalog-aware picker. */
      supplier: string
    }
  }
  personPickerSection: {
    labels: {
      person: string
      organization: string
      billTo: string
      billToPerson: string
      billToOrganization: string
      createNewPerson: string
      createNewOrganization: string
      createPersonSheetTitle: string
      createOrganizationSheetTitle: string
      editPerson: string
      editOrganization: string
      editPersonSheetTitle: string
      editOrganizationSheetTitle: string
      selectExistingPerson: string
      personSearchPlaceholder: string
      personSelectPlaceholder: string
      personEmpty: string
      firstName: string
      firstNamePlaceholder: string
      lastName: string
      lastNamePlaceholder: string
      email: string
      emailPlaceholder: string
      phone: string
      phonePlaceholder: string
      organizationSearchPlaceholder: string
      organizationSelectPlaceholder: string
      organizationEmpty: string
      organizationNone: string
    }
  }
  travelersSection: {
    labels: {
      heading: string
      addTraveler: string
      firstName: string
      lastName: string
      email: string
      role: string
      category: string
      dateOfBirth: string
      roleLead: string
      roleAdult: string
      roleChild: string
      roleInfant: string
      room: string
      noRoom: string
      remove: string
      empty: string
      person: string
      personSearchPlaceholder: string
      personEmpty: string
      createNewPerson: string
      createPersonSheetTitle: string
      editPerson: string
      editPersonSheetTitle: string
      addBillingPerson: string
      relatedPeopleHeading: string
      addRelatedPerson: string
    }
    relationshipKindLabels: {
      spouse: string
      partner: string
      parent: string
      child: string
      sibling: string
      guardian: string
      ward: string
      emergency_contact: string
      friend: string
      travel_companion: string
      other: string
    }
  }
  paymentScheduleSection: {
    labels: {
      heading: string
      modeUnpaid: string
      modeFull: string
      modeAdvance: string
      modeSplit: string
      dueDate: string
      amount: string
      firstInstallment: string
      secondInstallment: string
      preset5050: string
      unpaidHint: string
      totalDue: string
      scheduledTotal: string
      remaining: string
      alreadyPaid: string
      paymentDate: string
      paymentMethod: string
      paymentReference: string
      /** Label for the "+" button below the split installments. */
      addInstallment: string
      /** Aria label for the per-row remove button (only shown when ≥3 installments). */
      removeInstallment: string
    }
  }
  roomsStepperSection: {
    labels: {
      heading: string
      noOption: string
      noSlot: string
      noUnits: string
      remaining: string
      unlimited: string
      fillsSlotCapacity: string
      decreaseUnitPrefix: string
      increaseUnitPrefix: string
      reviewLine: string
    }
  }
  sharedRoomSection: {
    labels: {
      toggle: string
      createMode: string
      joinMode: string
      selectPlaceholder: string
      noGroups: string
      createHint: string
      createSheetTitle: string
      groupLabel: string
      groupLabelPlaceholder: string
      createAction: string
      remove: string
    }
  }
  priceBreakdownSection: {
    labels: {
      heading: string
      total: string
      onRequest: string
      groupRate: string
      empty: string
      noPricing: string
      confirmedTotal: string
      manualTotal: string
      useCatalogTotal: string
      overrideReason: string
      overrideReasonPlaceholder: string
      overrideReasonRequired: string
    }
  }
  bookingDocumentDialog: {
    title: string
    documentTypeLabels: Record<"visa" | "insurance" | "health" | "passport_copy" | "other", string>
    fields: {
      type: string
      traveler: string
      file: string
      expiresAt: string
      notes: string
    }
    placeholders: {
      travelerUnassigned: string
      helperText: string
      expiresAt: string
      notes: string
    }
    validation: {
      fileNameRequired: string
      fileUrlInvalid: string
    }
    actions: {
      addDocument: string
    }
  }
  bookingDocumentList: {
    title: string
    addDocument: string
    empty: string
    values: {
      travelerUnavailable: string
      expiresUnavailable: string
      notesUnavailable: string
    }
    columns: {
      type: string
      file: string
      traveler: string
      expires: string
      notes: string
    }
    actions: {
      deleteConfirm: string
    }
  }
  bookingJourney: {
    steps: Record<
      | "departure"
      | "billing"
      | "travelers"
      | "options"
      | "accommodation"
      | "addons"
      | "payment"
      | "review",
      string
    > & {
      billingAndContact: string
      reviewAndConfirm: string
    }
    navigation: {
      back: string
      next: string
      checking: string
    }
    values: {
      noValue: string
      notSet: string
      none: string
      selectPlaceholder: string
    }
    validation: {
      completeStepBeforeContinuing: string
      unableToContinue: string
      addAtLeastTravelers: string
      maxTravelersPerBooking: string
      ageOutOfRange: string
      dependencyRequires: string
      dependencyExcludes: string
      dependencyLimitPerMaster: string
      dependencyLimitSum: string
    }
    warnings: {
      phoneMissing: string
      billingCountryMissing: string
      vatMissing: string
      travelerFieldRequired: string
      paymentIntentMissing: string
      noTravelers: string
    }
    configure: {
      travelers: string
      departureDate: string
      option: string
      timeOptional: string
      checkIn: string
      checkOutWithNights: string
      cabinCategory: string
      cabinNumber: string
      airArrangements: string
      airOptions: Record<
        "cruise_line" | "independent" | "none",
        { label: string; description: string }
      >
      ageHintRange: string
      ageHintMinimum: string
      ageHintMaximum: string
    }
    billing: {
      title: string
      buyerType: string
      individual: string
      company: string
      firstName: string
      lastName: string
      email: string
      phone: string
      addressLine1: string
      addressLine2Optional: string
      city: string
      postalCode: string
      country: string
      companyName: string
      vatId: string
      leadContactSummaryNote: string
      leadContactSummaryEmpty: string
    }
    travelers: {
      title: string
      partySize: string
      details: string
      decrease: string
      increase: string
      empty: string
      addTraveler: string
      travelerNumber: string
      ageLabel: string
      copyFromBilling: string
      remove: string
    }
    accommodation: {
      title: string
      empty: string
      extensionsAvailable: string
      ratePlan: string
      cancellationPrefix: string
      includesPrefix: string
    }
    addons: {
      title: string
      empty: string
      otherBucket: string
    }
    payment: {
      title: string
      empty: string
      redirectedAfterConfirm: string
      inquiryNotice: string
      bankTransferInstructions: string
      bankTransferDefaultNote: string
      intentLabels: Record<
        "card" | "bank_transfer" | "hold" | "ticket_on_credit" | "inquiry",
        string
      >
      intentDescriptions: Record<
        "card" | "bank_transfer" | "hold" | "ticket_on_credit" | "inquiry",
        string
      >
    }
    review: {
      title: string
      leadContact: string
      travelers: string
      customerNotes: string
      customerNotesPlaceholder: string
      internalNotes: string
      confirmBooking: string
      confirming: string
      priceOverrideToggle: string
      priceOverrideAmount: string
      priceOverrideReason: string
      priceOverrideReasonPlaceholder: string
      priceOverrideReasonRequired: string
    }
    contract: {
      defaultTitle: string
      description: string
      errorPrefix: string
      iframeTitle: string
      termsLabel: string
      marketingLabel: string
      cancel: string
      acceptAndContinue: string
      previewRequestFailed: string
      previewMissing: string
    }
    sidePanel: {
      youAreBooking: string
      total: string
      pricingHint: string
      pricingHintRooms: string
      guestSingular: string
      guestPlural: string
      filledOf: string
      roomSingular: string
      roomPlural: string
      addOnSingular: string
      addOnPlural: string
      card: string
      hold: string
      onCredit: string
      confirmAndBook: string
      reviewDetails: string
      noTravelersYet: string
      notSelected: string
      noAddonsSelected: string
      adults: string
      children: string
      infants: string
      departure: string
      date: string
      checkIn: string
      checkOut: string
      cabin: string
      name: string
      email: string
      phone: string
      buyer: string
      company: string
      individual: string
      vat: string
      address: string
      travelerNumber: string
      dob: string
      method: string
      schedule: string
      payByCard: string
      ticketOnCredit: string
      holdNoChargeYet: string
    }
  }
  statusChangeDialog: {
    title: string
    fields: {
      status: string
      note: string
      suppressNotifications: string
    }
    placeholders: {
      note: string
    }
    helpers: {
      suppressNotifications: string
    }
    actions: {
      updateStatus: string
    }
  }
  supplierStatusDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      serviceName: string
      status: string
      costCurrency: string
      costAmountCents: string
      supplierReference: string
      notes: string
    }
    placeholders: {
      serviceName: string
      supplierReference: string
      notes: string
    }
    validation: {
      serviceNameRequired: string
      costCurrencyInvalid: string
    }
    actions: {
      addSupplierStatus: string
    }
  }
  bookingItemList: {
    title: string
    addItem: string
    empty: string
    values: {
      totalUnavailable: string
      costUnavailable: string
      serviceDateUnavailable: string
    }
    columns: {
      title: string
      option: string
      unit: string
      type: string
      status: string
      quantity: string
      total: string
      cost: string
      serviceDate: string
    }
    /** Labels for the per-item expanded panel (description / dates / etc). */
    detail: {
      description: string
      dates: string
      cost: string
      catalogSource: string
      productLink: string
      noDescription: string
    }
    actions: {
      deleteConfirm: {
        title: string
        description: string
        cancel: string
        confirm: string
      }
      expandItem: string
      collapseItem: string
      viewItem: string
      editItem: string
      deleteItem: string
    }
    snapshot: {
      title: string
      subtitle: string
      sectionSummary: string
      sectionPricing: string
      sectionMeta: string
      productLabel: string
      optionLabel: string
      unitLabel: string
      descriptionLabel: string
      typeLabel: string
      statusLabel: string
      datesLabel: string
      quantityLabel: string
      unitSellLabel: string
      totalSellLabel: string
      unitCostLabel: string
      totalCostLabel: string
      notesLabel: string
      createdAtLabel: string
      updatedAtLabel: string
      empty: string
    }
  }
  bookingPaymentScheduleList: {
    title: string
    addSchedule: string
    empty: string
    values: {
      notesUnavailable: string
      /** Suffix shown after the invoice number when the matched doc is a proforma. */
      proformaSuffix: string
    }
    columns: {
      type: string
      status: string
      dueDate: string
      amount: string
      notes: string
      /** Invoice / proforma number covering this schedule row. */
      invoice: string
    }
    actions: {
      deleteConfirm: {
        title: string
        description: string
        cancel: string
        confirm: string
      }
      editSchedule: string
      deleteSchedule: string
      issueDocument: string
      issueInvoice: string
      issueProforma: string
      issueDocumentSuccess: string
      issueDocumentFailure: string
      issueDocumentErrors: {
        invoice_number_series_not_found: string
        invoice_number_series_inactive: string
        invoice_number_series_scope_mismatch: string
        no_active_series_for_scope: string
      }
    }
  }
  bookingPaymentReconciliationBanner: {
    title: string
    loading: string
    empty: string
    reconciledDescription: string
    driftDescription: string
    reconciledBadge: string
    driftBadge: string
    billed: string
    invoicePaid: string
    recordedPayments: string
    schedulePaid: string
    drift: string
    emptyValue: string
  }
  supplierStatusList: {
    title: string
    addSupplier: string
    empty: string
    values: {
      costUnavailable: string
      referenceUnavailable: string
      confirmedUnavailable: string
    }
    columns: {
      service: string
      status: string
      cost: string
      reference: string
      confirmed: string
      /** Row actions column header (visually hidden, used by screen readers). */
      actions: string
    }
    actions: {
      edit: string
    }
  }
  bookingCancellationDialog: {
    title: string
    summary: {
      booking: string
      startDate: string
      total: string
      daysBeforeDeparture: string
    }
    values: {
      startDateTbd: string
      amountUnavailable: string
      ruleFallback: string
      ruleDaysBeforeDeparture: string
    }
    policy: {
      applicablePolicy: string
      refund: string
      penalty: string
      rule: string
      resolving: string
      missing: string
      missingHint: string
      calculating: string
      noTotalAmount: string
    }
    refundTypeLabels: Record<"cash" | "credit" | "cash_or_credit" | "none", string>
    fields: {
      reason: string
    }
    placeholders: {
      reason: string
    }
    validation: {
      cancellationFailed: string
    }
    actions: {
      close: string
      confirm: string
    }
  }
  bookingBillingDialog: {
    title: string
    fields: {
      partyType: string
      firstName: string
      lastName: string
      companyName: string
      taxId: string
      email: string
      phone: string
      addressLine1: string
      addressLine2: string
      city: string
      region: string
      postalCode: string
      country: string
    }
    partyTypeLabels: Record<"individual" | "company", string>
    crmPicker: {
      label: string
      personSearchPlaceholder: string
      personEmpty: string
      organizationSearchPlaceholder: string
      organizationEmpty: string
    }
    actions: {
      cancel: string
      selectFromCrm: string
      hideCrmPicker: string
      save: string
    }
  }
  bookingGuaranteeDialog: {
    titles: {
      create: string
      edit: string
    }
    guaranteeTypeLabels: Record<
      | "deposit"
      | "credit_card"
      | "preauth"
      | "card_on_file"
      | "bank_transfer"
      | "voucher"
      | "agency_letter"
      | "other",
      string
    >
    guaranteeStatusLabels: Record<
      "pending" | "active" | "released" | "failed" | "cancelled" | "expired",
      string
    >
    fields: {
      type: string
      status: string
      currency: string
      amountCents: string
      provider: string
      referenceNumber: string
      expiresAt: string
      notes: string
    }
    placeholders: {
      provider: string
      referenceNumber: string
      expiresAt: string
      notes: string
    }
    actions: {
      addGuarantee: string
    }
  }
  bookingGuaranteeList: {
    title: string
    addGuarantee: string
    empty: string
    values: {
      amountUnavailable: string
      providerUnavailable: string
      referenceUnavailable: string
      expiresUnavailable: string
    }
    columns: {
      type: string
      status: string
      amount: string
      provider: string
      reference: string
      expires: string
    }
    actions: {
      deleteConfirm: {
        title: string
        description: string
        cancel: string
        confirm: string
      }
      editGuarantee: string
      deleteGuarantee: string
    }
  }
  bookingGroupLinkDialog: {
    title: string
    modes: {
      join: string
      create: string
    }
    fields: {
      existingGroups: string
      groupLabel: string
    }
    placeholders: {
      selectGroup: string
      noExistingGroups: string
      groupLabel: string
    }
    hints: {
      productFiltered: string
      primaryMember: string
    }
    validation: {
      selectGroup: string
      linkFailed: string
    }
    actions: {
      createAndLink: string
      linkToGroup: string
    }
    labels: {
      generatedLabelPrefix: string
    }
  }
  bookingGroupSection: {
    title: string
    empty: string
    group: string
    siblingBookings: string
    noSiblingBookings: string
    primaryBadge: string
    sharedRoomKind: string
    actions: {
      removeFromGroup: string
      linkToSharedRoom: string
      removeConfirm: string
    }
  }
  bookingDialog: {
    editTitle: string
    fields: {
      bookingNumber: string
      status: string
      sellCurrency: string
      travelDates: string
      sellAmountCents: string
      costAmountCents: string
      pax: string
      internalNotes: string
    }
    placeholders: {
      bookingNumber: string
      travelDates: string
      pax: string
      internalNotes: string
    }
    validation: {
      bookingNumberRequired: string
      sellCurrencyInvalid: string
    }
  }
  bookingCreateDialog: {
    title: string
    fields: {
      departure: string
      internalNotes: string
      confirmAfterCreate: string
      confirmAfterCreateHint: string
      createAsDraft: string
      createAsDraftHint: string
      notifyTraveler: string
      notifyTravelerHint: string
    }
    placeholders: {
      departure: string
      departureNone: string
      departureEmpty: string
      internalNotes: string
    }
    validation: {
      selectProduct: string
      selectDeparture: string
      selectUnits: string
      selectPerson: string
      selectOrganization: string
      billingContactRequired: string
      billingEmailInvalid: string
      travelerRequired: string
      firstAndLastNameRequired: string
      roomCapacityExceeded: string
      selectSharedRoomGroup: string
      confirmFailedPrefix: string
      confirmFailed: string
      createFailed: string
      payloadResolverMismatchDetails: string
      payloadResolverMismatchFallback: string
      payloadResolverMismatchLine: string
    }
    actions: {
      createDraftBooking: string
      createConfirmedBooking: string
      createAwaitingPaymentBooking: string
    }
    labels: {
      currency: string
      remainingCapacity: string
      noSpecificOption: string
      createNewPerson: string
      selectExistingPerson: string
      organizationNone: string
      billingHeading: string
      addTraveler: string
      travelerHeading: string
      travelerRole: string
      travelerLead: string
      travelerAdult: string
      travelerChild: string
      travelerInfant: string
      travelerRoom: string
      travelerNoRoom: string
      travelerRemove: string
      travelerEmpty: string
      travelerPerson: string
      travelerPersonSearchPlaceholder: string
      travelerPersonEmpty: string
      createPersonSheetTitle: string
      addBillingPersonAsTraveler: string
      roomsHeading: string
      roomsNoOption: string
      roomsNoSlot: string
      roomsNoUnits: string
      roomsRemaining: string
      roomsUnlimited: string
      extrasHeading: string
      extrasEmpty: string
      extrasIncluded: string
      extrasOnRequest: string
      extrasPerPerson: string
      sharedRoomToggle: string
      sharedRoomCreateMode: string
      sharedRoomJoinMode: string
      sharedRoomSelectPlaceholder: string
      sharedRoomNoGroups: string
      sharedRoomCreateHint: string
      sharedRoomRemove: string
      sharedRoomGeneratedLabelPrefix: string
      voucherHeading: string
      voucherCodePlaceholder: string
      voucherApply: string
      voucherClear: string
      voucherRemainingLabel: string
      voucherInvalidLabel: string
      paymentHeading: string
      previewHeading: string
      previewEmpty: string
      previewProduct: string
      previewDeparture: string
      previewOptions: string
      previewTravelers: string
      previewTotal: string
      previewLoading: string
      previewTravelerUnnamed: string
      paymentModeUnpaid: string
      paymentModeFull: string
      paymentModeAdvance: string
      paymentModeSplit: string
      paymentDueDate: string
      paymentAmount: string
      paymentFirstInstallment: string
      paymentSecondInstallment: string
      paymentPreset5050: string
      paymentUnpaidHint: string
      paymentTotalDue: string
      paymentScheduledTotal: string
      paymentRemaining: string
      paymentAlreadyPaid: string
      paymentDate: string
      paymentMethod: string
      paymentReference: string
      documentGenerationHeading: string
      generateContractDocument: string
      generateInvoiceDocument: string
      /** Mutually exclusive with `generateInvoiceAndContract`. */
      generateProforma: string
      /** Mutually exclusive with `generateProforma`. */
      generateInvoiceAndContract: string
      breakdownHeading: string
      breakdownTotal: string
      breakdownOnRequest: string
      breakdownGroupRate: string
      breakdownEmpty: string
      breakdownNoPricing: string
      breakdownConfirmedTotal: string
      breakdownManualTotal: string
      breakdownUseCatalogTotal: string
      breakdownOverrideReason: string
      breakdownOverrideReasonPlaceholder: string
      breakdownOverrideReasonRequired: string
      breakdownSubtotal: string
      breakdownTax: string
      breakdownTaxIncluded: string
    }
  }
  bookingList: {
    searchPlaceholder: string
    newBooking: string
    columns: {
      bookingNumber: string
      whatBooked: string
      status: string
      sellAmount: string
      pax: string
      startDate: string
      endDate: string
      lead: string
      createdAt: string
    }
    filters: {
      button: string
      statusLabel: string
      statusAll: string
      productLabel: string
      product: string
      productEmpty: string
      optionLabel: string
      option: string
      optionEmpty: string
      optionNeedsProduct: string
      categoryLabel: string
      category: string
      categoryEmpty: string
      supplierLabel: string
      supplier: string
      supplierEmpty: string
      personLabel: string
      person: string
      personEmpty: string
      organizationLabel: string
      organization: string
      organizationEmpty: string
      departureLabel: string
      departure: string
      departureEmpty: string
      departureNeedsProduct: string
      dateRangeLabel: string
      dateRange: string
      paxLabel: string
      paxMin: string
      paxMax: string
      clear: string
    }
    /** "+{count} more" suffix when a booking has multiple items in the list cell. */
    itemsMore: string
    /** Compact day-count tag next to the primary item: e.g. "(2 days)". */
    itemDays: string
    loadingError: string
    empty: string
    showingSummary: string
    previousPage: string
    nextPage: string
  }
  bookingPaymentsSummary: {
    title: string
    empty: string
    /** Header summary line. Placeholders: `{amount}` (already currency-formatted). */
    totalReceived: string
    columns: {
      /** Allocated invoice — shown as a secondary "For" link, not lead. */
      invoice: string
      method: string
      status: string
      amount: string
      /** Equivalent in the booking's currency when the payment was made in a different currency. */
      fx: string
      date: string
      reference: string
      /** Row actions column header (visually hidden, used by screen readers). */
      actions: string
    }
    paymentMethodLabels: Record<"card" | "bank_transfer" | "cash" | "voucher" | "other", string>
    paymentStatusLabels: Record<"pending" | "completed" | "failed" | "refunded", string>
    actions: {
      /** Trigger button screen-reader label. */
      open: string
      view: string
      convertToInvoice: string
      edit: string
      delete: string
    }
    deleteConfirm: {
      title: string
      /** Body. Placeholders: `{amount}` (already currency-formatted). */
      description: string
      cancel: string
      confirm: string
    }
  }
  bookingNotes: {
    title: string
    addAction: string
    empty: string
    authorLabel: string
    actions: {
      edit: string
      delete: string
    }
    dialog: {
      createTitle: string
      editTitle: string
      contentLabel: string
      contentPlaceholder: string
      cancel: string
      create: string
      save: string
    }
    deleteConfirm: {
      title: string
      description: string
      cancel: string
      confirm: string
    }
  }
  bookingActivityTimeline: {
    title: string
    filters: {
      all: string
      activity: string
      document: string
      payment: string
      action: string
    }
    sourceLabels: {
      activity: string
      document: string
      payment: string
      action: string
    }
    empty: string
    activityTitles: Record<string, string>
    documentUploadedSuffix: string
    viewFile: string
    byActor: string
    paymentTitle: string
    paymentDescription: string
  }
}
