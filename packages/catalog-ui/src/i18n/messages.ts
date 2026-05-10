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
      hospitality: string
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
      | "nights"
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
    }
    values: {
      active: string
      inactive: string
      empty: string
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
