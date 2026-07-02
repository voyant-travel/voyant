import { typeIdSchema } from "@voyant-travel/schema-kit/typeid"
import { z } from "zod"

const supplierTypeSchema = z.enum([
  "hotel",
  "transfer",
  "guide",
  "experience",
  "airline",
  "restaurant",
  "other",
])

const supplierStatusSchema = z.enum(["active", "inactive", "pending"])

const serviceTypeSchema = z.enum([
  "accommodation",
  "transfer",
  "experience",
  "guide",
  "meal",
  "other",
])

const rateUnitSchema = z.enum(["per_person", "per_group", "per_night", "per_vehicle", "flat"])

const currencyCodeSchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, "Expected ISO 4217 code")

// ---------- suppliers ----------

const depositRuleSchema = z.object({
  kind: z.enum(["none", "percent", "fixed_cents"]),
  percent: z.number().min(0).max(100).optional(),
  amountCents: z.number().int().min(0).optional(),
})

const customerPaymentPolicySchema = z.object({
  deposit: depositRuleSchema,
  minDaysBeforeDepartureForDeposit: z.number().int().min(0),
  balanceDueDaysBeforeDeparture: z.number().int().min(0),
  balanceDueMinDaysFromNow: z.number().int().min(0),
})

const supplierCoreSchema = z.object({
  name: z.string().min(1).max(255),
  type: supplierTypeSchema,
  status: supplierStatusSchema.default("active"),
  description: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  defaultCurrency: currencyCodeSchema.optional().nullable(),
  primaryFacilityId: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  paymentTermsDays: z.number().int().positive().optional().nullable(),
  reservationTimeoutMinutes: z
    .number()
    .int()
    .min(0)
    .max(24 * 60)
    .optional()
    .nullable(),
  customerPaymentPolicy: customerPaymentPolicySchema.optional().nullable(),
  tags: z.array(z.string()).default([]),
})

export const insertSupplierSchema = supplierCoreSchema
export const updateSupplierSchema = supplierCoreSchema.partial()
export const selectSupplierSchema = supplierCoreSchema.extend({
  id: typeIdSchema("suppliers"),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const supplierListSortFieldSchema = z.enum([
  "name",
  "type",
  "status",
  "defaultCurrency",
  "createdAt",
])

export const supplierListSortDirSchema = z.enum(["asc", "desc"])

export const supplierListQuerySchema = z.object({
  type: supplierTypeSchema.optional(),
  status: supplierStatusSchema.optional(),
  primaryFacilityId: z.string().optional(),
  country: z.string().optional(),
  defaultCurrency: z.string().optional(),
  search: z.string().optional(),
  sortBy: supplierListSortFieldSchema.default("createdAt"),
  sortDir: supplierListSortDirSchema.default("desc"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const supplierAggregatesQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

export type InsertSupplier = z.infer<typeof insertSupplierSchema>
export type UpdateSupplier = z.infer<typeof updateSupplierSchema>
export type SelectSupplier = z.infer<typeof selectSupplierSchema>

// ---------- services ----------

const serviceCoreSchema = z.object({
  serviceType: serviceTypeSchema,
  facilityId: z.string().optional().nullable(),
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  duration: z.string().optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  active: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
})

export const insertServiceSchema = serviceCoreSchema
export const updateServiceSchema = serviceCoreSchema.partial()

export type InsertService = z.infer<typeof insertServiceSchema>
export type UpdateService = z.infer<typeof updateServiceSchema>

// ---------- rates ----------

const rateCoreSchema = z.object({
  name: z.string().min(1).max(255),
  currency: z.string().min(3).max(3),
  amountCents: z.number().int().min(0),
  unit: rateUnitSchema,
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
  minPax: z.number().int().positive().optional().nullable(),
  maxPax: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const insertRateSchema = rateCoreSchema
export const updateRateSchema = rateCoreSchema.partial()

export type InsertRate = z.infer<typeof insertRateSchema>
export type UpdateRate = z.infer<typeof updateRateSchema>

// ---------- notes ----------

export const insertSupplierNoteSchema = z.object({
  content: z.string().min(1).max(10000),
})

// ---------- availability ----------

export const insertAvailabilitySchema = z.object({
  date: z.string().min(1),
  available: z.boolean().default(true),
  notes: z.string().optional().nullable(),
})

export const availabilityQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
})

// ---------- contracts ----------

const supplierContractStatusSchema = z.enum(["active", "expired", "pending", "terminated"])

const contractCoreSchema = z.object({
  agreementNumber: z.string().max(255).optional().nullable(),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  renewalDate: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  status: supplierContractStatusSchema.default("active"),
})

export const insertContractSchema = contractCoreSchema
export const updateContractSchema = contractCoreSchema.partial()
