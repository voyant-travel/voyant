import type { RegistryCruisesMessages } from "./messages"

export const registryCruisesRo: RegistryCruisesMessages = {
  cruiseCard: {
    cruiseTypeLabels: {
      ocean: "Oceanica",
      river: "Fluviala",
      expedition: "Expeditie",
      coastal: "De coasta",
    },
    pricingOnRequest: "Pret la cerere",
    nights: "{count} nopti",
    roundTrip: "circuit",
    departurePrefix: "Din {date}",
    priceFromSuffix: "de la / pers.",
  },
  cruiseList: {
    loading: "Se incarca croazierele…",
    error: "Croazierele nu au putut fi incarcate: {message}",
    empty: "Nicio croaziera nu corespunde filtrelor selectate.",
  },
}
