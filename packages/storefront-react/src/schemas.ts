import {
  storefrontDepartureItineraryQuerySchema,
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
  storefrontOfferApplyInputSchema,
  storefrontOfferMutationResponseSchema,
  storefrontOfferMutationResultSchema,
  storefrontOfferRedeemInputSchema,
  storefrontProductExtensionsQuerySchema,
  storefrontProductExtensionsResponseSchema,
  storefrontPromotionalOfferListQuerySchema,
  storefrontPromotionalOfferSchema,
  storefrontSettingsInputSchema,
  storefrontSettingsPatchSchema,
  storefrontSettingsSchema,
} from "@voyant-travel/storefront/validation"
import { z } from "zod"

export const singleEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: item })
export const arrayEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: z.array(item) })

export {
  storefrontDepartureItineraryQuerySchema,
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
  storefrontOfferApplyInputSchema,
  storefrontOfferMutationResponseSchema,
  storefrontOfferMutationResultSchema,
  storefrontOfferRedeemInputSchema,
  storefrontProductExtensionsQuerySchema,
  storefrontProductExtensionsResponseSchema,
  storefrontPromotionalOfferListQuerySchema,
  storefrontPromotionalOfferSchema,
  storefrontSettingsInputSchema,
  storefrontSettingsPatchSchema,
  storefrontSettingsSchema,
}

/**
 * Public market discovery contract (voyant#2643). Mirrors the narrow projection
 * served by `GET /v1/public/markets` (see `packages/commerce` `PublicMarket`).
 * Defined locally so the storefront client stays decoupled from the commerce
 * package while validating the anonymous discovery response.
 *
 * The market `id` is the catalog-search scope key — thread it into catalog
 * search as the `market` parameter. `code`/`name` are display-only.
 */
export const storefrontMarketLocaleSchema = z.object({
  languageTag: z.string(),
  isDefault: z.boolean(),
})

export const storefrontMarketCurrencySchema = z.object({
  currencyCode: z.string(),
  isDefault: z.boolean(),
})

export const storefrontMarketSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  regionCode: z.string().nullable(),
  countryCode: z.string().nullable(),
  defaultLocale: z.string(),
  defaultCurrency: z.string(),
  locales: z.array(storefrontMarketLocaleSchema),
  currencies: z.array(storefrontMarketCurrencySchema),
})

export const storefrontMarketsResponseSchema = arrayEnvelope(storefrontMarketSchema)

export type StorefrontMarketLocale = z.infer<typeof storefrontMarketLocaleSchema>
export type StorefrontMarketCurrency = z.infer<typeof storefrontMarketCurrencySchema>
export type StorefrontMarketRecord = z.infer<typeof storefrontMarketSchema>

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
export type StorefrontSettingsInput = z.input<typeof storefrontSettingsInputSchema>
export type StorefrontSettingsPatchInput = z.input<typeof storefrontSettingsPatchSchema>
export type StorefrontDepartureRecord = z.infer<typeof storefrontDepartureSchema>
export type StorefrontDepartureItineraryQuery = z.input<
  typeof storefrontDepartureItineraryQuerySchema
>
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
