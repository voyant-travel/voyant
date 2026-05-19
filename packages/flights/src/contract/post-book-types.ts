import type {
  AncillarySelection,
  FlightOffer,
  FlightOrder,
  FlightPassenger,
  Money,
} from "./types.js"

export interface SeatAssignment {
  passengerId: string
  segmentId: string
  seatNumber: string
  /** Per-pax seat fee. Omitted = included in fare or already paid. */
  price?: Money
  /** Provider-specific data — opaque round-trip. */
  providerData?: Record<string, unknown>
}

export interface SeatSelectionRequest {
  orderId: string
  selections: SeatAssignment[]
}

export interface SeatSelectionResponse {
  order: FlightOrder
  selections: SeatAssignment[]
  /** Total additional charge collected for the seat change, if any. */
  additionalAmount?: Money
}

export type CheckInStatus = "initiated" | "checked_in" | "failed"

export interface CheckInRequest {
  orderId: string
  passengerIds?: string[]
  segmentIds?: string[]
}

export interface FlightBoardingPass {
  passengerId: string
  segmentId: string
  boardingPassId?: string
  seatNumber?: string
  sequenceNumber?: string
  zone?: string
  /** Provider-specific data — opaque round-trip. */
  providerData?: Record<string, unknown>
}

export interface CheckInResponse {
  order: FlightOrder
  status: CheckInStatus
  boardingPasses?: FlightBoardingPass[]
}

export type FlightModifyReason =
  | "customer_request"
  | "schedule_change"
  | "name_correction"
  | "disruption"
  | "operational"

export interface FlightModifyRequest {
  orderId: string
  /** Re-priced replacement offer when the modification changes itinerary/fare. */
  offer?: FlightOffer
  /** Replacement passenger details for corrections allowed by the provider. */
  passengers?: FlightPassenger[]
  /** Add or replace ancillary picks as part of the modification. */
  ancillaries?: AncillarySelection
  reason?: FlightModifyReason
}

export interface FlightModifyResponse {
  order: FlightOrder
  /** Positive means collect more from the traveler; negative means credit due. */
  priceDifference?: Money
  penalties?: Money[]
}

export type FlightRefundReason =
  | "customer_request"
  | "schedule_change"
  | "disruption"
  | "duplicate_booking"
  | "medical"
  | "other"

export interface FlightRefundRequest {
  orderId: string
  reason?: FlightRefundReason
  /** Omit for a full refund; provide for supplier-supported partial refunds. */
  amount?: Money
}

export interface FlightRefundResponse {
  order: FlightOrder
  refundId?: string
  refundedAmount: Money
  penalties?: Money[]
}

export interface FlightVoidResponse {
  order: FlightOrder
  voidId?: string
  voidedAt: string
}

export type SsrCode =
  | "WCHR"
  | "WCHS"
  | "WCHC"
  | "BLND"
  | "DEAF"
  | "MAAS"
  | "UMNR"
  | "INFT"
  | "PETC"
  | "VGML"
  | "KSML"
  | "MOML"
  | "OTHER"

export interface SsrRequest {
  orderId: string
  code: SsrCode
  passengerIds?: string[]
  segmentIds?: string[]
  text?: string
}

export interface SsrResponse {
  order: FlightOrder
  ssrId?: string
  status: "requested" | "confirmed" | "rejected"
}
