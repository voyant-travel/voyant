/**
 * `@voyantjs/checkout-react/ui` — universal checkout/payment UI components on top
 * of `@voyantjs/checkout` + `@voyantjs/checkout-react`.
 *
 *   - <PaymentStep>             capability-driven payment picker
 *   - <PaymentLinkLandingPage>  customer view of a payment link
 *   - <CollectPaymentDialog>    operator-side "collect now" dialog
 *
 * Pure presentation. State lives in `@voyantjs/finance`, orchestration in
 * `@voyantjs/checkout`, hooks in `@voyantjs/checkout-react`. Re-exports the
 * universal types (`PaymentChoice`, capabilities) from checkout-react so
 * consumers can `import { PaymentStep, type PaymentChoice } from
 * "@voyantjs/checkout-react/ui"` without a second import.
 *
 * See `docs/architecture/payments-architecture.md`.
 */

export {
  CollectPaymentDialog,
  type CollectPaymentDialogProps,
} from "./components/collect-payment-dialog.js"
export {
  type BankTransferInstructions,
  PaymentLinkLandingPage,
  type PaymentLinkLandingPageProps,
} from "./components/payment-link-landing-page.js"
export {
  PaymentStep,
  type PaymentStepExtraOption,
  type PaymentStepProps,
} from "./components/payment-step.js"
export type { CheckoutPaymentTargetType, CheckoutUiMessages } from "./i18n/index.js"
export {
  type CheckoutUiMessageOverrides,
  CheckoutUiMessagesProvider,
  checkoutUiMessageDefinitions,
  getCheckoutUiI18n,
  resolveCheckoutUiMessages,
  useCheckoutUiI18n,
  useCheckoutUiI18nOrDefault,
  useCheckoutUiMessages,
  useCheckoutUiMessagesOrDefault,
} from "./i18n/index.js"
export type {
  PaymentChoice,
  PaymentStepCapabilities,
  SavedPaymentAccount,
} from "./index.js"
