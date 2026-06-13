import { financePaymentAuthorizationService } from "./service-payment-authorizations.js"
import { financePaymentInstrumentService } from "./service-payment-instruments.js"
import { financePaymentSessionCompletionService } from "./service-payment-session-completion.js"
import { financePaymentSessionService } from "./service-payment-sessions.js"

export const financePaymentProcessingService = {
  ...financePaymentInstrumentService,
  ...financePaymentSessionService,
  ...financePaymentSessionCompletionService,
  ...financePaymentAuthorizationService,
}
