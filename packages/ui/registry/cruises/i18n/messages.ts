import type { SearchIndexEntry } from "@voyantjs/cruises-react"

export type RegistryCruiseType = SearchIndexEntry["cruiseType"]

export type RegistryCruisesMessages = {
  cruiseCard: {
    cruiseTypeLabels: Record<RegistryCruiseType, string>
    pricingOnRequest: string
    nights: string
    roundTrip: string
    departurePrefix: string
    priceFromSuffix: string
  }
  cruiseList: {
    loading: string
    error: string
    empty: string
  }
}
