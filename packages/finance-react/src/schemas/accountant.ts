import { z } from "zod"

import {
  departureProfitabilityReportSchema,
  productProfitabilityReportSchema,
} from "./profitability.js"

export const accountantShareScopeSchema = z.object({
  from: z.string().nullable(),
  to: z.string().nullable(),
  baseCurrency: z.string().nullable(),
})

export const accountantShareRecordSchema = accountantShareScopeSchema.extend({
  id: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
  lastAccessedAt: z.string().nullable(),
  accessCount: z.number().int(),
})
export type AccountantShareRecord = z.infer<typeof accountantShareRecordSchema>

export const accountantShareCreatedSchema = accountantShareScopeSchema.extend({
  id: z.string(),
  url: z.string(),
  expiresAt: z.string(),
})
export type AccountantShareCreated = z.infer<typeof accountantShareCreatedSchema>

export const accountantInvoiceAttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string().nullable(),
  fileSize: z.number().int().nullable(),
  hasFile: z.boolean(),
})

export const accountantInvoiceRecordSchema = z.object({
  id: z.string(),
  kind: z.enum(["client", "supplier"]),
  invoiceNumber: z.string(),
  status: z.string(),
  currency: z.string(),
  totalCents: z.number().int(),
  paidCents: z.number().int(),
  balanceDueCents: z.number().int(),
  issueDate: z.string(),
  dueDate: z.string().nullable(),
  attachments: z.array(accountantInvoiceAttachmentSchema),
})
export type AccountantInvoiceRecord = z.infer<typeof accountantInvoiceRecordSchema>

export const accountantSummarySchema = z.object({
  scope: accountantShareScopeSchema,
  departures: departureProfitabilityReportSchema,
  products: productProfitabilityReportSchema,
})
export type AccountantSummary = z.infer<typeof accountantSummarySchema>

// ---------- cost categories ----------

export const costCategoryRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
  archived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type CostCategoryRecord = z.infer<typeof costCategoryRecordSchema>
