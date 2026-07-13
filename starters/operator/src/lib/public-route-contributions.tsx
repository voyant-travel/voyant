import { createFinancePublicRouteContribution } from "@voyant-travel/finance-react/public-routes"
import { createQuotesPublicRouteContribution } from "@voyant-travel/quotes-react/public-routes"
import { useAdminMessages } from "./admin-i18n"
import { getApiUrl } from "./env"
import {
  OperatorStorefrontMessagesProvider,
  useOperatorStorefrontMessages,
} from "./storefront-messages"

export const financePublicRoutes = createFinancePublicRouteContribution({
  getApiUrl,
  StorefrontMessagesProvider: OperatorStorefrontMessagesProvider,
  usePaymentResolverMessages: () => useOperatorStorefrontMessages().pay,
  usePaymentLinkMessages: () => ({
    ...useOperatorStorefrontMessages().pay,
    bookingSummary: useAdminMessages().bookings.detail.paymentLinkSummary,
    tripSummary: useAdminMessages().trips.paymentLinkSummary,
  }),
})

export const quotesPublicRoutes = createQuotesPublicRouteContribution({
  getApiUrl,
  StorefrontMessagesProvider: OperatorStorefrontMessagesProvider,
  useProposalMessages: () => useOperatorStorefrontMessages().proposal,
})
