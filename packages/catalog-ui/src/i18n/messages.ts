export type CatalogUiMessages = {
  catalogPage: {
    title: string
    description: string
    searchPlaceholder: string
    tabs: {
      products: string
      extras: string
      cruises: string
      charters: string
      accommodations: string
    }
    actions: {
      bookThis: string
      openEditor: string
    }
    columns: Record<
      | "name"
      | "status"
      | "active"
      | "source"
      | "supplier"
      | "bookingMode"
      | "pax"
      | "price"
      | "selection"
      | "pricing"
      | "defaultQuantity"
      | "type"
      | "days"
      | "nights"
      | "availableDepartures"
      | "yacht"
      | "from"
      | "class"
      | "maxPax"
      | "bedrooms",
      string
    >
    filters: Record<
      | "status"
      | "source"
      | "supplier"
      | "bookingMode"
      | "type"
      | "capacity"
      | "visibility"
      | "facility"
      | "price"
      | "pax"
      | "any"
      | "active"
      | "selection"
      | "pricingMode"
      | "perPerson"
      | "minQuantity"
      | "maxQuantity"
      | "ship"
      | "embark"
      | "disembark"
      | "region"
      | "theme"
      | "nights"
      | "yacht"
      | "apaPercent"
      | "inventory"
      | "class"
      | "smoking"
      | "property"
      | "maxPax"
      | "bedrooms"
      | "bathrooms",
      string
    >
    fallbacks: {
      productName: string
      extraName: string
      cruiseName: string
      charterName: string
      roomName: string
      detailName: string
    }
    sourceKinds: Record<
      | "owned"
      | "voyantConnect"
      | "manual"
      | "gdsAmadeus"
      | "gdsSabre"
      | "gdsTravelport"
      | "bedbankHotelbeds"
      | "bedbankExpedia"
      | "directSuffix",
      string
    >
    search: {
      noTabsConfigured: string
      clearAll: string
      noResults: string
      yourFilters: string
      resultSingular: string
      resultPlural: string
      showing: string
      previous: string
      next: string
      page: string
    }
    filtersUi: {
      min: string
      max: string
      to: string
      clear: string
      apply: string
      noResults: string
      clearFilter: string
    }
    detail: {
      loadingFullContent: string
      matchPrefix: string
      stale: string
      system: string
      highlights: string
      supplier: string
      itinerary: string
      tagsThemes: string
      attributes: string
      departures: string
      ends: string
      book: string
      options: string
      policies: string
      brochure: string
      media: string
      day: string
      unlimited: string
      leftWithCapacity: string
      left: string
      capacity: string
      tabs: {
        overview: string
      }
      attributeLabels: {
        sellAmount: string
        supplierId: string
      }
      tagsInputPlaceholder: string
      addTag: string
      arrayLabels: {
        categories: string
      }
      priceFromLabel: string
      noUpcomingDepartures: string
      departuresTable: {
        date: string
        status: string
        availability: string
        priceFrom: string
        soldOut: string
        closed: string
        cancelled: string
        open: string
        viewDetails: string
        optionsHeading: string
        noOptions: string
        anyMonth: string
        anyStatus: string
        minAvailability: string
        clearFilters: string
        noResults: string
        remainingLabel: string
      }
    }
    values: {
      active: string
      inactive: string
      empty: string
      yes: string
      no: string
      open: string
    }
  }
  catalogBookingPage: {
    title: string
    descriptionPrefix: string
    actions: {
      backToCatalog: string
      refreshPrice: string
      addTraveler: string
      removeTraveler: string
      cancel: string
      booking: string
      confirmBooking: string
    }
    summary: {
      untitled: string
      departure: string
      available: string
      livePrice: string
      quoteExpires: string
      quoteFailed: string
    }
    values: {
      loading: string
      empty: string
      yes: string
      no: string
    }
    contact: {
      title: string
      description: string
      firstName: string
      lastName: string
      email: string
      phone: string
      firstNamePlaceholder: string
      lastNamePlaceholder: string
      emailPlaceholder: string
      phonePlaceholder: string
    }
    travelers: {
      title: string
      description: string
      firstNameLabel: string
      lastNameLabel: string
      emailLabel: string
      firstNamePlaceholder: string
      lastNamePlaceholder: string
      emailPlaceholder: string
    }
    notes: {
      title: string
      description: string
      placeholder: string
    }
    payment: {
      title: string
      description: string
      intent: string
      hold: string
      cardComingSoon: string
    }
    review: {
      total: string
    }
    validation: {
      waitingForPrice: string
      notBookable: string
      contactNameRequired: string
      contactEmailRequired: string
      travelerNameRequired: string
    }
  }
}
