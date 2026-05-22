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
    noInternalNotes: string
    noContact: string
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
    collectPaymentAction: string
    recordPaymentAction: string
    noValue: string
    tbd: string
    summarySell: string
    summaryPriceOverride: string
    summaryCostMargin: string
    summaryDates: string
    summaryTravelers: string
    summaryPerson: string
    summaryOrganization: string
    summaryCreated: string
    summaryUpdated: string
    tabOverview: string
    tabTravelers: string
    tabFinance: string
    tabInvoices: string
    tabSuppliers: string
    tabDocuments: string
    tabActivity: string
    tabLedger: string
    internalNotesLabel: string
    billingPayer: string
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
      passportNumber: string
      passportExpiry: string
      passportIssuingCountry: string
      passportIssuingAuthority: string
      dateOfBirth: string
      dietaryRequirements: string
      accessibilityNeeds: string
      linkedPerson: string
    }
    placeholders: {
      firstName: string
      lastName: string
      email: string
      phone: string
      specialRequests: string
      passportNumber: string
      passportExpiry: string
      passportIssuingCountry: string
      passportIssuingAuthority: string
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
      passport: string
      passportExpiry: string
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
      deleteConfirm: string
      revealContactDetails: string
      hideContactDetails: string
      revealTravelerContactDetails: string
      hideTravelerContactDetails: string
      editTraveler: string
      deleteTraveler: string
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
      "configure" | "billing" | "travelers" | "accommodation" | "addons" | "payment" | "review",
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
    }
    travelers: {
      title: string
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
    }
    placeholders: {
      note: string
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
      deleteConfirm: string
      expandItem: string
      collapseItem: string
      editItem: string
      deleteItem: string
    }
  }
  bookingPaymentScheduleList: {
    title: string
    addSchedule: string
    empty: string
    values: {
      notesUnavailable: string
    }
    columns: {
      type: string
      status: string
      dueDate: string
      amount: string
      notes: string
    }
    actions: {
      deleteConfirm: string
      issueDocument: string
      issueInvoice: string
      issueProforma: string
    }
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
      firstName: string
      lastName: string
      email: string
      phone: string
      address: string
      city: string
      region: string
      postalCode: string
      country: string
    }
    actions: {
      cancel: string
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
      deleteConfirm: string
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
      billingEmailRequired: string
      travelerRequired: string
      firstAndLastNameRequired: string
      selectSharedRoomGroup: string
      confirmFailedPrefix: string
      confirmFailed: string
      createFailed: string
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
    loadingError: string
    empty: string
    showingSummary: string
    pageSummary: string
    previousPage: string
    nextPage: string
  }
  bookingPaymentsSummary: {
    title: string
    empty: string
    columns: {
      /** Allocated invoice — shown as a secondary "For" link, not lead. */
      invoice: string
      method: string
      status: string
      amount: string
      date: string
      reference: string
    }
    paymentMethodLabels: Record<"card" | "bank_transfer" | "cash" | "voucher" | "other", string>
    paymentStatusLabels: Record<"pending" | "completed" | "failed" | "refunded", string>
  }
  bookingNotes: {
    title: string
    placeholder: string
    add: string
    empty: string
  }
  bookingActivityTimeline: {
    title: string
    filters: {
      all: string
      activity: string
      document: string
      payment: string
    }
    sourceLabels: {
      activity: string
      document: string
      payment: string
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
