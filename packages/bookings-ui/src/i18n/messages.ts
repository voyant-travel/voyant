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
    }
    placeholders: {
      firstName: string
      lastName: string
      email: string
      phone: string
      specialRequests: string
    }
    validation: {
      firstNameRequired: string
      lastNameRequired: string
    }
    actions: {
      addTraveler: string
    }
  }
  travelerList: {
    title: string
    addTraveler: string
    empty: string
    values: {
      emailUnavailable: string
      phoneUnavailable: string
    }
    columns: {
      name: string
      email: string
      phone: string
    }
    actions: {
      deleteConfirm: string
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
      option: string
      optionNone: string
    }
  }
  personPickerSection: {
    labels: {
      person: string
      createNewPerson: string
      selectExistingPerson: string
      personSearchPlaceholder: string
      personSelectPlaceholder: string
      firstName: string
      firstNamePlaceholder: string
      lastName: string
      lastNamePlaceholder: string
      email: string
      emailPlaceholder: string
      phone: string
      phonePlaceholder: string
      organization: string
      organizationSearchPlaceholder: string
      organizationNone: string
    }
  }
  passengersSection: {
    labels: {
      heading: string
      addPassenger: string
      firstName: string
      lastName: string
      email: string
      role: string
      roleLead: string
      roleAdult: string
      roleChild: string
      roleInfant: string
      room: string
      noRoom: string
      remove: string
      empty: string
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
    }
  }
  roomsStepperSection: {
    labels: {
      heading: string
      noSlot: string
      noUnits: string
      remaining: string
      unlimited: string
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
    }
    placeholders: {
      departure: string
      departureNone: string
      departureEmpty: string
      internalNotes: string
    }
    validation: {
      selectProduct: string
      selectPerson: string
      firstAndLastNameRequired: string
      selectSharedRoomGroup: string
      confirmFailedPrefix: string
      confirmFailed: string
      createFailed: string
    }
    actions: {
      createDraftBooking: string
    }
    labels: {
      currency: string
      remainingCapacity: string
      noSpecificOption: string
      createNewPerson: string
      selectExistingPerson: string
      organizationNone: string
      addPassenger: string
      passengerHeading: string
      passengerRole: string
      passengerLead: string
      passengerAdult: string
      passengerChild: string
      passengerInfant: string
      passengerRoom: string
      passengerNoRoom: string
      passengerRemove: string
      passengerEmpty: string
      roomsHeading: string
      roomsNoSlot: string
      roomsNoUnits: string
      roomsRemaining: string
      roomsUnlimited: string
      sharedRoomToggle: string
      sharedRoomCreateMode: string
      sharedRoomJoinMode: string
      sharedRoomSelectPlaceholder: string
      sharedRoomNoGroups: string
      sharedRoomCreateHint: string
      sharedRoomGeneratedLabelPrefix: string
      voucherHeading: string
      voucherCodePlaceholder: string
      voucherApply: string
      voucherClear: string
      voucherRemainingLabel: string
      voucherInvalidLabel: string
      paymentHeading: string
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
      breakdownHeading: string
      breakdownTotal: string
      breakdownOnRequest: string
      breakdownGroupRate: string
      breakdownEmpty: string
      breakdownNoPricing: string
    }
  }
  bookingList: {
    searchPlaceholder: string
    newBooking: string
    columns: {
      bookingNumber: string
      status: string
      sellAmount: string
      pax: string
      startDate: string
      endDate: string
    }
    loadingError: string
    empty: string
    showingSummary: string
    pageSummary: string
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
