import type { Module } from "@voyantjs/core"
import type { HonoModule } from "@voyantjs/hono/module"

import { createStorefrontPublicRoutes } from "./routes-public.js"

export type { StorefrontPublicRoutes } from "./routes-public.js"
export { createStorefrontPublicRoutes } from "./routes-public.js"
export type {
  StorefrontOfferResolvers,
  StorefrontRequestContext,
  StorefrontServiceOptions,
} from "./service.js"
export { createStorefrontService, resolveStorefrontSettings } from "./service.js"
export { evaluateStorefrontTransportEligibility } from "./service-transport-eligibility.js"
export type {
  StorefrontAppliedOffer,
  StorefrontDepartureListQuery,
  StorefrontFormField,
  StorefrontFormFieldInput,
  StorefrontOfferApplyInput,
  StorefrontOfferMutationResult,
  StorefrontOfferRedeemInput,
  StorefrontPaymentMethod,
  StorefrontPaymentMethodCode,
  StorefrontPaymentMethodInput,
  StorefrontProductAvailabilitySummaryQuery,
  StorefrontPromotionalOffer,
  StorefrontSettings,
  StorefrontSettingsInput,
} from "./validation.js"
export {
  storefrontAppliedOfferSchema,
  storefrontDepartureItinerarySchema,
  storefrontDepartureListQuerySchema,
  storefrontDepartureListResponseSchema,
  storefrontDeparturePricePreviewInputSchema,
  storefrontDeparturePricePreviewSchema,
  storefrontDepartureSchema,
  storefrontFormFieldInputSchema,
  storefrontFormFieldOptionSchema,
  storefrontFormFieldSchema,
  storefrontFormFieldTypeSchema,
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
  storefrontSettingsSchema,
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
    publicPath: "/",
    publicRoutes: createStorefrontPublicRoutes(options),
  }
}
