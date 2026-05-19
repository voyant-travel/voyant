import type {
  CancelTripComponentsResult,
  PriceTripResult,
  ReserveTripResult,
  StartCheckoutResult,
  Trip,
  TripCancellationPreviewResult,
  TripComponent,
  TripEnvelope,
  TripListResult,
} from "@voyantjs/travel-composer"
import { z } from "zod"

export const singleEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: item })

const unknownData = z.unknown()

export const tripResponseSchema = singleEnvelope(unknownData) as z.ZodType<{
  data: Trip
}>
export const tripListResponseSchema = unknownData as z.ZodType<TripListResult>
export const tripEnvelopeResponseSchema = singleEnvelope(unknownData) as z.ZodType<{
  data: TripEnvelope
}>
export const tripComponentResponseSchema = singleEnvelope(unknownData) as z.ZodType<{
  data: TripComponent
}>
export const tripComponentsResponseSchema = singleEnvelope(unknownData) as z.ZodType<{
  data: Trip["components"]
}>
export const priceTripResponseSchema = singleEnvelope(unknownData) as z.ZodType<{
  data: PriceTripResult
}>
export const reserveTripResponseSchema = singleEnvelope(unknownData) as z.ZodType<{
  data: ReserveTripResult
}>
export const startTripCheckoutResponseSchema = singleEnvelope(unknownData) as z.ZodType<{
  data: StartCheckoutResult
}>
export const previewTripCancellationResponseSchema = singleEnvelope(unknownData) as z.ZodType<{
  data: TripCancellationPreviewResult
}>
export const cancelTripComponentsResponseSchema = singleEnvelope(unknownData) as z.ZodType<{
  data: CancelTripComponentsResult
}>
