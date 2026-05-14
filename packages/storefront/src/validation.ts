import { availabilitySlotStatusSchema } from "@voyantjs/availability/validation"
import { extraPricingModeSchema } from "@voyantjs/extras/validation"
import { z } from "zod"

const languageTagSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/)
const urlOrNullSchema = z.url().nullable()

export const storefrontPaymentMethodCodeSchema = z.enum([
  "card",
  "bank_transfer",
  "cash",
  "voucher",
  "invoice",
])

export const storefrontFormFieldTypeSchema = z.enum([
  "text",
  "email",
  "tel",
  "textarea",
  "select",
  "checkbox",
  "date",
  "country",
])

export const storefrontFormFieldOptionSchema = z.object({
  value: z.string().trim().min(1),
  label: z.string().trim().min(1),
})

export const storefrontFormFieldInputSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  type: storefrontFormFieldTypeSchema.default("text"),
  required: z.boolean().default(false),
  placeholder: z.string().trim().min(1).optional().nullable(),
  description: z.string().trim().min(1).optional().nullable(),
  autocomplete: z.string().trim().min(1).optional().nullable(),
  options: z.array(storefrontFormFieldOptionSchema).default([]),
})

export const storefrontFormFieldSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  type: storefrontFormFieldTypeSchema,
  required: z.boolean(),
  placeholder: z.string().trim().min(1).nullable(),
  description: z.string().trim().min(1).nullable(),
  autocomplete: z.string().trim().min(1).nullable(),
  options: z.array(storefrontFormFieldOptionSchema),
})

export const storefrontPaymentMethodInputSchema = z.object({
  code: storefrontPaymentMethodCodeSchema,
  label: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional().nullable(),
  enabled: z.boolean().default(true),
})

export const storefrontPaymentMethodSchema = z.object({
  code: storefrontPaymentMethodCodeSchema,
  label: z.string().trim().min(1),
  description: z.string().trim().min(1).nullable(),
  enabled: z.boolean(),
})

export const storefrontSettingsInputSchema = z.object({
  branding: z
    .object({
      logoUrl: z.url().optional().nullable(),
      supportedLanguages: z.array(languageTagSchema).optional(),
    })
    .optional(),
  support: z
    .object({
      email: z.email().optional().nullable(),
      phone: z.string().trim().min(1).optional().nullable(),
    })
    .optional(),
  legal: z
    .object({
      termsUrl: z.url().optional().nullable(),
      privacyUrl: z.url().optional().nullable(),
      defaultContractTemplateId: z.string().trim().min(1).optional().nullable(),
    })
    .optional(),
  forms: z
    .object({
      billing: z
        .object({
          fields: z.array(storefrontFormFieldInputSchema).default([]),
        })
        .optional(),
      travelers: z
        .object({
          fields: z.array(storefrontFormFieldInputSchema).default([]),
        })
        .optional(),
    })
    .optional(),
  payment: z
    .object({
      defaultMethod: storefrontPaymentMethodCodeSchema.optional().nullable(),
      methods: z.array(storefrontPaymentMethodInputSchema).optional(),
    })
    .optional(),
})

export const storefrontSettingsSchema = z.object({
  branding: z.object({
    logoUrl: urlOrNullSchema,
    supportedLanguages: z.array(languageTagSchema),
  }),
  support: z.object({
    email: z.email().nullable(),
    phone: z.string().trim().min(1).nullable(),
  }),
  legal: z.object({
    termsUrl: urlOrNullSchema,
    privacyUrl: urlOrNullSchema,
    defaultContractTemplateId: z.string().trim().min(1).nullable(),
  }),
  forms: z.object({
    billing: z.object({
      fields: z.array(storefrontFormFieldSchema),
    }),
    travelers: z.object({
      fields: z.array(storefrontFormFieldSchema),
    }),
  }),
  payment: z.object({
    defaultMethod: storefrontPaymentMethodCodeSchema.nullable(),
    methods: z.array(storefrontPaymentMethodSchema),
  }),
})

export const storefrontDepartureStatusSchema = z.enum([
  "open",
  "closed",
  "sold_out",
  "cancelled",
  "on_request",
])

export const storefrontDepartureRoomOccupancySchema = z.object({
  adultsMin: z.number().int().min(0),
  adultsMax: z.number().int().min(0),
  childrenMax: z.number().int().min(0),
})

export const storefrontDepartureRoomPriceSchema = z.object({
  amount: z.number(),
  currencyCode: z.string(),
  roomType: z.object({
    id: z.string(),
    name: z.string(),
    occupancy: storefrontDepartureRoomOccupancySchema,
  }),
})

export const storefrontDepartureRatePlanSchema = z.object({
  id: z.string(),
  active: z.boolean(),
  name: z.string(),
  pricingModel: z.string(),
  basePrices: z.array(
    z.object({
      amount: z.number(),
      currencyCode: z.string(),
    }),
  ),
  roomPrices: z.array(storefrontDepartureRoomPriceSchema),
})

export const storefrontDepartureStartTimeSchema = z.object({
  id: z.string(),
  label: z.string().nullable(),
  startTimeLocal: z.string(),
  durationMinutes: z.number().int().nullable(),
})

export const storefrontDepartureSchema = z.object({
  id: z.string(),
  productId: z.string(),
  itineraryId: z.string(),
  optionId: z.string().nullable(),
  dateLocal: z.string().nullable(),
  startAt: z.string().nullable(),
  endAt: z.string().nullable(),
  timezone: z.string(),
  startTime: storefrontDepartureStartTimeSchema.nullable(),
  meetingPoint: z.string().nullable(),
  capacity: z.number().int().nullable(),
  remaining: z.number().int().nullable(),
  departureStatus: storefrontDepartureStatusSchema,
  nights: z.number().int().nullable(),
  days: z.number().int().nullable(),
  ratePlans: z.array(storefrontDepartureRatePlanSchema),
})

export const storefrontDepartureListQuerySchema = z.object({
  optionId: z.string().optional(),
  // `z.lazy(() => …)` for cross-package init-cycle protection — see #501.
  status: z.lazy(() => availabilitySlotStatusSchema).optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  limit: z.coerce.number().int().min(1).max(250).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export const storefrontDepartureListResponseSchema = z.object({
  data: z.array(storefrontDepartureSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
})

export const storefrontProductAvailabilityStateSchema = z.enum([
  "available",
  "sold_out",
  "closed",
  "cancelled",
  "on_request",
  "past_cutoff",
  "too_early",
  "unavailable",
])

export const storefrontProductAvailabilitySummaryQuerySchema = z.object({
  optionId: z.string().optional(),
  status: storefrontDepartureStatusSchema.optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  locale: languageTagSchema.optional(),
  limit: z.coerce.number().int().min(1).max(250).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export const storefrontProductAvailabilitySlotSchema = z.object({
  id: z.string(),
  productId: z.string(),
  optionId: z.string().nullable(),
  dateLocal: z.string().nullable(),
  startAt: z.string().nullable(),
  endAt: z.string().nullable(),
  timezone: z.string(),
  status: storefrontDepartureStatusSchema,
  availabilityState: storefrontProductAvailabilityStateSchema,
  capacity: z.number().int().nullable(),
  remaining: z.number().int().nullable(),
  pastCutoff: z.boolean(),
  tooEarly: z.boolean(),
})

export const storefrontProductAvailabilitySummarySchema = z.object({
  productId: z.string(),
  availabilityState: storefrontProductAvailabilityStateSchema,
  counts: z.object({
    total: z.number().int(),
    open: z.number().int(),
    closed: z.number().int(),
    soldOut: z.number().int(),
    cancelled: z.number().int(),
    onRequest: z.number().int(),
    pastCutoff: z.number().int(),
    tooEarly: z.number().int(),
    available: z.number().int(),
  }),
  departures: z.array(storefrontProductAvailabilitySlotSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
})

export const storefrontProductAvailabilitySummaryResponseSchema = z.object({
  data: storefrontProductAvailabilitySummarySchema,
})

export const storefrontDeparturePricePreviewInputSchema = z.object({
  pax: z
    .object({
      adults: z.coerce.number().int().min(0).default(1),
      children: z.coerce.number().int().min(0).default(0),
      infants: z.coerce.number().int().min(0).default(0),
    })
    .default({ adults: 1, children: 0, infants: 0 }),
  currencyCode: z.string().trim().min(1).optional().nullable(),
  rooms: z
    .array(
      z.object({
        unitId: z.string().trim().min(1),
        occupancy: z.coerce.number().int().min(1).default(1),
        quantity: z.coerce.number().int().min(1).default(1),
      }),
    )
    .default([]),
  extras: z
    .array(
      z.object({
        extraId: z.string().trim().min(1),
        quantity: z.coerce.number().int().min(1).default(1),
      }),
    )
    .default([]),
})

export const storefrontDeparturePriceLineItemSchema = z.object({
  name: z.string(),
  total: z.number(),
  quantity: z.number().int().min(1),
  unitPrice: z.number(),
})

export const storefrontDeparturePricePreviewSchema = z.object({
  departureId: z.string(),
  productId: z.string(),
  optionId: z.string().nullable(),
  currencyCode: z.string(),
  basePrice: z.number(),
  taxAmount: z.number(),
  total: z.number(),
  notes: z.string().nullable(),
  lineItems: z.array(storefrontDeparturePriceLineItemSchema),
})

export const storefrontProductExtensionsQuerySchema = z.object({
  optionId: z.string().optional(),
})

export const storefrontProductExtensionMediaSchema = z.object({
  url: z.string().trim().min(1),
  alt: z.string().trim().min(1).nullable(),
})

export const storefrontProductExtensionDetailSchema = z.object({
  description: z.string().nullable(),
  media: z.array(storefrontProductExtensionMediaSchema),
})

export const storefrontProductExtensionSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  required: z.boolean(),
  selectable: z.boolean(),
  hasOptions: z.boolean(),
  refProductId: z.string().nullable(),
  thumb: z.string().nullable(),
  pricePerPerson: z.number().nullable(),
  currencyCode: z.string(),
  // `z.lazy(() => …)` for cross-package init-cycle protection — see #501.
  pricingMode: z.lazy(() => extraPricingModeSchema),
  defaultQuantity: z.number().int().nullable(),
  minQuantity: z.number().int().nullable(),
  maxQuantity: z.number().int().nullable(),
})

export const storefrontProductExtensionsResponseSchema = z.object({
  extensions: z.array(storefrontProductExtensionSchema),
  items: z.array(storefrontProductExtensionSchema),
  details: z.record(z.string(), storefrontProductExtensionDetailSchema),
  currencyCode: z.string(),
})

export const storefrontDepartureItinerarySegmentSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
})

export const storefrontDepartureItineraryDaySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  thumbnail: z
    .object({
      url: z.string().trim().min(1),
    })
    .nullable(),
  segments: z.array(storefrontDepartureItinerarySegmentSchema),
})

export const storefrontDepartureItinerarySchema = z.object({
  id: z.string(),
  itineraryId: z.string(),
  days: z.array(storefrontDepartureItineraryDaySchema),
})

export const storefrontPromotionalOfferSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().nullable(),
  description: z.string().nullable(),
  discountType: z.enum(["percentage", "fixed_amount"]),
  discountValue: z.string(),
  currency: z.string().nullable(),
  applicableProductIds: z.array(z.string()),
  applicableDepartureIds: z.array(z.string()),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  minTravelers: z.number().int().nullable(),
  imageMobileUrl: z.string().nullable(),
  imageDesktopUrl: z.string().nullable(),
  stackable: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const storefrontPromotionalOfferListQuerySchema = z.object({
  departureId: z.string().optional(),
  locale: z.string().trim().min(2).optional(),
})

export const storefrontPromotionalOfferListResponseSchema = z.object({
  data: z.array(storefrontPromotionalOfferSchema),
})

export const storefrontPromotionalOfferResponseSchema = z.object({
  data: storefrontPromotionalOfferSchema,
})

export const storefrontOfferAudienceSchema = z.enum(["staff", "customer", "partner", "supplier"])

const storefrontOfferTargetInputSchema = z.object({
  productId: z.string().trim().min(1),
  departureId: z.string().trim().min(1).optional().nullable(),
  bookingId: z.string().trim().min(1).optional().nullable(),
  sessionId: z.string().trim().min(1).optional().nullable(),
  locale: z.string().trim().min(2).optional(),
  pax: z.coerce.number().int().min(1),
  audience: storefrontOfferAudienceSchema.default("customer"),
  market: z.string().trim().min(1).default("default"),
  basePriceCents: z.coerce.number().int().min(0),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase()),
})

export const storefrontOfferApplyInputSchema = storefrontOfferTargetInputSchema

export const storefrontOfferRedeemInputSchema = storefrontOfferTargetInputSchema.extend({
  code: z.string().trim().min(1).max(80),
})

export const storefrontAppliedOfferSchema = z.object({
  offerId: z.string(),
  offerName: z.string(),
  discountAppliedCents: z.number().int(),
  discountedPriceCents: z.number().int(),
  currency: z.string(),
  discountKind: z.enum(["percentage", "fixed_amount"]),
  discountPercent: z.number().nullable(),
  discountAmountCents: z.number().int().nullable(),
  appliedCode: z.string().nullable(),
  stackable: z.boolean(),
})

export const storefrontOfferMutationStatusSchema = z.enum([
  "applied",
  "not_applicable",
  "invalid",
  "conflict",
])

export const storefrontOfferMutationReasonSchema = z
  .enum([
    "offer_not_found",
    "offer_expired",
    "offer_not_yet_valid",
    "code_not_found",
    "code_required",
    "code_expired",
    "code_not_yet_valid",
    "scope",
    "min_pax",
    "currency",
    "no_discount",
    "booking_mismatch",
    "session_mismatch",
    "conflict",
  ])
  .nullable()

export const storefrontOfferConflictSchema = z.object({
  policy: z.enum(["best_discount_wins", "stackable_compose"]),
  autoAppliedOfferIds: z.array(z.string()),
  manualOfferId: z.string().nullable(),
  selectedOfferIds: z.array(z.string()),
  message: z.string(),
})

export const storefrontOfferMutationResultSchema = z.object({
  status: storefrontOfferMutationStatusSchema,
  reason: storefrontOfferMutationReasonSchema,
  offer: storefrontPromotionalOfferSchema.nullable(),
  target: z.object({
    bookingId: z.string().nullable(),
    sessionId: z.string().nullable(),
    productId: z.string(),
    departureId: z.string().nullable(),
  }),
  pricing: z.object({
    basePriceCents: z.number().int(),
    currency: z.string(),
    discountAppliedCents: z.number().int(),
    discountedPriceCents: z.number().int(),
  }),
  appliedOffers: z.array(storefrontAppliedOfferSchema),
  conflict: storefrontOfferConflictSchema.nullable(),
})

export const storefrontOfferMutationResponseSchema = z.object({
  data: storefrontOfferMutationResultSchema,
})

export type StorefrontFormFieldInput = z.infer<typeof storefrontFormFieldInputSchema>
export type StorefrontFormField = z.infer<typeof storefrontFormFieldSchema>
export type StorefrontPaymentMethodInput = z.infer<typeof storefrontPaymentMethodInputSchema>
export type StorefrontPaymentMethod = z.infer<typeof storefrontPaymentMethodSchema>
export type StorefrontPaymentMethodCode = z.infer<typeof storefrontPaymentMethodCodeSchema>
export type StorefrontSettingsInput = z.infer<typeof storefrontSettingsInputSchema>
export type StorefrontSettings = z.infer<typeof storefrontSettingsSchema>
export type StorefrontDepartureListQuery = z.infer<typeof storefrontDepartureListQuerySchema>
export type StorefrontProductAvailabilitySummaryQuery = z.infer<
  typeof storefrontProductAvailabilitySummaryQuerySchema
>
export type StorefrontDeparturePricePreviewInput = z.infer<
  typeof storefrontDeparturePricePreviewInputSchema
>
export type StorefrontPromotionalOffer = z.infer<typeof storefrontPromotionalOfferSchema>
export type StorefrontOfferApplyInput = z.infer<typeof storefrontOfferApplyInputSchema>
export type StorefrontOfferRedeemInput = z.infer<typeof storefrontOfferRedeemInputSchema>
export type StorefrontAppliedOffer = z.infer<typeof storefrontAppliedOfferSchema>
export type StorefrontOfferMutationResult = z.infer<typeof storefrontOfferMutationResultSchema>
