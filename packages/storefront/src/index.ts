import type { Module } from "@voyantjs/core"
import type { HonoModule } from "@voyantjs/hono/module"

import { createStorefrontAdminRoutes } from "./routes-admin.js"
import { createStorefrontPublicRoutes } from "./routes-public.js"

export type { StorefrontAdminRoutes } from "./routes-admin.js"
export { createStorefrontAdminRoutes } from "./routes-admin.js"
export type { StorefrontPublicRoutes } from "./routes-public.js"
export { createStorefrontPublicRoutes } from "./routes-public.js"
export type {
  StorefrontOfferResolvers,
  StorefrontRequestContext,
  StorefrontServiceOptions,
} from "./service.js"
export {
  createStorefrontService,
  mergeStorefrontSettingsPatch,
  resolveStorefrontSettings,
} from "./service.js"
export type { StorefrontBookingSessionBootstrapOptions } from "./service-booking-session-bootstrap.js"
export type {
  StorefrontIntakeGuard,
  StorefrontIntakeGuardDecision,
  StorefrontIntakeOptions,
  StorefrontNewsletterDoubleOptInHook,
} from "./service-intake.js"
export { CUSTOMER_SIGNAL_CREATED_EVENT } from "./service-intake.js"
export { evaluateStorefrontTransportEligibility } from "./service-transport-eligibility.js"
export type {
  StorefrontAppliedOffer,
  StorefrontBankTransfer,
  StorefrontBankTransferInput,
  StorefrontBookingSessionBootstrap,
  StorefrontBookingSessionBootstrapInput,
  StorefrontCurrencyDisplay,
  StorefrontDepartureListQuery,
  StorefrontDeparturePricePreview,
  StorefrontFormField,
  StorefrontFormFieldInput,
  StorefrontIntakeConsent,
  StorefrontIntakeResponse,
  StorefrontLeadContact,
  StorefrontLeadIntakeInput,
  StorefrontNewsletterSubscribeInput,
  StorefrontNewsletterSubscribeResponse,
  StorefrontOfferApplyInput,
  StorefrontOfferMutationResult,
  StorefrontOfferRedeemInput,
  StorefrontPaymentMethod,
  StorefrontPaymentMethodCode,
  StorefrontPaymentMethodInput,
  StorefrontPaymentSchedule,
  StorefrontPaymentScheduleInput,
  StorefrontProductAvailabilitySummaryQuery,
  StorefrontPromotionalOffer,
  StorefrontSettings,
  StorefrontSettingsInput,
  StorefrontSettingsPatchInput,
  StorefrontSupportLink,
  StorefrontSupportLinkInput,
} from "./validation.js"
export {
  storefrontAppliedOfferSchema,
  storefrontBankTransferInputSchema,
  storefrontBankTransferSchema,
  storefrontBookingSessionAvailabilitySnapshotSchema,
  storefrontBookingSessionBootstrapInputSchema,
  storefrontBookingSessionBootstrapSchema,
  storefrontBookingSessionPaymentPlanSchema,
  storefrontBookingSessionQuoteSchema,
  storefrontBookingSessionRepricingSnapshotSchema,
  storefrontCurrencyDisplaySchema,
  storefrontDepartureItinerarySchema,
  storefrontDepartureListQuerySchema,
  storefrontDepartureListResponseSchema,
  storefrontDeparturePriceAllocationSchema,
  storefrontDeparturePriceExtraImpactSchema,
  storefrontDeparturePriceLineItemSchema,
  storefrontDeparturePriceOfferImpactSchema,
  storefrontDeparturePriceOffersSchema,
  storefrontDeparturePricePaxSchema,
  storefrontDeparturePricePreviewInputSchema,
  storefrontDeparturePricePreviewSchema,
  storefrontDeparturePriceRequestedOfferSchema,
  storefrontDeparturePriceRoomRowSchema,
  storefrontDeparturePriceSlotSchema,
  storefrontDeparturePriceTotalsSchema,
  storefrontDeparturePriceUnitRowSchema,
  storefrontDepartureSchema,
  storefrontFormFieldInputSchema,
  storefrontFormFieldOptionSchema,
  storefrontFormFieldSchema,
  storefrontFormFieldTypeSchema,
  storefrontIntakeConsentSchema,
  storefrontIntakeResponseSchema,
  storefrontLeadContactSchema,
  storefrontLeadIntakeInputSchema,
  storefrontNewsletterSubscribeInputSchema,
  storefrontNewsletterSubscribeResponseSchema,
  storefrontOfferApplyInputSchema,
  storefrontOfferAudienceSchema,
  storefrontOfferConflictSchema,
  storefrontOfferMutationReasonSchema,
  storefrontOfferMutationResponseSchema,
  storefrontOfferMutationResultSchema,
  storefrontOfferMutationStatusSchema,
  storefrontOfferRedeemInputSchema,
  storefrontPaymentMethodCodeSchema,
  storefrontPaymentMethodInputSchema,
  storefrontPaymentMethodSchema,
  storefrontPaymentScheduleInputSchema,
  storefrontPaymentScheduleSchema,
  storefrontProductAvailabilitySlotSchema,
  storefrontProductAvailabilityStateSchema,
  storefrontProductAvailabilitySummaryQuerySchema,
  storefrontProductAvailabilitySummaryResponseSchema,
  storefrontProductAvailabilitySummarySchema,
  storefrontProductExtensionsQuerySchema,
  storefrontProductExtensionsResponseSchema,
  storefrontPromotionalOfferListQuerySchema,
  storefrontPromotionalOfferListResponseSchema,
  storefrontPromotionalOfferResponseSchema,
  storefrontPromotionalOfferSchema,
  storefrontSettingsInputSchema,
  storefrontSettingsPatchSchema,
  storefrontSettingsSchema,
  storefrontSupportLinkInputSchema,
  storefrontSupportLinkSchema,
} from "./validation.js"
export type {
  StorefrontTransportEligibilityInput,
  StorefrontTransportEligibilityIssue,
  StorefrontTransportEligibilityResult,
  StorefrontTransportEligibilityRule,
  StorefrontTransportEligibilityRuleInput,
} from "./validation-transport-eligibility.js"
export {
  storefrontRequiredDocumentTypeSchema,
  storefrontTransportEligibilityDocumentInputSchema,
  storefrontTransportEligibilityInputSchema,
  storefrontTransportEligibilityIssueCodeSchema,
  storefrontTransportEligibilityIssueSchema,
  storefrontTransportEligibilityResultSchema,
  storefrontTransportEligibilityRuleSchema,
  storefrontTransportEligibilitySeveritySchema,
  storefrontTransportEligibilityTravelerInputSchema,
  storefrontTransportEligibilityTravelerResultSchema,
  storefrontTravelDocumentTypeSchema,
} from "./validation-transport-eligibility.js"

export const storefrontModule: Module = {
  name: "storefront",
}

export function createStorefrontHonoModule(
  options?: Parameters<typeof createStorefrontPublicRoutes>[0],
): HonoModule {
  return {
    module: storefrontModule,
    adminRoutes: createStorefrontAdminRoutes(options),
    publicPath: "/",
    publicRoutes: createStorefrontPublicRoutes(options),
  }
}
