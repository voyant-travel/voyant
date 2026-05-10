export type FlightsUiMessages = {
  flightsPage: {
    title: string
    description: string
    searchFailed: string
    selectedOutbound: string
    selectedReturn: string
    change: string
    tripTotal: string
    tripTotalDescription: string
    continueToBooking: string
    pickedOfferMissing: string
    outboundOfferMissing: string
    pickOutboundAgain: string
    availableFlights: string
    outboundHeading: string
    returnHeading: string
    tripHeading: string
    searching: string
    zeroOffers: string
    offersSummary: string
    pageSummary: string
    previous: string
    next: string
    flightOffer: string
    bookThisFlight: string
    selectOutbound: string
    selectReturn: string
    noFilteredResults: string
    noRouteResults: string
  }
  flightBookingPage: {
    title: string
    descriptionTrip: string
    descriptionOffer: string
    offerNotInSessionTitle: string
    offerNotInSessionDescription: string
    backToFlightSearch: string
    backToResults: string
  }
  passengerContactPicker: {
    trigger: string
    searchPlaceholder: string
    searching: string
    empty: string
    addNewContact: string
    emptyName: string
  }
  billingPickers: {
    personTrigger: string
    personSearchPlaceholder: string
    peopleSearching: string
    peopleEmpty: string
    orgTrigger: string
    orgSearchPlaceholder: string
    orgsSearching: string
    orgsEmpty: string
    emptyName: string
  }
}
