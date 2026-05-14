import { availabilitySlotStatusSchema } from "@voyantjs/availability/validation"
import {
  publicBookingSessionSchema,
  publicCreateBookingSessionSchema,
} from "@voyantjs/bookings/public-validation"
import { publicBookingPaymentOptionsSchema } from "@voyantjs/finance/public-validation"
import { z } from "zod"

export const storefrontBookingSessionBootstrapQuoteSchema = z.object({
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase()),
  totalSellAmountCents: z.number().int().min(0),
  quotedAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
})

export const storefrontBookingSessionBootstrapInputSchema = z.object({
  departureId: z.string().trim().min(1),
  slotId: z.string().trim().min(1),
  quote: storefrontBookingSessionBootstrapQuoteSchema,
  session: publicCreateBookingSessionSchema,
  reprice: z
    .object({
      catalogId: z.string().optional(),
      applyToSession: z.boolean().default(true),
      selections: z
        .array(
          z.object({
            itemId: z.string().optional(),
            itemIndex: z.number().int().min(0).default(0),
            optionId: z.string().nullable().optional(),
            optionUnitId: z.string().nullable().optional(),
            pricingCategoryId: z.string().nullable().optional(),
            quantity: z.number().int().positive().optional(),
          }),
        )
        .min(1),
    })
    .optional()
    .nullable(),
})

export const storefrontBookingSessionAvailabilitySnapshotSchema = z.object({
  departureId: z.string(),
  slotId: z.string(),
  productId: z.string(),
  optionId: z.string().nullable(),
  dateLocal: z.string(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  timezone: z.string(),
  status: availabilitySlotStatusSchema,
  unlimited: z.boolean(),
  initialPax: z.number().int().nullable(),
  remainingPax: z.number().int().nullable(),
  remainingResources: z.number().int().nullable(),
  pastCutoff: z.boolean(),
  tooEarly: z.boolean(),
})

export const storefrontBookingSessionRepricingSnapshotSchema = z.object({
  sessionId: z.string(),
  catalogId: z.string().nullable(),
  currencyCode: z.string(),
  originalTotalSellAmountCents: z.number().int(),
  currentTotalSellAmountCents: z.number().int(),
  deltaSellAmountCents: z.number().int(),
  items: z.array(
    z.object({
      itemId: z.string(),
      title: z.string(),
      productId: z.string().nullable(),
      optionId: z.string().nullable(),
      optionUnitId: z.string().nullable(),
      optionUnitName: z.string().nullable(),
      optionUnitType: z.string().nullable(),
      pricingCategoryId: z.string().nullable(),
      quantity: z.number().int(),
      pricingMode: z.string(),
      unitSellAmountCents: z.number().int().nullable(),
      totalSellAmountCents: z.number().int().nullable(),
      warnings: z.array(z.string()),
    }),
  ),
  warnings: z.array(z.string()),
  appliedToSession: z.boolean(),
})

const storefrontBookingBootstrapScheduleTypeSchema = z.enum([
  "deposit",
  "installment",
  "balance",
  "hold",
  "full",
  "other",
])

export const storefrontBookingSessionPaymentScheduleSchema = z.object({
  id: z.string().nullable(),
  scheduleType: storefrontBookingBootstrapScheduleTypeSchema,
  status: z.enum(["pending", "due", "paid", "waived", "cancelled", "expired"]),
  dueDate: z.string(),
  currency: z.string(),
  amountCents: z.number().int(),
  notes: z.string().nullable(),
})

export const storefrontBookingSessionPaymentPlanSchema = z.object({
  source: z.enum(["persisted_schedule", "computed_policy"]),
  policySource: z
    .enum(["booking", "listing", "category", "supplier", "operator_default"])
    .nullable(),
  schedules: z.array(storefrontBookingSessionPaymentScheduleSchema),
  recommendedTarget: publicBookingPaymentOptionsSchema.shape.recommendedTarget,
})

export const storefrontBookingSessionBootstrapResultSchema = z.object({
  session: publicBookingSessionSchema,
  quote: storefrontBookingSessionBootstrapQuoteSchema.extend({
    quotedAt: z.string().nullable(),
    expiresAt: z.string().nullable(),
  }),
  pricing: storefrontBookingSessionRepricingSnapshotSchema,
  availability: storefrontBookingSessionAvailabilitySnapshotSchema,
  paymentPlan: storefrontBookingSessionPaymentPlanSchema,
  currency: z.string(),
  dueDates: z.array(
    z.object({
      scheduleType: storefrontBookingBootstrapScheduleTypeSchema,
      dueDate: z.string(),
      amountCents: z.number().int(),
      currency: z.string(),
    }),
  ),
})

export const storefrontBookingSessionBootstrapResponseSchema = z.object({
  data: storefrontBookingSessionBootstrapResultSchema,
})

export type StorefrontBookingSessionBootstrapInput = z.infer<
  typeof storefrontBookingSessionBootstrapInputSchema
>
export type StorefrontBookingSessionBootstrapResult = z.infer<
  typeof storefrontBookingSessionBootstrapResultSchema
>
