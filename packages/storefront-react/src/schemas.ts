import {
  storefrontDepartureItinerarySchema,
  storefrontDepartureListQuerySchema,
  storefrontDepartureListResponseSchema,
  storefrontDeparturePricePreviewInputSchema,
  storefrontDeparturePricePreviewSchema,
  storefrontDepartureSchema,
  storefrontOfferApplyInputSchema,
  storefrontOfferMutationResponseSchema,
  storefrontOfferMutationResultSchema,
  storefrontOfferRedeemInputSchema,
  storefrontProductExtensionsQuerySchema,
  storefrontProductExtensionsResponseSchema,
  storefrontPromotionalOfferListQuerySchema,
  storefrontPromotionalOfferSchema,
  storefrontSettingsSchema,
} from "@voyantjs/storefront"
import { z } from "zod"

export const singleEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: item })
export const arrayEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: z.array(item) })

export {
  storefrontDepartureItinerarySchema,
  storefrontDepartureListQuerySchema,
  storefrontDepartureListResponseSchema,
  storefrontDeparturePricePreviewInputSchema,
  storefrontDeparturePricePreviewSchema,
  storefrontDepartureSchema,
  storefrontOfferApplyInputSchema,
  storefrontOfferMutationResponseSchema,
  storefrontOfferMutationResultSchema,
  storefrontOfferRedeemInputSchema,
  storefrontProductExtensionsQuerySchema,
  storefrontProductExtensionsResponseSchema,
  storefrontPromotionalOfferListQuerySchema,
  storefrontPromotionalOfferSchema,
  storefrontSettingsSchema,
}

export const storefrontSettingsResponseSchema = singleEnvelope(storefrontSettingsSchema)
export const storefrontDepartureResponseSchema = singleEnvelope(storefrontDepartureSchema)
export const storefrontDeparturePricePreviewResponseSchema = singleEnvelope(
  storefrontDeparturePricePreviewSchema,
)
export const storefrontDepartureItineraryResponseSchema = singleEnvelope(
  storefrontDepartureItinerarySchema,
)
export const storefrontPromotionalOfferListResponseSchema = arrayEnvelope(
  storefrontPromotionalOfferSchema,
)
export const storefrontPromotionalOfferResponseSchema = singleEnvelope(
  storefrontPromotionalOfferSchema,
)

export type StorefrontSettingsRecord = z.infer<typeof storefrontSettingsSchema>
export type StorefrontDepartureRecord = z.infer<typeof storefrontDepartureSchema>
export type StorefrontDepartureListQuery = z.input<typeof storefrontDepartureListQuerySchema>
export type StorefrontDeparturePricePreviewInput = z.input<
  typeof storefrontDeparturePricePreviewInputSchema
>
export type StorefrontDeparturePricePreviewRecord = z.infer<
  typeof storefrontDeparturePricePreviewSchema
>
export type StorefrontDepartureItineraryRecord = z.infer<typeof storefrontDepartureItinerarySchema>
export type StorefrontProductExtensionsQuery = z.input<
  typeof storefrontProductExtensionsQuerySchema
>
export type StorefrontPromotionalOfferListQuery = z.input<
  typeof storefrontPromotionalOfferListQuerySchema
>
export type StorefrontPromotionalOfferRecord = z.infer<typeof storefrontPromotionalOfferSchema>
export type StorefrontOfferApplyInput = z.input<typeof storefrontOfferApplyInputSchema>
export type StorefrontOfferRedeemInput = z.input<typeof storefrontOfferRedeemInputSchema>
export type StorefrontOfferMutationRecord = z.infer<typeof storefrontOfferMutationResultSchema>
