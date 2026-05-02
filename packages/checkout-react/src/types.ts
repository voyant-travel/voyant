import type { PublicBookingPaymentOptions } from "@voyantjs/finance/public-validation"

/**
 * Saved payment instrument as the picker needs it — the canonical finance
 * projection (`PublicBookingPaymentOptions["accounts"][number]`). Verticals
 * that already query that endpoint can pass elements through unchanged.
 */
export type SavedPaymentAccount = PublicBookingPaymentOptions["accounts"][number]

/**
 * Universal payment-choice contract used by the `<PaymentStep>` UI in
 * `@voyantjs/checkout-ui` and the `useCollectPayment` hook here.
 *
 * Admin-side choices only — the customer-facing card-vs-bank-transfer
 * decision happens on the public payment-link landing page, not here.
 * The admin's job is "what should happen now":
 *   - `saved_method` / `new_card` → charge a card immediately (where the
 *      processor supports it)
 *   - `extra` → vertical-specific action (e.g. "Issue on agency credit")
 *   - `hold` → create a payment session, return the shareable landing URL,
 *              the admin sends it to the customer however they prefer
 *
 * See `docs/architecture/payments-architecture.md` §Core Rule 3.
 */
export type PaymentChoice =
  | { type: "saved_method"; method: SavedPaymentAccount }
  | { type: "new_card"; cardholderName?: string; cardToken: string; expiry?: string }
  | { type: "hold" }
  | { type: "extra"; optionId: string }

/**
 * What the active processor + template offer for immediate-charge flows.
 * `hold` is universal (always available — that's how the admin generates a
 * payment link to share); only `chargeSavedCard` / `newCard` are gated.
 *
 * See `docs/architecture/payments-architecture.md` §Core Rule 7.
 */
export interface PaymentStepCapabilities {
  chargeSavedCard?: boolean
  newCard?: boolean
}

export interface PaymentStepExtraOption {
  id: string
  label: string
  description: string
}
