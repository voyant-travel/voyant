export type RegistryTransactionsMessages = {
  common: {
    offerStatusLabels: {
      draft: string
      published: string
      sent: string
      accepted: string
      expired: string
      withdrawn: string
      converted: string
    }
    orderStatusLabels: {
      draft: string
      pending: string
      confirmed: string
      fulfilled: string
      cancelled: string
      expired: string
    }
    discountTypeLabels: {
      percentage: string
      fixed_amount: string
    }
    cancel: string
    saveChanges: string
    searchMarkets: string
    noMarkets: string
    searchPeople: string
    noPeople: string
    searchOrganizations: string
    noOrganizations: string
    selectCurrency: string
  }
  page: {
    title: string
    description: string
    tabs: {
      offers: string
      orders: string
    }
  }
  offersTab: {
    description: string
    add: string
    empty: {
      loading: string
      none: string
    }
    columns: {
      number: string
      title: string
      status: string
      total: string
      validUntil: string
    }
    deleteConfirm: string
  }
  ordersTab: {
    description: string
    add: string
    empty: {
      loading: string
      none: string
    }
    columns: {
      number: string
      title: string
      status: string
      total: string
      ordered: string
    }
    deleteConfirm: string
  }
  offerDialog: {
    titleNew: string
    titleEdit: string
    errors: {
      offerNumberRequired: string
      titleRequired: string
      currencyLength: string
    }
    fields: {
      offerNumber: string
      title: string
      status: string
      currency: string
      market: string
      person: string
      organization: string
      subtotal: string
      tax: string
      fee: string
      total: string
      validFrom: string
      validUntil: string
      notes: string
      promoTitle: string
      promoDescription: string
      promoLocale: string
      promoSlug: string
      promoMinTravelers: string
      promoDiscountType: string
      promoDiscountValue: string
      promoCurrency: string
      promoValidFrom: string
      promoValidTo: string
      promoStackable: string
      promoDescriptionField: string
      promoImageMobile: string
      promoImageDesktop: string
      promoProductIds: string
      promoDepartureIds: string
    }
    placeholders: {
      offerNumber: string
      title: string
      validFrom: string
      validUntil: string
      promoLocale: string
      promoSlug: string
      promoValidFrom: string
      promoValidTo: string
      promoImageMobile: string
      promoImageDesktop: string
      promoProductIds: string
      promoDepartureIds: string
    }
    actions: {
      add: string
    }
  }
  orderDialog: {
    titleNew: string
    titleEdit: string
    errors: {
      orderNumberRequired: string
      titleRequired: string
      currencyLength: string
    }
    fields: {
      orderNumber: string
      title: string
      status: string
      currency: string
      market: string
      sourceOffer: string
      person: string
      organization: string
      subtotal: string
      tax: string
      fee: string
      total: string
      orderedAt: string
      confirmedAt: string
      expiresAt: string
      notes: string
    }
    placeholders: {
      orderNumber: string
      title: string
      sourceOffer: string
      noOffers: string
      orderedAt: string
      confirmedAt: string
      expiresAt: string
    }
    actions: {
      add: string
    }
  }
}
