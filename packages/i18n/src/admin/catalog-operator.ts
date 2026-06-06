import type { LocaleMessageDefinitions } from "../runtime.js"

export type OperatorAdminCatalogMessages = {
  /** Individual product (package) detail page. */
  detail: {
    datesAndPrices: string
    datesError: string
    availabilityUnavailable: string
    /** `{nights}` placeholder. */
    noDepartures: string
    selectDate: string
    roomType: string
    roomTypes: string
    roomsTitle: string
    notFound: string
    loadError: string
    about: string
    // Cruise detail sections.
    cabins: string
    itinerary: string
    ship: string
    day: string
    atSea: string
    capacity: string
    decks: string
    soldOut: string
    highlights: string
    location: string
    guestReviews: string
    reviewsWord: string
    book: string
    freeCancellation: string
    photos: string
    from: string
    /** `{nights}` placeholder. */
    nightsFlightIncluded: string
    max: string
    room: string
    perPerson: string
    mealPlan: string
    close: string
    prevPhoto: string
    nextPhoto: string
    /** Meal/board basis labels keyed by code (AI/HB/BB/RO/FB). */
    boards: {
      RO: string
      BB: string
      HB: string
      FB: string
      AI: string
      standard: string
    }
  }
  /** Dynamic (search-first) catalog surface — the unified search bar + results. */
  search: {
    searchLabel: string
    searchPlaceholder: string
    destination: string
    chooseCountry: string
    when: string
    anyTime: string
    flyingFrom: string
    finding: string
    loading: string
    allAirports: string
    departureAirport: string
    duration: string
    nights: string
    adults: string
    searchAvailability: string
    searching: string
    clear: string
    error: string
    availabilityUnavailable: string
    /** `{nights}` + `{destination}` placeholders. */
    noDepartures: string
    thisDestination: string
    departureDate: string
    departureDates: string
    in: string
    holiday: string
    holidays: string
    departing: string
    selectDay: string
    flightIncluded: string
    viewDates: string
    perPerson: string
    // Cruise search surface.
    cruiseType: string
    allTypes: string
    typeRiver: string
    typeOcean: string
    cruisePlaceholder: string
    sailing: string
    sailings: string
    viewCruise: string
    noSailings: string
  }
  /** Availability month calendar (shared by search + detail). */
  calendar: {
    prevMonth: string
    nextMonth: string
    offer: string
    offers: string
  }
}

export const operatorAdminCatalogMessages = {
  en: {
    catalog: {
      detail: {
        datesAndPrices: "Dates & prices",
        datesError: "Could not load live dates. Try again.",
        availabilityUnavailable: "Live availability is temporarily unavailable. Try again.",
        noDepartures: "No {nights}-night departures available.",
        selectDate: "Select a departure date to see room & board options.",
        roomType: "room type",
        roomTypes: "room types",
        roomsTitle: "Rooms",
        notFound: "Not found.",
        loadError: "Could not load this item. Try again.",
        about: "About this hotel",
        cabins: "Cabins",
        itinerary: "Itinerary",
        ship: "Ship",
        day: "Day",
        atSea: "At sea",
        capacity: "Capacity",
        decks: "Decks",
        soldOut: "Sold out",
        highlights: "Top reasons",
        location: "Location",
        guestReviews: "Guest reviews",
        reviewsWord: "reviews",
        book: "Book",
        freeCancellation: "Free cancellation",
        photos: "photos",
        from: "from",
        nightsFlightIncluded: "{nights} nights · flight included",
        max: "max",
        room: "Room",
        perPerson: "pp",
        mealPlan: "Meal plan",
        close: "Close",
        prevPhoto: "Previous photo",
        nextPhoto: "Next photo",
        boards: {
          RO: "Room only",
          BB: "Bed & breakfast",
          HB: "Half board",
          FB: "Full board",
          AI: "All-inclusive",
          standard: "Standard",
        },
      },
      search: {
        searchLabel: "Search",
        searchPlaceholder: "Hotel or destination name",
        destination: "Destination",
        chooseCountry: "Choose a country",
        when: "When",
        anyTime: "Any time",
        flyingFrom: "Flying from",
        finding: "finding…",
        loading: "Loading…",
        allAirports: "All airports",
        departureAirport: "Departure airport",
        duration: "Duration",
        nights: "nights",
        adults: "Adults",
        searchAvailability: "Search availability",
        searching: "Searching…",
        clear: "Clear",
        error: "Could not reach live availability. Please try again.",
        availabilityUnavailable: "Live availability is temporarily unavailable — please try again.",
        noDepartures:
          "No {nights}-night departures found for {destination} in the next few months.",
        thisDestination: "this destination",
        departureDate: "departure date",
        departureDates: "departure dates",
        in: "in",
        holiday: "holiday",
        holidays: "holidays",
        departing: "departing",
        selectDay: "Select a day with availability to see holidays.",
        flightIncluded: "Flight included",
        viewDates: "View dates",
        perPerson: "pp",
        cruiseType: "Cruise type",
        allTypes: "All types",
        typeRiver: "River",
        typeOcean: "Ocean",
        cruisePlaceholder: "Cruise or destination",
        sailing: "sailing",
        sailings: "sailings",
        viewCruise: "View cruise",
        noSailings: "No sailings found in the next few months.",
      },
      calendar: {
        prevMonth: "Previous month",
        nextMonth: "Next month",
        offer: "offer",
        offers: "offers",
      },
    },
  },
  ro: {
    catalog: {
      detail: {
        datesAndPrices: "Date și prețuri",
        datesError: "Nu am putut încărca datele live. Încearcă din nou.",
        availabilityUnavailable:
          "Disponibilitatea live este temporar indisponibilă. Încearcă din nou.",
        noDepartures: "Nu există plecări de {nights} nopți disponibile.",
        selectDate: "Selectează o dată de plecare pentru a vedea opțiunile de cameră și masă.",
        roomType: "tip de cameră",
        roomTypes: "tipuri de cameră",
        roomsTitle: "Camere",
        notFound: "Nu a fost găsit.",
        loadError: "Nu am putut încărca acest element. Încearcă din nou.",
        about: "Despre acest hotel",
        cabins: "Cabine",
        itinerary: "Itinerar",
        ship: "Navă",
        day: "Ziua",
        atSea: "Pe mare",
        capacity: "Capacitate",
        decks: "Punți",
        soldOut: "Epuizat",
        highlights: "Puncte forte",
        location: "Locație",
        guestReviews: "Recenzii oaspeți",
        reviewsWord: "recenzii",
        book: "Rezervă",
        freeCancellation: "Anulare gratuită",
        photos: "fotografii",
        from: "de la",
        nightsFlightIncluded: "{nights} nopți · zbor inclus",
        max: "max",
        room: "Cameră",
        perPerson: "/pers",
        mealPlan: "Tip de masă",
        close: "Închide",
        prevPhoto: "Fotografia anterioară",
        nextPhoto: "Fotografia următoare",
        boards: {
          RO: "Doar cazare",
          BB: "Mic dejun",
          HB: "Demipensiune",
          FB: "Pensiune completă",
          AI: "All inclusive",
          standard: "Standard",
        },
      },
      search: {
        searchLabel: "Caută",
        searchPlaceholder: "Nume hotel sau destinație",
        destination: "Destinație",
        chooseCountry: "Alege o țară",
        when: "Când",
        anyTime: "Oricând",
        flyingFrom: "Plecare din",
        finding: "se caută…",
        loading: "Se încarcă…",
        allAirports: "Toate aeroporturile",
        departureAirport: "Aeroport de plecare",
        duration: "Durată",
        nights: "nopți",
        adults: "Adulți",
        searchAvailability: "Caută disponibilitate",
        searching: "Se caută…",
        clear: "Resetează",
        error: "Nu am putut accesa disponibilitatea live. Încearcă din nou.",
        availabilityUnavailable:
          "Disponibilitatea live este temporar indisponibilă — încearcă din nou.",
        noDepartures:
          "Nu am găsit plecări de {nights} nopți pentru {destination} în următoarele luni.",
        thisDestination: "această destinație",
        departureDate: "dată de plecare",
        departureDates: "date de plecare",
        in: "în",
        holiday: "vacanță",
        holidays: "vacanțe",
        departing: "cu plecare pe",
        selectDay: "Selectează o zi cu disponibilitate pentru a vedea vacanțele.",
        flightIncluded: "Zbor inclus",
        viewDates: "Vezi datele",
        perPerson: "/pers",
        cruiseType: "Tip croazieră",
        allTypes: "Toate tipurile",
        typeRiver: "Fluvială",
        typeOcean: "Oceanică",
        cruisePlaceholder: "Croazieră sau destinație",
        sailing: "plecare",
        sailings: "plecări",
        viewCruise: "Vezi croaziera",
        noSailings: "Nu am găsit plecări în următoarele luni.",
      },
      calendar: {
        prevMonth: "Luna anterioară",
        nextMonth: "Luna următoare",
        offer: "ofertă",
        offers: "oferte",
      },
    },
  },
} satisfies LocaleMessageDefinitions<{ catalog: OperatorAdminCatalogMessages }>
