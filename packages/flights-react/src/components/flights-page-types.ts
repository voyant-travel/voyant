import type { CabinClass, PassengerCounts } from "@voyantjs/flights/contract/types"
import type { TripType } from "./flight-search-form.js"
import type { PopularRoute } from "./popular-routes.js"

export type FlowStage = "outbound" | "return" | "ready"

export interface FlightsPageSearchParams {
  tripType?: TripType
  from?: string
  to?: string
  depart?: string
  ret?: string
  leg?: "outbound" | "return"
  outboundOfferId?: string
  returnOfferId?: string
  pax_a?: number
  pax_c?: number
  pax_i?: number
  cabin?: CabinClass
  carriers?: string[]
  maxStops?: number
  maxPrice?: number
  page?: number
}

export interface FlightsPageSearchChangeOptions {
  replace?: boolean
}

export interface FlightBookingNavigationTarget {
  outboundOfferId: string
  returnOfferId?: string
  passengers: PassengerCounts
  cabin: CabinClass
}

export interface FlightsPageProps {
  search: FlightsPageSearchParams
  onSearchChange: (next: FlightsPageSearchParams, options?: FlightsPageSearchChangeOptions) => void
  onBookOffer: (target: FlightBookingNavigationTarget) => void
  routes?: PopularRoute[]
  className?: string
}
