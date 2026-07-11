import type { Module } from "@voyant-travel/core"
import type { HonoModule } from "@voyant-travel/hono/module"

import { registerStorefrontBookingBootstrapRuntime } from "./booking-bootstrap-subscriber-runtime.js"
import { createStorefrontAdminRoutes } from "./routes-admin.js"
import { createStorefrontPublicRoutes } from "./routes-public.js"

export type {
  GuestBookingGuardOptions,
  GuestBookingGuardRequest,
  GuestBookingLookupInput,
} from "./guest-booking-guard.js"
export { createGuestBookingGuard } from "./guest-booking-guard.js"
export type {
  PaymentLinkBankTransferDetails,
  PaymentLinkRoutesOptions,
  PaymentLinkSessionInput,
  PaymentLinkTripComponent,
  PaymentLinkTripData,
} from "./payment-link/routes.js"
export {
  createPaymentLinkHonoModule,
  createPaymentLinkRoutes,
  PAYMENT_LINK_ROUTE_PATHS,
} from "./payment-link/routes.js"
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
export {
  describeStorefrontBootstrapError,
  STOREFRONT_BOOTSTRAP_ERROR_CODES,
  type StorefrontBootstrapErrorDescriptor,
} from "./service-booking-session-bootstrap.js"
export type {
  StorefrontCustomerSignalCreatedEvent,
  StorefrontIntakeGuard,
  StorefrontIntakeGuardDecision,
  StorefrontIntakeOptions,
  StorefrontIntakePersistence,
  StorefrontIntakePersistenceResolver,
  StorefrontIntakePerson,
  StorefrontIntakeSignal,
  StorefrontNewsletterDoubleOptInHook,
} from "./service-intake.js"
export { CUSTOMER_SIGNAL_CREATED_EVENT, emitCustomerSignalCreated } from "./service-intake.js"
export { evaluateStorefrontTransportEligibility } from "./service-transport-eligibility.js"
export type {
  StorefrontAppliedOffer,
  StorefrontBankTransfer,
  StorefrontBankTransferAccount,
  StorefrontBankTransferAccountInput,
  StorefrontBankTransferInput,
  StorefrontBookingBootstrapErrorCode,
  StorefrontBookingBootstrapRejection,
  StorefrontBookingSessionBootstrap,
  StorefrontBookingSessionBootstrapInput,
  StorefrontBookingSessionCompatBootstrapInput,
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
  StorefrontPaymentDueCondition,
  StorefrontPaymentMethod,
  StorefrontPaymentMethodCode,
  StorefrontPaymentMethodInput,
  StorefrontPaymentSchedule,
  StorefrontPaymentScheduleEntry,
  StorefrontPaymentScheduleEntryInput,
  StorefrontPaymentScheduleInput,
  StorefrontPaymentStructure,
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
  storefrontBankTransferAccountInputSchema,
  storefrontBankTransferAccountSchema,
  storefrontBankTransferInputSchema,
  storefrontBankTransferSchema,
  storefrontBookingBootstrapErrorCodeSchema,
  storefrontBookingBootstrapRejectionSchema,
  storefrontBookingSessionAvailabilitySnapshotSchema,
  storefrontBookingSessionBootstrapInputSchema,
  storefrontBookingSessionBootstrapSchema,
  storefrontBookingSessionCompatBootstrapInputSchema,
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
  storefrontPaymentDueConditionSchema,
  storefrontPaymentMethodCodeSchema,
  storefrontPaymentMethodInputSchema,
  storefrontPaymentMethodSchema,
  storefrontPaymentScheduleEntryInputSchema,
  storefrontPaymentScheduleEntrySchema,
  storefrontPaymentScheduleInputSchema,
  storefrontPaymentScheduleSchema,
  storefrontPaymentStructureSchema,
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

export const storefrontAnonymousPublicPaths = ["/leads", "/newsletter", "/offers"] as const

export function createStorefrontHonoModule(
  options?: Parameters<typeof createStorefrontPublicRoutes>[0],
): HonoModule {
  return {
    module: {
      ...storefrontModule,
      bootstrap: ({ container }) => {
        if (!options?.bookingIntents) return
        registerStorefrontBookingBootstrapRuntime(container, {
          withDb: options.bookingIntents.withDb,
          serviceOptions: options,
        })
      },
    },
    adminRoutes: createStorefrontAdminRoutes(options),
    publicPath: "/",
    publicRoutes: createStorefrontPublicRoutes(options),
    anonymous: storefrontAnonymousPublicPaths,
  }
}
export {
  registerStorefrontBookingBootstrapRuntime,
  STOREFRONT_BOOKING_BOOTSTRAP_RUNTIME_KEY,
  STOREFRONT_BOOKING_BOOTSTRAP_SUBSCRIBER_ID,
  type StorefrontBookingBootstrapRuntime,
  storefrontBookingBootstrapSubscriber,
} from "./booking-bootstrap-subscriber-runtime.js"
export {
  BOOKING_BOOTSTRAP_INTENT_EVENT,
  BOOKING_BOOTSTRAP_INTENT_KIND,
  type BookingBootstrapIntentDeps,
  type BookingBootstrapIntentPayload,
  createBookingBootstrapIntentHandler,
} from "./booking-intents.js"
