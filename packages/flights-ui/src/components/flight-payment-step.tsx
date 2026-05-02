"use client"

import {
  type PaymentChoice,
  PaymentStep,
  type PaymentStepCapabilities,
  type PaymentStepExtraOption,
  type SavedPaymentAccount,
} from "@voyantjs/checkout-ui"
import type { PaymentIntent } from "@voyantjs/flights/contract/types"
import { Landmark } from "lucide-react"
import { useMemo } from "react"

// Re-export the canonical types so existing flights-ui consumers don't
// need to import from `@voyantjs/checkout-ui` directly.
export type { PaymentStepCapabilities, SavedPaymentAccount }
/** Back-compat alias — older callers used this name; same shape. */
export type SavedPaymentMethod = SavedPaymentAccount

export interface FlightPaymentStepProps {
  /** Flight-contract intent — kept for back-compat with the booking shell. */
  value: PaymentIntent
  onChange: (next: PaymentIntent) => void
  /** Saved methods for the picked person — empty array when none on file. */
  savedMethods: SavedPaymentAccount[]
  loadingSavedMethods?: boolean
  /** Currently selected saved method id (mirror of state held in the parent). */
  selectedSavedId: string | null
  onSelectSaved: (id: string | null) => void
  /**
   * What the active processor / template actually offers for immediate
   * charge flows (`chargeSavedCard`, `newCard`). Hold and the
   * "Issue on agency credit" extra are always rendered.
   *
   * See `docs/architecture/payments-architecture.md` §Core Rule 7.
   */
  capabilities?: PaymentStepCapabilities
}

/**
 * Flight-vertical wrapper around `<PaymentStep>` from `@voyantjs/checkout-ui`.
 * Maps the universal `PaymentChoice` event into the flight contract's
 * `PaymentIntent` shape, and contributes the "Issue ticket on agency
 * credit" extra option (flight-specific).
 */
export function FlightPaymentStep({
  value,
  onChange,
  savedMethods,
  loadingSavedMethods,
  selectedSavedId,
  onSelectSaved,
  capabilities,
}: FlightPaymentStepProps) {
  const choice = useMemo<PaymentChoice | null>(
    () => intentToChoice(value, savedMethods, selectedSavedId),
    [value, savedMethods, selectedSavedId],
  )

  return (
    <PaymentStep
      value={choice}
      onChange={(next) => {
        if (!next) {
          onChange({ type: "hold" })
          onSelectSaved(null)
          return
        }
        if (next.type === "saved_method") {
          onSelectSaved(next.method.id)
          // The CRM `processor_token` for the method isn't on the
          // PublicPaymentAccount projection. The vertical wrapper here
          // emits a placeholder token derived from the account id; the
          // parent is expected to call `useInitiateCheckoutCollection`
          // with `paymentInstrumentId: next.method.id` rather than
          // relying on the flight `PaymentIntent.token` field.
          onChange({
            type: "card",
            token: `acct:${next.method.id}`,
          })
          return
        }
        onSelectSaved(null)
        if (next.type === "new_card") {
          onChange({
            type: "card",
            token: next.cardToken,
            ...(next.cardholderName ? { cardholderName: next.cardholderName } : {}),
          })
          return
        }
        if (next.type === "extra" && next.optionId === EXTRA_AGENCY_CREDIT.id) {
          onChange({ type: "ticket_on_credit" })
          return
        }
        // `hold` at the contract level — the parent's order-creation flow
        // produces a payment session + landing URL the operator shares.
        onChange({ type: "hold" })
      }}
      capabilities={capabilities ?? {}}
      savedMethods={savedMethods}
      loadingSavedMethods={loadingSavedMethods}
      extraOptions={FLIGHT_EXTRA_OPTIONS}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Flight-specific extras
// ─────────────────────────────────────────────────────────────────────────────

const EXTRA_AGENCY_CREDIT: PaymentStepExtraOption = {
  id: "ticket_on_credit",
  label: "Issue ticket on agency credit",
  description: "Bill against the agency's IATA / consolidator credit line.",
  icon: <Landmark className="h-4 w-4 text-muted-foreground" />,
}

const FLIGHT_EXTRA_OPTIONS: ReadonlyArray<PaymentStepExtraOption> = [EXTRA_AGENCY_CREDIT]

// ─────────────────────────────────────────────────────────────────────────────
// PaymentIntent ⇄ PaymentChoice translation
// ─────────────────────────────────────────────────────────────────────────────

function intentToChoice(
  intent: PaymentIntent,
  savedMethods: SavedPaymentAccount[],
  selectedSavedId: string | null,
): PaymentChoice | null {
  if (intent.type === "ticket_on_credit") {
    return { type: "extra", optionId: EXTRA_AGENCY_CREDIT.id }
  }
  if (intent.type === "card") {
    if (selectedSavedId) {
      const method = savedMethods.find((m) => m.id === selectedSavedId)
      if (method) return { type: "saved_method", method }
    }
    return {
      type: "new_card",
      cardToken: intent.token,
      ...(intent.cardholderName ? { cardholderName: intent.cardholderName } : {}),
    }
  }
  return { type: "hold" }
}
