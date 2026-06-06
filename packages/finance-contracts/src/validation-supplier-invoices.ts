import { z } from "zod"

// ---------- accounts payable (supplier invoices) ----------
// Contracts for docs/architecture/supplier-invoices-profitability.md §5 / §6.

export const supplierInvoiceStatusSchema = z.enum([
  "draft",
  "received",
  "approved",
  "partially_paid",
  "paid",
  "disputed",
  "void",
])

export const apServiceTypeSchema = z.enum([
  "transport",
  "flight",
  "accommodation",
  "guide",
  "meal",
  "experience",
  "insurance",
  "other",
])

export const costAllocationTargetTypeSchema = z.enum([
  "departure",
  "product",
  "booking",
  "traveler",
  "unattributed",
])

export const costAllocationSplitMethodSchema = z.enum(["manual", "per_pax", "equal", "weighted"])

const currency = z.string().min(3).max(3)

export const supplierInvoiceLineInputSchema = z.object({
  description: z.string().min(1),
  serviceType: apServiceTypeSchema.default("other"),
  supplierServiceId: z.string().optional().nullable(),
  quantity: z.number().int().min(1).default(1),
  unitAmountCents: z.number().int(),
  taxRateBps: z.number().int().min(0).optional().nullable(),
  taxAmountCents: z.number().int().min(0).default(0),
  totalAmountCents: z.number().int(),
  sortOrder: z.number().int().min(0).default(0),
})

export const supplierCostAllocationInputSchema = z
  .object({
    // Omit / null = allocates the whole invoice (line-less mode).
    supplierInvoiceLineId: z.string().optional().nullable(),
    targetType: costAllocationTargetTypeSchema,
    departureId: z.string().optional().nullable(),
    productId: z.string().optional().nullable(),
    bookingId: z.string().optional().nullable(),
    bookingItemId: z.string().optional().nullable(),
    travelerId: z.string().optional().nullable(),
    amountCents: z.number().int(),
    baseAmountCents: z.number().int().optional().nullable(),
    splitMethod: costAllocationSplitMethodSchema.default("manual"),
  })
  .superRefine((value, ctx) => {
    // Exactly one target id is set and it matches targetType (§6.1 rule 2).
    const targets = {
      departure: value.departureId,
      product: value.productId,
      booking: value.bookingId,
      traveler: value.travelerId,
      unattributed: null,
    } as const
    const setKeys = (["departureId", "productId", "bookingId", "travelerId"] as const).filter(
      (k) => value[k] != null,
    )
    if (value.targetType === "unattributed") {
      if (setKeys.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: "unattributed allocations must not set a target id",
          path: setKeys,
        })
      }
      return
    }
    if (targets[value.targetType] == null) {
      ctx.addIssue({
        code: "custom",
        message: `targetType "${value.targetType}" requires its matching id`,
        path: [`${value.targetType}Id`],
      })
    }
    const expectedKey = `${value.targetType}Id`
    const extras = setKeys.filter((k) => k !== expectedKey)
    if (extras.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "exactly one target id may be set per allocation",
        path: extras,
      })
    }
  })

const supplierInvoiceCoreSchema = z.object({
  supplierId: z.string().min(1),
  supplierInvoiceNo: z.string().min(1).max(255),
  internalRef: z.string().max(255).optional().nullable(),
  status: supplierInvoiceStatusSchema.default("draft"),
  currency,
  baseCurrency: currency.optional().nullable(),
  fxRateSetId: z.string().optional().nullable(),
  subtotalCents: z.number().int().min(0).optional(),
  taxCents: z.number().int().min(0).optional(),
  totalCents: z.number().int().min(0).optional(),
  taxRegimeId: z.string().optional().nullable(),
  issueDate: z.string().min(1),
  dueDate: z.string().optional().nullable(),
  storageKey: z.string().optional().nullable(),
  extractionId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const insertSupplierInvoiceSchema = supplierInvoiceCoreSchema.extend({
  // Optional: create header + lines + allocations in one call. Totals are
  // recomputed from lines when lines are supplied.
  lines: z.array(supplierInvoiceLineInputSchema).optional(),
  allocations: z.array(supplierCostAllocationInputSchema).optional(),
})

export const updateSupplierInvoiceSchema = supplierInvoiceCoreSchema.partial()

export const setSupplierInvoiceLinesSchema = z.object({
  lines: z.array(supplierInvoiceLineInputSchema),
})

export const setSupplierCostAllocationsSchema = z.object({
  allocations: z.array(supplierCostAllocationInputSchema),
})

export const insertSupplierInvoiceAttachmentSchema = z.object({
  kind: z.string().min(1).default("supporting_document"),
  name: z.string().min(1),
  mimeType: z.string().optional().nullable(),
  fileSize: z.number().int().min(0).optional().nullable(),
  storageKey: z.string().optional().nullable(),
  checksum: z.string().optional().nullable(),
  metadata: z.unknown().optional(),
})

export type InsertSupplierInvoiceAttachmentInput = z.infer<
  typeof insertSupplierInvoiceAttachmentSchema
>

export const supplierInvoiceListSortFieldSchema = z.enum([
  "issueDate",
  "dueDate",
  "totalCents",
  "balanceDueCents",
  "status",
  "createdAt",
])

export const supplierInvoiceListSortDirSchema = z.enum(["asc", "desc"])

export const supplierInvoiceListQuerySchema = z.object({
  supplierId: z.string().optional(),
  status: supplierInvoiceStatusSchema.optional(),
  currency: z.string().optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  // Filter by an attributed target (joins through allocations).
  departureId: z.string().optional(),
  productId: z.string().optional(),
  bookingId: z.string().optional(),
  search: z.string().optional(),
  sortBy: supplierInvoiceListSortFieldSchema.default("createdAt"),
  sortDir: supplierInvoiceListSortDirSchema.default("desc"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export type SupplierInvoiceLineInput = z.infer<typeof supplierInvoiceLineInputSchema>
export type SupplierCostAllocationInput = z.infer<typeof supplierCostAllocationInputSchema>
export type InsertSupplierInvoiceInput = z.infer<typeof insertSupplierInvoiceSchema>
export type UpdateSupplierInvoiceInput = z.infer<typeof updateSupplierInvoiceSchema>
export type SupplierInvoiceListQuery = z.infer<typeof supplierInvoiceListQuerySchema>
