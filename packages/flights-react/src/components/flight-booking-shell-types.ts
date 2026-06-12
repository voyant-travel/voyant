import type {
  AncillaryCatalog,
  FlightBookRequest,
  FlightOrder,
  PassengerCounts,
} from "@voyantjs/flights/contract/types"
import type React from "react"
import type { BillingValue } from "./flight-billing-step.js"
import type { FlightItinerarySelection } from "./flight-booking-ledger.js"
import type { FlightPassengerFormProps } from "./flight-passenger-form.js"
import type { PaymentStepCapabilities, SavedPaymentMethod } from "./flight-payment-step.js"
import type { FlightSeatMapSlot } from "./flight-seats-step.js"

export type StepId =
  | "review"
  | "fares"
  | "passengers"
  | "bags"
  | "seats"
  | "services"
  | "billing"
  | "payment"
  | "confirm"

export interface StepDef {
  id: StepId
}

export const ALL_STEPS: ReadonlyArray<StepDef> = [
  { id: "review" },
  { id: "fares" },
  { id: "passengers" },
  { id: "bags" },
  { id: "seats" },
  { id: "services" },
  { id: "billing" },
  { id: "payment" },
  { id: "confirm" },
]

export const ALWAYS_VISIBLE: ReadonlySet<StepId> = new Set([
  "review",
  "passengers",
  "billing",
  "payment",
  "confirm",
])

export interface FlightBookingAncillaries {
  outboundCatalog: AncillaryCatalog | null
  returnCatalog?: AncillaryCatalog | null
  loading?: boolean
}

export interface FlightBookingSeatMaps {
  getSeatMap: (input: { offerId: string; segmentId: string }) => FlightSeatMapSlot
}

export interface FlightBookingSavedPaymentMethods {
  methods: SavedPaymentMethod[]
  loading?: boolean
}

export interface FlightBookingShellProps {
  selection: FlightItinerarySelection
  passengers: PassengerCounts
  onBook: (request: FlightBookRequest) => Promise<FlightOrder> | FlightOrder
  onBooked?: (order: FlightOrder) => void
  onCancel?: () => void
  onEditOutbound?: () => void
  onEditReturn?: () => void
  carrierName?: (iataCode: string) => string | undefined
  airportName?: (iataCode: string) => string | undefined
  ancillaries?: FlightBookingAncillaries
  seatMaps?: FlightBookingSeatMaps
  savedPaymentMethods?: FlightBookingSavedPaymentMethods
  paymentCapabilities?: PaymentStepCapabilities
  documentsRequired?: boolean
  renderPassengerPicker?: FlightPassengerFormProps["renderPicker"]
  renderBillingPersonPicker?: (apply: (prefill: Partial<BillingValue>) => void) => React.ReactNode
  renderBillingOrgPicker?: (apply: (prefill: Partial<BillingValue>) => void) => React.ReactNode
  onSaveBillingDefaults?: (value: BillingValue) => void
}
