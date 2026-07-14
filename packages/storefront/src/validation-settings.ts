import { z } from "zod"

export const languageTagSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/)

const httpUrlSchema = z.url().refine(
  (value) => {
    try {
      const protocol = new URL(value).protocol
      return protocol === "http:" || protocol === "https:"
    } catch {
      return false
    }
  },
  { message: "URL must use http or https" },
)
const urlOrNullSchema = httpUrlSchema.nullable()
const colorTokenSchema = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
const textOrNullSchema = z.string().trim().min(1).nullable()

export const storefrontPaymentMethodCodeSchema = z.enum([
  "card",
  "bank_transfer",
  "cash",
  "travel_credit",
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

export const storefrontPaymentStructureSchema = z.enum(["full", "split"])

export const storefrontPaymentDueConditionSchema = z.enum(["after_booking", "before_departure"])

export const storefrontPaymentScheduleEntryInputSchema = z.object({
  percent: z.number().min(0).max(100),
  dueInDays: z.number().int().min(0),
  dueCondition: storefrontPaymentDueConditionSchema,
})

export const storefrontPaymentScheduleEntrySchema = storefrontPaymentScheduleEntryInputSchema

export const storefrontSupportLinkInputSchema = z.object({
  label: z.string().trim().min(1),
  url: httpUrlSchema,
})

export const storefrontSupportLinkSchema = storefrontSupportLinkInputSchema

export const storefrontBankTransferAccountInputSchema = z.object({
  provider: z.string().trim().min(1).optional().nullable(),
  currency: z.string().trim().min(1).optional().nullable(),
  iban: z.string().trim().min(1),
  beneficiary: z.string().trim().min(1),
  bank: z.string().trim().min(1),
})

export const storefrontBankTransferAccountSchema = z.object({
  provider: textOrNullSchema,
  currency: textOrNullSchema,
  iban: z.string().trim().min(1),
  beneficiary: z.string().trim().min(1),
  bank: z.string().trim().min(1),
})

export const storefrontBankTransferInputSchema = z.object({
  dueDays: z.number().int().min(0).optional().nullable(),
  account: storefrontBankTransferAccountInputSchema.optional().nullable(),
  accountHolder: z.string().trim().min(1).optional().nullable(),
  bankName: z.string().trim().min(1).optional().nullable(),
  iban: z.string().trim().min(1).optional().nullable(),
  bic: z.string().trim().min(1).optional().nullable(),
  paymentReference: z.string().trim().min(1).optional().nullable(),
  instructions: z.string().trim().min(1).optional().nullable(),
})

export const storefrontBankTransferSchema = z.object({
  dueDays: z.number().int().min(0).nullable(),
  account: storefrontBankTransferAccountSchema.nullable(),
  accountHolder: textOrNullSchema,
  bankName: textOrNullSchema,
  iban: textOrNullSchema,
  bic: textOrNullSchema,
  paymentReference: textOrNullSchema,
  instructions: textOrNullSchema,
})

export const storefrontPaymentScheduleInputSchema = z.object({
  depositPercent: z.number().min(0).max(100).optional().nullable(),
  balanceDueDaysBeforeDeparture: z.number().int().min(0).optional().nullable(),
})

export const storefrontPaymentScheduleSchema = z.object({
  depositPercent: z.number().min(0).max(100).nullable(),
  balanceDueDaysBeforeDeparture: z.number().int().min(0).nullable(),
})

export const storefrontCurrencyDisplaySchema = z.enum(["code", "symbol", "name"])

export const storefrontSettingsInputSchema = z.object({
  branding: z
    .object({
      logoUrl: httpUrlSchema.optional().nullable(),
      faviconUrl: httpUrlSchema.optional().nullable(),
      brandMarkUrl: httpUrlSchema.optional().nullable(),
      primaryColor: colorTokenSchema.optional().nullable(),
      accentColor: colorTokenSchema.optional().nullable(),
      supportedLanguages: z.array(languageTagSchema).optional(),
    })
    .optional(),
  support: z
    .object({
      email: z.email().optional().nullable(),
      phone: z.string().trim().min(1).optional().nullable(),
      links: z.array(storefrontSupportLinkInputSchema).optional(),
    })
    .optional(),
  legal: z
    .object({
      termsUrl: httpUrlSchema.optional().nullable(),
      privacyUrl: httpUrlSchema.optional().nullable(),
      cancellationUrl: httpUrlSchema.optional().nullable(),
      defaultContractTemplateId: z.string().trim().min(1).optional().nullable(),
    })
    .optional(),
  localization: z
    .object({
      defaultLocale: languageTagSchema.optional().nullable(),
      currencyDisplay: storefrontCurrencyDisplaySchema.optional(),
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
      structure: storefrontPaymentStructureSchema.optional(),
      schedule: z.array(storefrontPaymentScheduleEntryInputSchema).optional(),
      defaultSchedule: storefrontPaymentScheduleInputSchema.optional().nullable(),
      bankTransfer: storefrontBankTransferInputSchema.optional().nullable(),
    })
    .optional(),
})

export const storefrontSettingsSchema = z.object({
  branding: z.object({
    logoUrl: urlOrNullSchema,
    faviconUrl: urlOrNullSchema,
    brandMarkUrl: urlOrNullSchema,
    primaryColor: colorTokenSchema.nullable(),
    accentColor: colorTokenSchema.nullable(),
    supportedLanguages: z.array(languageTagSchema),
  }),
  support: z.object({
    email: z.email().nullable(),
    phone: z.string().trim().min(1).nullable(),
    links: z.array(storefrontSupportLinkSchema),
  }),
  legal: z.object({
    termsUrl: urlOrNullSchema,
    privacyUrl: urlOrNullSchema,
    cancellationUrl: urlOrNullSchema,
    defaultContractTemplateId: z.string().trim().min(1).nullable(),
  }),
  localization: z.object({
    defaultLocale: languageTagSchema.nullable(),
    currencyDisplay: storefrontCurrencyDisplaySchema,
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
    structure: storefrontPaymentStructureSchema,
    schedule: z.array(storefrontPaymentScheduleEntrySchema),
    defaultSchedule: storefrontPaymentScheduleSchema.nullable(),
    bankTransfer: storefrontBankTransferSchema.nullable(),
  }),
})

export const storefrontSettingsPatchSchema = z.object({
  branding: storefrontSettingsInputSchema.shape.branding,
  support: storefrontSettingsInputSchema.shape.support,
  legal: storefrontSettingsInputSchema.shape.legal,
  localization: storefrontSettingsInputSchema.shape.localization,
  forms: storefrontSettingsInputSchema.shape.forms,
  payment: storefrontSettingsInputSchema.shape.payment,
})

export type StorefrontPaymentMethodCode = z.infer<typeof storefrontPaymentMethodCodeSchema>
export type StorefrontFormFieldInput = z.infer<typeof storefrontFormFieldInputSchema>
export type StorefrontFormField = z.infer<typeof storefrontFormFieldSchema>
export type StorefrontPaymentMethodInput = z.infer<typeof storefrontPaymentMethodInputSchema>
export type StorefrontPaymentMethod = z.infer<typeof storefrontPaymentMethodSchema>
export type StorefrontPaymentStructure = z.infer<typeof storefrontPaymentStructureSchema>
export type StorefrontPaymentDueCondition = z.infer<typeof storefrontPaymentDueConditionSchema>
export type StorefrontPaymentScheduleEntryInput = z.infer<
  typeof storefrontPaymentScheduleEntryInputSchema
>
export type StorefrontPaymentScheduleEntry = z.infer<typeof storefrontPaymentScheduleEntrySchema>
export type StorefrontSupportLinkInput = z.infer<typeof storefrontSupportLinkInputSchema>
export type StorefrontSupportLink = z.infer<typeof storefrontSupportLinkSchema>
export type StorefrontBankTransferAccountInput = z.infer<
  typeof storefrontBankTransferAccountInputSchema
>
export type StorefrontBankTransferAccount = z.infer<typeof storefrontBankTransferAccountSchema>
export type StorefrontBankTransferInput = z.infer<typeof storefrontBankTransferInputSchema>
export type StorefrontBankTransfer = z.infer<typeof storefrontBankTransferSchema>
export type StorefrontPaymentScheduleInput = z.infer<typeof storefrontPaymentScheduleInputSchema>
export type StorefrontPaymentSchedule = z.infer<typeof storefrontPaymentScheduleSchema>
export type StorefrontCurrencyDisplay = z.infer<typeof storefrontCurrencyDisplaySchema>
export type StorefrontSettingsInput = z.infer<typeof storefrontSettingsInputSchema>
export type StorefrontSettings = z.infer<typeof storefrontSettingsSchema>
export type StorefrontSettingsPatchInput = z.infer<typeof storefrontSettingsPatchSchema>
