import type { RegistryCruisesMessages } from "./messages"

export const registryCruisesEn: RegistryCruisesMessages = {
  cruiseCard: {
    cruiseTypeLabels: {
      ocean: "Ocean",
      river: "River",
      expedition: "Expedition",
      coastal: "Coastal",
    },
    pricingOnRequest: "Pricing on request",
    nights: "{count} nights",
    roundTrip: "round trip",
    departurePrefix: "From {date}",
    priceFromSuffix: "from / pp",
  },
  cruiseList: {
    loading: "Loading cruises…",
    error: "Failed to load cruises: {message}",
    empty: "No cruises match the selected filters.",
  },
}
