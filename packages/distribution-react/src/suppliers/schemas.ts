import { listResponseSchema } from "@voyant-travel/types"
import { z } from "zod"

export const paginatedEnvelope = listResponseSchema

export const supplierTypeSchema = z.enum([
  "hotel",
  "transfer",
  "guide",
  "experience",
  "airline",
  "restaurant",
  "other",
])

export const supplierStatusSchema = z.enum(["active", "inactive", "pending"])

export const serviceTypeSchema = z.enum([
  "accommodation",
  "transfer",
  "experience",
  "guide",
  "meal",
  "other",
])

export const rateUnitSchema = z.enum([
  "per_person",
  "per_group",
  "per_night",
  "per_vehicle",
  "flat",
])

export const contactPointKindSchema = z.enum([
  "email",
  "phone",
  "mobile",
  "whatsapp",
  "website",
  "sms",
  "fax",
  "social",
  "other",
])

export const namedContactRoleSchema = z.enum([
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

export const addressLabelSchema = z.enum([
  "primary",
  "billing",
  "shipping",
  "mailing",
  "meeting",
  "service",
  "legal",
  "other",
])

export const supplierContractStatusSchema = z.enum(["active", "expired", "pending", "terminated"])

const depositRuleClientSchema = z.object({
  kind: z.enum(["none", "percent", "fixed_cents"]),
  percent: z.number().min(0).max(100).optional(),
  amountCents: z.number().int().min(0).optional(),
})

export const supplierCustomerPaymentPolicySchema = z.object({
  deposit: depositRuleClientSchema,
  minDaysBeforeDepartureForDeposit: z.number().int().min(0),
  balanceDueDaysBeforeDeparture: z.number().int().min(0),
  balanceDueMinDaysFromNow: z.number().int().min(0),
})

export type SupplierCustomerPaymentPolicy = z.infer<typeof supplierCustomerPaymentPolicySchema>

export const supplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: supplierTypeSchema,
  status: supplierStatusSchema,
  description: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  defaultCurrency: z.string().nullable(),
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
  paymentTermsDays: z.number().int().nullable().optional(),
  reservationTimeoutMinutes: z.number().int().nullable().optional(),
  customerPaymentPolicy: supplierCustomerPaymentPolicySchema.nullable().optional(),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type Supplier = z.infer<typeof supplierSchema>

export const supplierServiceSchema = z.object({
  id: z.string(),
  supplierId: z.string(),
  serviceType: serviceTypeSchema,
  name: z.string(),
  description: z.string().nullable(),
  duration: z.string().nullable(),
  capacity: z.number().int().nullable(),
  active: z.boolean(),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type SupplierService = z.infer<typeof supplierServiceSchema>

export const supplierRateSchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  name: z.string(),
  currency: z.string(),
  amountCents: z.number().int(),
  unit: rateUnitSchema,
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  minPax: z.number().int().nullable(),
  maxPax: z.number().int().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
})

export type SupplierRate = z.infer<typeof supplierRateSchema>

export const supplierNoteSchema = z.object({
  id: z.string(),
  supplierId: z.string(),
  authorId: z.string(),
  content: z.string(),
  createdAt: z.string(),
})

export type SupplierNote = z.infer<typeof supplierNoteSchema>

export const supplierContactPointSchema = z.object({
  id: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  kind: contactPointKindSchema,
  label: z.string().nullable(),
  value: z.string(),
  normalizedValue: z.string().nullable(),
  isPrimary: z.boolean(),
  notes: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type SupplierContactPoint = z.infer<typeof supplierContactPointSchema>

export const supplierNamedContactSchema = z.object({
  id: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  role: namedContactRoleSchema,
  name: z.string(),
  title: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  isPrimary: z.boolean(),
  notes: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type SupplierNamedContact = z.infer<typeof supplierNamedContactSchema>

export const supplierAddressSchema = z.object({
  id: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  label: addressLabelSchema,
  fullText: z.string().nullable(),
  line1: z.string().nullable(),
  line2: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  timezone: z.string().nullable(),
  isPrimary: z.boolean(),
  notes: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type SupplierAddress = z.infer<typeof supplierAddressSchema>

export const supplierAvailabilitySchema = z.object({
  id: z.string(),
  supplierId: z.string(),
  date: z.string(),
  available: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.string(),
})

export type SupplierAvailability = z.infer<typeof supplierAvailabilitySchema>

export const supplierContractSchema = z.object({
  id: z.string(),
  supplierId: z.string(),
  agreementNumber: z.string().nullable(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  renewalDate: z.string().nullable(),
  terms: z.string().nullable(),
  status: supplierContractStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type SupplierContract = z.infer<typeof supplierContractSchema>

export const supplierListResponse = paginatedEnvelope(supplierSchema)
export const supplierDetailResponse = z.object({ data: supplierSchema })
export const supplierServiceResponse = z.object({ data: supplierServiceSchema })
export const supplierServicesResponse = z.object({ data: z.array(supplierServiceSchema) })
export const supplierNoteResponse = z.object({ data: supplierNoteSchema })
export const supplierNotesResponse = z.object({ data: z.array(supplierNoteSchema) })
export const supplierRateResponse = z.object({ data: supplierRateSchema })
export const supplierRatesResponse = z.object({ data: z.array(supplierRateSchema) })
export const supplierContactPointResponse = z.object({ data: supplierContactPointSchema })
export const supplierContactPointsResponse = z.object({
  data: z.array(supplierContactPointSchema),
})
export const supplierNamedContactResponse = z.object({ data: supplierNamedContactSchema })
export const supplierNamedContactsResponse = z.object({
  data: z.array(supplierNamedContactSchema),
})
export const supplierAddressResponse = z.object({ data: supplierAddressSchema })
export const supplierAddressesResponse = z.object({ data: z.array(supplierAddressSchema) })
export const supplierAvailabilityResponse = z.object({
  data: z.array(supplierAvailabilitySchema),
})
export const supplierContractResponse = z.object({ data: supplierContractSchema })
export const supplierContractsResponse = z.object({ data: z.array(supplierContractSchema) })
export const deleteSuccessResponse = z.object({ success: z.boolean() })
