import { z } from "zod"

const bookingStatusSchema = z.enum([
  "draft",
  "on_hold",
  "awaiting_payment",
  "confirmed",
  "in_progress",
  "completed",
  "expired",
  "cancelled",
])

const customerPortalBookingTravelerTypeSchema = z.enum(["traveler", "occupant", "other"])

const bookingItemTypeSchema = z.enum([
  "unit",
  "extra",
  "service",
  "fee",
  "tax",
  "discount",
  "adjustment",
  "accommodation",
  "transport",
  "other",
])

const bookingItemStatusSchema = z.enum([
  "draft",
  "on_hold",
  "confirmed",
  "cancelled",
  "expired",
  "fulfilled",
])

const bookingItemParticipantRoleSchema = z.enum(["traveler", "occupant", "beneficiary", "other"])

const bookingDocumentTypeSchema = z.enum([
  "visa",
  "insurance",
  "health",
  "passport_copy",
  "contract",
  "invoice",
  "proforma",
  "credit_note",
  "other",
])
const bookingDocumentSourceSchema = z.enum(["booking_document", "legal", "finance"])

const bookingFulfillmentTypeSchema = z.enum([
  "voucher",
  "ticket",
  "pdf",
  "qr_code",
  "barcode",
  "mobile",
  "other",
])

const bookingFulfillmentDeliveryChannelSchema = z.enum([
  "download",
  "email",
  "api",
  "wallet",
  "other",
])

const bookingFulfillmentStatusSchema = z.enum([
  "pending",
  "issued",
  "reissued",
  "revoked",
  "failed",
])

const seatingPreferenceSchema = z.enum(["aisle", "window", "middle", "no_preference"])
const customerPortalAddressLabelSchema = z.enum([
  "primary",
  "billing",
  "shipping",
  "mailing",
  "meeting",
  "service",
  "legal",
  "other",
])
const customerPortalFinanceInvoiceTypeSchema = z.enum(["invoice", "proforma", "credit_note"])
const customerPortalFinanceInvoiceStatusSchema = z.enum([
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "void",
])
const customerPortalFinancePaymentStatusSchema = z.enum([
  "pending",
  "completed",
  "failed",
  "refunded",
])
const customerPortalFinancePaymentMethodSchema = z.enum([
  "bank_transfer",
  "credit_card",
  "debit_card",
  "cash",
  "cheque",
  "wallet",
  "direct_bill",
  "voucher",
  "other",
])
const customerPortalBookingPaymentSummaryStatusSchema = z.enum([
  "unpaid",
  "partially_paid",
  "paid",
  "overdue",
])
const customerPortalFinanceDocumentAvailabilitySchema = z.enum([
  "missing",
  "pending",
  "ready",
  "failed",
  "stale",
])
const customerPortalFinanceDocumentFormatSchema = z.enum(["html", "pdf", "xml", "json"])
const customerPortalProfileDocumentTypeSchema = z.enum([
  "passport",
  "id_card",
  "visa",
  "drivers_license",
  "other",
])
const customerPortalCompanionDocumentTypeSchema = z.enum([
  "passport",
  "id_card",
  "visa",
  "drivers_license",
  "other",
])

export const customerPortalAddressSchema = z.object({
  id: z.string(),
  label: customerPortalAddressLabelSchema,
  fullText: z.string().nullable(),
  line1: z.string().nullable(),
  line2: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  isPrimary: z.boolean(),
})

export const updateCustomerPortalAddressSchema = z
  .object({
    label: customerPortalAddressLabelSchema.optional(),
    fullText: z.string().nullable().optional(),
    line1: z.string().nullable().optional(),
    line2: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    postalCode: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    isPrimary: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one billingAddress field must be provided",
  })

export const customerPortalRecordSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  preferredLanguage: z.string().nullable(),
  preferredCurrency: z.string().nullable(),
  birthday: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  billingAddress: customerPortalAddressSchema.nullable(),
  relation: z.string().nullable(),
  status: z.string(),
})

export const customerPortalBootstrapCandidateSchema = customerPortalRecordSchema.extend({
  linkable: z.boolean(),
  claimedByAnotherUser: z.boolean(),
})

export const customerPortalProfileSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  firstName: z.string().nullable(),
  middleName: z.string().nullable(),
  lastName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  locale: z.string(),
  timezone: z.string().nullable(),
  seatingPreference: seatingPreferenceSchema.nullable(),
  dateOfBirth: z.string().nullable(),
  address: z
    .object({
      country: z.string().nullable(),
      state: z.string().nullable(),
      city: z.string().nullable(),
      postalCode: z.string().nullable(),
      addressLine1: z.string().nullable(),
      addressLine2: z.string().nullable(),
    })
    .nullable(),
  documents: z.array(
    z.object({
      type: customerPortalProfileDocumentTypeSchema,
      number: z.string(),
      issuingAuthority: z.string().nullable(),
      issuingCountry: z.string(),
      nationality: z.string().nullable(),
      expiryDate: z.string(),
      issueDate: z.string().nullable(),
    }),
  ),
  marketingConsent: z.boolean(),
  marketingConsentAt: z.string().nullable(),
  marketingConsentSource: z.string().nullable(),
  notificationDefaults: z.record(z.string(), z.unknown()).nullable(),
  uiPrefs: z.record(z.string(), z.unknown()).nullable(),
  customerRecord: customerPortalRecordSchema.nullable(),
})

export const updateCustomerPortalRecordSchema = z.object({
  preferredLanguage: z.string().max(35).nullable().optional(),
  preferredCurrency: z.string().min(3).max(3).nullable().optional(),
  birthday: z.string().date().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  billingAddress: updateCustomerPortalAddressSchema.optional(),
})

export const updateCustomerPortalProfileSchema = z
  .object({
    firstName: z.string().max(200).nullable().optional(),
    middleName: z.string().max(200).nullable().optional(),
    lastName: z.string().max(200).nullable().optional(),
    avatarUrl: z.string().url().nullable().optional(),
    locale: z.string().max(10).optional(),
    timezone: z.string().max(64).nullable().optional(),
    seatingPreference: seatingPreferenceSchema.nullable().optional(),
    dateOfBirth: z.string().date().nullable().optional(),
    address: z
      .object({
        country: z.string().nullable().optional(),
        state: z.string().nullable().optional(),
        city: z.string().nullable().optional(),
        postalCode: z.string().nullable().optional(),
        addressLine1: z.string().nullable().optional(),
        addressLine2: z.string().nullable().optional(),
      })
      .optional(),
    documents: z
      .array(
        z.object({
          type: customerPortalProfileDocumentTypeSchema,
          number: z.string().min(1).max(255),
          issuingAuthority: z.string().max(255).nullable().optional(),
          issuingCountry: z.string().min(1).max(255),
          nationality: z.string().max(255).nullable().optional(),
          expiryDate: z.string().date(),
          issueDate: z.string().date().nullable().optional(),
        }),
      )
      .optional(),
    marketingConsent: z.boolean().optional(),
    marketingConsentSource: z.string().max(255).nullable().optional(),
    notificationDefaults: z.record(z.string(), z.unknown()).nullable().optional(),
    uiPrefs: z.record(z.string(), z.unknown()).nullable().optional(),
    customerRecord: updateCustomerPortalRecordSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  })

export const customerPortalContactExistsQuerySchema = z.object({
  email: z.string().email(),
})

export const customerPortalContactExistsResultSchema = z.object({
  email: z.string().email(),
  authAccountExists: z.boolean(),
  customerRecordExists: z.boolean(),
  linkedCustomerRecordExists: z.boolean(),
})

export const customerPortalPhoneContactExistsQuerySchema = z.object({
  phone: z.string().min(1).max(50),
})

export const customerPortalPhoneContactExistsResultSchema = z.object({
  phone: z.string(),
  customerRecordExists: z.boolean(),
  linkedCustomerRecordExists: z.boolean(),
})

export const bootstrapCustomerPortalSchema = z
  .object({
    customerRecordId: z.string().optional(),
    createCustomerIfMissing: z.boolean().default(true),
    firstName: z.string().max(200).nullable().optional(),
    lastName: z.string().max(200).nullable().optional(),
    marketingConsent: z.boolean().optional(),
    marketingConsentSource: z.string().max(255).nullable().optional(),
    customerRecord: updateCustomerPortalRecordSchema.optional(),
  })
  .refine((value) => value.customerRecordId || value.createCustomerIfMissing !== false, {
    message: "Provide a customerRecordId or allow customer creation",
  })

export const bootstrapCustomerPortalResultSchema = z.object({
  status: z.enum([
    "already_linked",
    "linked_existing_customer",
    "created_customer",
    "customer_selection_required",
  ]),
  profile: customerPortalProfileSchema.nullable(),
  candidates: z.array(customerPortalBootstrapCandidateSchema).default([]),
})

export const customerPortalCompanionSchema = z.object({
  id: z.string(),
  role: z.string(),
  name: z.string(),
  title: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  isPrimary: z.boolean(),
  notes: z.string().nullable(),
  typeKey: z.string().nullable(),
  person: z.object({
    firstName: z.string().nullable(),
    middleName: z.string().nullable(),
    lastName: z.string().nullable(),
    dateOfBirth: z.string().nullable(),
    addresses: z.array(
      z.object({
        type: z.string().nullable(),
        country: z.string().nullable(),
        state: z.string().nullable(),
        city: z.string().nullable(),
        postalCode: z.string().nullable(),
        addressLine1: z.string().nullable(),
        addressLine2: z.string().nullable(),
        isDefault: z.boolean(),
      }),
    ),
    documents: z.array(
      z.object({
        type: customerPortalCompanionDocumentTypeSchema,
        number: z.string().nullable(),
        issuingAuthority: z.string().nullable(),
        country: z.string().nullable(),
        issueDate: z.string().nullable(),
        expiryDate: z.string().nullable(),
      }),
    ),
  }),
  metadata: z.record(z.string(), z.unknown()).nullable(),
})

export const createCustomerPortalCompanionSchema = z.object({
  role: z
    .enum([
      "general",
      "primary",
      "reservations",
      "operations",
      "front_desk",
      "sales",
      "emergency",
      "accounting",
      "legal",
      "other",
    ])
    .default("other"),
  name: z.string().min(1).max(255),
  title: z.string().max(255).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  isPrimary: z.boolean().default(false),
  notes: z.string().nullable().optional(),
  typeKey: z.string().max(100).nullable().optional(),
  person: z
    .object({
      firstName: z.string().max(200).nullable().optional(),
      middleName: z.string().max(200).nullable().optional(),
      lastName: z.string().max(200).nullable().optional(),
      dateOfBirth: z.string().date().nullable().optional(),
      addresses: z
        .array(
          z.object({
            type: z.string().max(100).nullable().optional(),
            country: z.string().max(255).nullable().optional(),
            state: z.string().max(255).nullable().optional(),
            city: z.string().max(255).nullable().optional(),
            postalCode: z.string().max(50).nullable().optional(),
            addressLine1: z.string().max(255).nullable().optional(),
            addressLine2: z.string().max(255).nullable().optional(),
            isDefault: z.boolean().optional(),
          }),
        )
        .optional(),
      documents: z
        .array(
          z.object({
            type: customerPortalCompanionDocumentTypeSchema,
            number: z.string().max(255).nullable().optional(),
            issuingAuthority: z.string().max(255).nullable().optional(),
            country: z.string().max(255).nullable().optional(),
            issueDate: z.string().date().nullable().optional(),
            expiryDate: z.string().date().nullable().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const updateCustomerPortalCompanionSchema = createCustomerPortalCompanionSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  })

export const importCustomerPortalBookingTravelersSchema = z.object({
  bookingIds: z.array(z.string()).min(1).optional(),
})

export const importCustomerPortalBookingTravelersResultSchema = z.object({
  created: z.array(customerPortalCompanionSchema),
  skippedCount: z.number().int().nonnegative(),
})

export const importCustomerPortalBookingParticipantsSchema =
  importCustomerPortalBookingTravelersSchema
export const importCustomerPortalBookingParticipantsResultSchema =
  importCustomerPortalBookingTravelersResultSchema

export const customerPortalBookingSummarySchema = z.object({
  bookingId: z.string(),
  bookingNumber: z.string(),
  status: bookingStatusSchema,
  sellCurrency: z.string(),
  sellAmountCents: z.number().int().nullable(),
  productTitle: z.string().nullable(),
  paymentStatus: customerPortalBookingPaymentSummaryStatusSchema,
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  pax: z.number().int().nullable(),
  confirmedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  travelerCount: z.number().int(),
  primaryTravelerName: z.string().nullable(),
})

export const customerPortalBookingItemTravelerSchema = z.object({
  id: z.string(),
  travelerId: z.string(),
  role: bookingItemParticipantRoleSchema,
  isPrimary: z.boolean(),
})

export const customerPortalBookingItemParticipantSchema = customerPortalBookingItemTravelerSchema

export const customerPortalBookingItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  itemType: bookingItemTypeSchema,
  status: bookingItemStatusSchema,
  serviceDate: z.string().nullable(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  quantity: z.number().int(),
  sellCurrency: z.string(),
  unitSellAmountCents: z.number().int().nullable(),
  totalSellAmountCents: z.number().int().nullable(),
  notes: z.string().nullable(),
  travelerLinks: z.array(customerPortalBookingItemTravelerSchema),
})

export const customerPortalBookingTravelerSchema = z.object({
  id: z.string(),
  participantType: customerPortalBookingTravelerTypeSchema,
  firstName: z.string(),
  lastName: z.string(),
  isPrimary: z.boolean(),
})

export const customerPortalBookingParticipantSchema = customerPortalBookingTravelerSchema

export const customerPortalBookingBillingContactSchema = z.object({
  email: z.string().nullable(),
  phone: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  country: z.string().nullable(),
  state: z.string().nullable(),
  city: z.string().nullable(),
  address1: z.string().nullable(),
  postal: z.string().nullable(),
})

export const customerPortalBookingDocumentSchema = z.object({
  id: z.string(),
  source: bookingDocumentSourceSchema,
  travelerId: z.string().nullable(),
  type: bookingDocumentTypeSchema,
  fileName: z.string(),
  fileUrl: z.string(),
  mimeType: z.string().nullable(),
  reference: z.string().nullable(),
})

export const customerPortalBookingFinancialDocumentSchema = z.object({
  invoiceId: z.string(),
  invoiceNumber: z.string(),
  invoiceType: customerPortalFinanceInvoiceTypeSchema,
  invoiceStatus: customerPortalFinanceInvoiceStatusSchema,
  currency: z.string(),
  totalCents: z.number().int(),
  paidCents: z.number().int(),
  balanceDueCents: z.number().int(),
  issueDate: z.string(),
  dueDate: z.string(),
  documentStatus: customerPortalFinanceDocumentAvailabilitySchema,
  format: customerPortalFinanceDocumentFormatSchema.nullable(),
  generatedAt: z.string().nullable(),
  downloadUrl: z.string().nullable(),
})

export const customerPortalBookingPaymentSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  invoiceNumber: z.string(),
  invoiceType: customerPortalFinanceInvoiceTypeSchema,
  status: customerPortalFinancePaymentStatusSchema,
  paymentMethod: customerPortalFinancePaymentMethodSchema,
  amountCents: z.number().int(),
  currency: z.string(),
  paymentDate: z.string(),
  referenceNumber: z.string().nullable(),
  notes: z.string().nullable(),
})

export const customerPortalBookingFinancialsSchema = z.object({
  documents: z.array(customerPortalBookingFinancialDocumentSchema),
  payments: z.array(customerPortalBookingPaymentSchema),
})

export const customerPortalBookingFulfillmentSchema = z.object({
  id: z.string(),
  bookingItemId: z.string().nullable(),
  travelerId: z.string().nullable(),
  fulfillmentType: bookingFulfillmentTypeSchema,
  deliveryChannel: bookingFulfillmentDeliveryChannelSchema,
  status: bookingFulfillmentStatusSchema,
  artifactUrl: z.string().nullable(),
})

export const customerPortalBookingDetailSchema = z.object({
  bookingId: z.string(),
  bookingNumber: z.string(),
  status: bookingStatusSchema,
  sellCurrency: z.string(),
  sellAmountCents: z.number().int().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  pax: z.number().int().nullable(),
  confirmedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  travelers: z.array(customerPortalBookingTravelerSchema),
  items: z.array(customerPortalBookingItemSchema),
  billingContact: customerPortalBookingBillingContactSchema.nullable(),
  documents: z.array(customerPortalBookingDocumentSchema),
  financials: customerPortalBookingFinancialsSchema,
  fulfillments: z.array(customerPortalBookingFulfillmentSchema),
})

export type CustomerPortalProfile = z.infer<typeof customerPortalProfileSchema>
export type UpdateCustomerPortalProfileInput = z.infer<typeof updateCustomerPortalProfileSchema>
export type CustomerPortalContactExistsQuery = z.infer<
  typeof customerPortalContactExistsQuerySchema
>
export type CustomerPortalContactExistsResult = z.infer<
  typeof customerPortalContactExistsResultSchema
>
export type CustomerPortalPhoneContactExistsQuery = z.infer<
  typeof customerPortalPhoneContactExistsQuerySchema
>
export type CustomerPortalPhoneContactExistsResult = z.infer<
  typeof customerPortalPhoneContactExistsResultSchema
>
export type BootstrapCustomerPortalInput = z.infer<typeof bootstrapCustomerPortalSchema>
export type BootstrapCustomerPortalResult = z.infer<typeof bootstrapCustomerPortalResultSchema>
export type CustomerPortalBootstrapCandidate = z.infer<
  typeof customerPortalBootstrapCandidateSchema
>
export type CustomerPortalCompanion = z.infer<typeof customerPortalCompanionSchema>
export type CreateCustomerPortalCompanionInput = z.infer<typeof createCustomerPortalCompanionSchema>
export type UpdateCustomerPortalCompanionInput = z.infer<typeof updateCustomerPortalCompanionSchema>
export type ImportCustomerPortalBookingTravelersInput = z.infer<
  typeof importCustomerPortalBookingTravelersSchema
>
export type ImportCustomerPortalBookingTravelersResult = z.infer<
  typeof importCustomerPortalBookingTravelersResultSchema
>
export type ImportCustomerPortalBookingParticipantsInput = ImportCustomerPortalBookingTravelersInput
export type ImportCustomerPortalBookingParticipantsResult =
  ImportCustomerPortalBookingTravelersResult
export type CustomerPortalBookingSummary = z.infer<typeof customerPortalBookingSummarySchema>
export type CustomerPortalBookingBillingContact = z.infer<
  typeof customerPortalBookingBillingContactSchema
>
export type CustomerPortalBookingDocument = z.infer<typeof customerPortalBookingDocumentSchema>
export type CustomerPortalAddress = z.infer<typeof customerPortalAddressSchema>
export type UpdateCustomerPortalAddressInput = z.input<typeof updateCustomerPortalAddressSchema>
export type CustomerPortalBookingFinancialDocument = z.infer<
  typeof customerPortalBookingFinancialDocumentSchema
>
export type CustomerPortalBookingPayment = z.infer<typeof customerPortalBookingPaymentSchema>
export type CustomerPortalBookingFinancials = z.infer<typeof customerPortalBookingFinancialsSchema>
export type CustomerPortalBookingDetail = z.infer<typeof customerPortalBookingDetailSchema>
