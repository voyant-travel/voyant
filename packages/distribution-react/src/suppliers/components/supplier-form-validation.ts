import { z } from "zod/v4"
import type { SuppliersUiMessages } from "../i18n/messages.js"

export function getRateSchema(messages: SuppliersUiMessages) {
  const dialog = messages.dialogs.rate
  return z
    .object({
      name: z.string().min(1, dialog.validationNameRequired),
      currency: z
        .string()
        .min(3, dialog.validationIsoCurrency)
        .max(3, dialog.validationIsoCurrency),
      amount: z.coerce.number().min(0, dialog.validationNonNegative),
      unit: z.enum(["per_person", "per_group", "per_night", "per_vehicle", "flat"]),
      validFrom: z.string().optional().nullable(),
      validTo: z.string().optional().nullable(),
      minPax: z.coerce.number().int().positive().optional().or(z.literal("")).nullable(),
      maxPax: z.coerce.number().int().positive().optional().or(z.literal("")).nullable(),
      notes: z.string().optional().nullable(),
    })
    .superRefine((values, ctx) => {
      if (values.validFrom && values.validTo && values.validFrom > values.validTo) {
        ctx.addIssue({
          code: "custom",
          path: ["validTo"],
          message: dialog.validationDateRange,
        })
      }

      if (
        typeof values.minPax === "number" &&
        typeof values.maxPax === "number" &&
        values.minPax > values.maxPax
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["maxPax"],
          message: dialog.validationPaxRange,
        })
      }
    })
}

export function getContractSchema(messages: SuppliersUiMessages) {
  const dialog = messages.dialogs.contract
  return z
    .object({
      agreementNumber: z.string().optional().nullable(),
      startDate: z.string().min(1, dialog.validationStartDateRequired),
      endDate: z.string().optional().nullable(),
      renewalDate: z.string().optional().nullable(),
      status: z.enum(["active", "expired", "pending", "terminated"]),
      terms: z.string().optional().nullable(),
    })
    .superRefine((values, ctx) => {
      if (values.startDate && values.endDate && values.startDate > values.endDate) {
        ctx.addIssue({
          code: "custom",
          path: ["endDate"],
          message: dialog.validationEndDateRange,
        })
      }

      if (
        values.renewalDate &&
        ((values.startDate && values.renewalDate < values.startDate) ||
          (values.endDate && values.renewalDate > values.endDate))
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["renewalDate"],
          message: dialog.validationRenewalDateRange,
        })
      }
    })
}
