import { buildInvoiceIssuedEvent, financeService } from "@voyant-travel/finance"

import { createSmartbillSyncRuntime } from "../runtime.js"
import type { VoyantInvoiceEvent } from "../types.js"
import { parseSmartbillPluginOptions } from "../validation.js"
import { syncSmartbillInvoiceEvent } from "./events.js"
import { documentTypeForInvoice, withDefaultArtifactDb } from "./helpers.js"
import type { SyncSmartbillInvoiceInput, SyncSmartbillInvoiceResult } from "./types.js"

export async function syncSmartbillInvoice({
  db,
  invoiceId,
  pluginOptions,
  client,
  issueRuntime,
}: SyncSmartbillInvoiceInput): Promise<SyncSmartbillInvoiceResult> {
  const invoice = await financeService.getInvoiceById(db, invoiceId)
  if (!invoice) return { status: "not_found", invoiceId }

  const documentType = documentTypeForInvoice(invoice)
  if (!documentType) {
    return { status: "unsupported_document_type", invoiceId, invoiceType: invoice.invoiceType }
  }

  const validatedOptions = parseSmartbillPluginOptions(withDefaultArtifactDb(pluginOptions, db))
  const runtime = createSmartbillSyncRuntime(validatedOptions, client ? { client } : undefined)
  const issuedEvent = await buildInvoiceIssuedEvent(db, invoice, issueRuntime)
  const event: VoyantInvoiceEvent = { ...issuedEvent, id: issuedEvent.invoiceId }

  return syncSmartbillInvoiceEvent({
    event,
    documentType,
    runtime,
    pluginOptions: validatedOptions,
    operationLabel: documentType === "proforma" ? "createProforma" : "createInvoice",
  })
}
