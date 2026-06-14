import { type InvoiceExternalRef, invoiceExternalRefs, invoices } from "@voyant-travel/finance"
import { desc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  loadSmartbillCandidateRefs,
  type SmartbillCandidateExternalRefRecorder,
  type SmartbillCandidateInvoice,
  type SmartbillWorkflowCandidateSource,
} from "../workflow-candidates.js"
import type { SmartbillWorkflowExternalRef, SmartbillWorkflowInvoice } from "./types.js"

export async function loadSmartbillWorkflowRefs(options: {
  db?: PostgresJsDatabase
  limit?: number
  companyVatCode?: string
  source?: SmartbillWorkflowCandidateSource
  listExternalRefs?: () => Promise<SmartbillWorkflowExternalRef[]>
  listCandidateInvoices?: () => Promise<SmartbillCandidateInvoice[]>
  recordCandidateExternalRef?: SmartbillCandidateExternalRefRecorder
}) {
  if (options.listCandidateInvoices || options.source === "invoices") {
    return loadSmartbillCandidateRefs(options)
  }
  return loadSmartbillExternalRefs(options)
}

async function loadSmartbillExternalRefs(options: {
  db?: PostgresJsDatabase
  limit?: number
  listExternalRefs?: () => Promise<SmartbillWorkflowExternalRef[]>
}) {
  if (options.listExternalRefs) return options.listExternalRefs()
  if (!options.db) throw new Error("SmartBill workflow requires db or listExternalRefs")

  const rows = await options.db
    .select({
      ref: invoiceExternalRefs,
      invoice: {
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        invoiceType: invoices.invoiceType,
        status: invoices.status,
        currency: invoices.currency,
        totalCents: invoices.totalCents,
        paidCents: invoices.paidCents,
        balanceDueCents: invoices.balanceDueCents,
      },
    })
    .from(invoiceExternalRefs)
    .leftJoin(invoices, eq(invoiceExternalRefs.invoiceId, invoices.id))
    .where(eq(invoiceExternalRefs.provider, "smartbill"))
    .orderBy(desc(invoiceExternalRefs.createdAt))
    .limit(options.limit ?? 500)

  return rows.map((row) => toWorkflowExternalRef(row.ref, row.invoice))
}

function toWorkflowExternalRef(
  ref: InvoiceExternalRef,
  invoice: SmartbillWorkflowInvoice | null,
): SmartbillWorkflowExternalRef {
  return {
    id: ref.id,
    invoiceId: ref.invoiceId,
    provider: ref.provider,
    externalId: ref.externalId,
    externalNumber: ref.externalNumber,
    externalUrl: ref.externalUrl,
    status: ref.status,
    metadata: ref.metadata,
    syncError: ref.syncError,
    createdAt: ref.createdAt,
    updatedAt: ref.updatedAt,
    invoice,
  }
}
