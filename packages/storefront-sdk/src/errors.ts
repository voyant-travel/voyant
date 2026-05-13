import { z } from "zod"

export const bookingEngineErrorCodes = [
  "contract_template_missing",
  "reservation_expired",
  "departure_unavailable",
  "invalid_traveler_payload",
  "payment_provider_unavailable",
  "payment_url_missing",
  "payment_webhook_pending",
  "checkout_finalization_failed",
] as const

export type BookingEngineErrorCode = (typeof bookingEngineErrorCodes)[number]

export const bookingEngineNextActions = [
  "configure_contract_template",
  "restart_reservation",
  "choose_another_departure",
  "correct_traveler_payload",
  "choose_another_payment_method",
  "retry_payment_start",
  "poll_payment_status",
  "contact_operator",
] as const

export type BookingEngineNextAction = (typeof bookingEngineNextActions)[number]

export const storefrontApiErrorEnvelopeSchema = z.object({
  code: z.string().optional(),
  message: z.string(),
  recoverable: z.boolean().optional(),
  nextAction: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
})

export const bookingEngineErrorEnvelopeSchema = storefrontApiErrorEnvelopeSchema.extend({
  code: z.enum(bookingEngineErrorCodes),
  nextAction: z.enum(bookingEngineNextActions).optional(),
})

export type StorefrontApiErrorEnvelope = z.infer<typeof storefrontApiErrorEnvelopeSchema>
export type BookingEngineErrorEnvelope = z.infer<typeof bookingEngineErrorEnvelopeSchema>

export function parseStorefrontApiErrorEnvelope(body: unknown): StorefrontApiErrorEnvelope | null {
  const direct = storefrontApiErrorEnvelopeSchema.safeParse(body)
  if (direct.success) {
    return direct.data
  }

  if (typeof body !== "object" || body === null || !("error" in body)) {
    return null
  }

  const error = (body as { error: unknown }).error
  if (typeof error === "string") {
    const code =
      typeof (body as { code?: unknown }).code === "string"
        ? (body as { code?: string }).code
        : undefined
    return { code, message: error }
  }

  const nested = storefrontApiErrorEnvelopeSchema.safeParse(error)
  return nested.success ? nested.data : null
}
