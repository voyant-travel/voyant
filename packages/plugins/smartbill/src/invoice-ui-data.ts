import { z } from "zod"

export const smartbillInvoiceExternalRefSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  provider: z.string(),
  externalId: z.string().nullable(),
  externalNumber: z.string().nullable(),
  externalUrl: z.string().nullable(),
  status: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  syncedAt: z.union([z.string(), z.date()]).nullable(),
  syncError: z.string().nullable(),
  createdAt: z.union([z.string(), z.date()]).nullable(),
  updatedAt: z.union([z.string(), z.date()]).nullable(),
})

export const smartbillInvoiceExternalRefsResponseSchema = z.object({
  data: z.array(smartbillInvoiceExternalRefSchema),
})

export type SmartbillInvoiceExternalRef = z.infer<typeof smartbillInvoiceExternalRefSchema>

export interface SmartbillInvoiceReferenceParts {
  companyVatCode: string | null
  seriesName: string | null
  number: string | null
  documentType: "invoice" | "proforma" | string | null
}

export interface SmartbillInvoiceDocumentLink {
  label: string
  href: string
}

export function selectSmartbillInvoiceRef(
  refs: ReadonlyArray<SmartbillInvoiceExternalRef>,
): SmartbillInvoiceExternalRef | null {
  return refs.find((ref) => ref.provider === "smartbill") ?? null
}

export function resolveSmartbillInvoiceReferenceParts(
  ref: SmartbillInvoiceExternalRef | null | undefined,
): SmartbillInvoiceReferenceParts {
  const metadata = coerceMetadata(ref?.metadata)
  return {
    companyVatCode: readMetadataString(metadata, "companyVatCode", "vatCode"),
    seriesName: readMetadataString(metadata, "seriesName", "series"),
    number:
      readMetadataString(metadata, "number", "invoiceNumber") ??
      ref?.externalNumber ??
      ref?.externalId ??
      null,
    documentType: readMetadataString(metadata, "documentType"),
  }
}

export function getSmartbillInvoiceDocumentLinks(
  ref: SmartbillInvoiceExternalRef | null | undefined,
): SmartbillInvoiceDocumentLink[] {
  const metadata = coerceMetadata(ref?.metadata)
  const candidates = [
    { label: "SmartBill document", href: ref?.externalUrl },
    { label: "SmartBill PDF", href: readMetadataString(metadata, "pdfUrl", "downloadUrl") },
    { label: "SmartBill invoice", href: readMetadataString(metadata, "invoiceUrl", "documentUrl") },
  ]
  const seen = new Set<string>()
  return candidates.flatMap((candidate) => {
    const href = candidate.href?.trim()
    if (!href || seen.has(href)) return []
    seen.add(href)
    return [{ label: candidate.label, href }]
  })
}

function coerceMetadata(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readMetadataString(metadata: Record<string, unknown> | null, ...keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}
