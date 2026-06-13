import type { SmartbillDocumentType } from "../artifacts.js"
import type { SmartbillPluginOptions } from "../plugin.js"
import type { SmartbillSyncRuntime } from "../runtime.js"
import type { VoyantInvoiceEvent } from "../types.js"
import {
  applyExternalAllocationIfRequired,
  findExistingSmartbillRef,
  findProformaSmartbillRef,
  findSmartbillRefForCancellation,
  handleExistingSmartbillRef,
  persistArtifact,
  recordSmartbillCancellation,
  recordSyncError,
  resolveArtifactDb,
  resolveSmartbillCancellationTarget,
  writeBackInvoiceNumberIfRequired,
} from "./helpers.js"
import type {
  SyncSmartbillInvoiceEventInput,
  SyncSmartbillInvoiceEventResult,
  SyncSmartbillInvoiceVoidEventInput,
  SyncSmartbillInvoiceVoidEventResult,
  SyncSmartbillProformaConversionInput,
  SyncSmartbillProformaConversionResult,
} from "./types.js"

export async function syncSmartbillInvoiceEvent({
  event,
  documentType,
  runtime,
  pluginOptions,
  operationLabel = documentType === "proforma" ? "createProforma" : "createInvoice",
}: SyncSmartbillInvoiceEventInput): Promise<SyncSmartbillInvoiceEventResult> {
  try {
    const body = await runtime.mapEvent(event)
    const existingRef = await findExistingSmartbillRef(event, documentType, body, runtime)
    if (existingRef) {
      return handleExistingSmartbillRef(event, documentType, body, existingRef, runtime)
    }

    const result =
      documentType === "proforma"
        ? await runtime.client.createProforma(body)
        : await runtime.client.createInvoice(body)
    runtime.logger.info?.(
      `[smartbill] ${documentType} created: ${result.series}-${result.number} for ${event.id}`,
      result,
    )
    const artifact = await persistArtifact(event, documentType, body, result, runtime)
    await writeBackInvoiceNumberIfRequired(event, documentType, body, result, runtime)
    await applyExternalAllocationIfRequired(event, documentType, body, result, runtime)
    return { status: "created", invoiceId: event.id, documentType, result, artifact }
  } catch (err) {
    runtime.logger.error(`[smartbill] ${operationLabel} failed for ${event.id}`, err)
    await recordSyncError(event, documentType, err, runtime, pluginOptions)
    throw err
  }
}

export async function syncSmartbillProformaConversion({
  event,
  runtime,
  pluginOptions,
}: SyncSmartbillProformaConversionInput): Promise<SyncSmartbillProformaConversionResult> {
  const proformaId = typeof event.proformaId === "string" ? event.proformaId : null
  const body = await runtime.mapEvent(event)
  const existingRef = await findExistingSmartbillRef(event, "invoice", body, runtime)
  if (existingRef) {
    return handleExistingSmartbillRef(event, "invoice", body, existingRef, runtime)
  }

  if (!proformaId) {
    return fallbackToSmartbillInvoiceCreate(event, runtime, pluginOptions, "missing proforma id")
  }

  const db = await resolveArtifactDb(event, "invoice", body, undefined, runtime, pluginOptions)
  if (!db) {
    return fallbackToSmartbillInvoiceCreate(
      event,
      runtime,
      pluginOptions,
      "missing artifact database",
    )
  }

  const proformaRef = await findProformaSmartbillRef(db, proformaId)
  if (!proformaRef) {
    return fallbackToSmartbillInvoiceCreate(
      event,
      runtime,
      pluginOptions,
      `missing SmartBill proforma reference for ${proformaId}`,
    )
  }

  try {
    const result = await runtime.client.convertEstimateToInvoice(
      body.companyVatCode,
      proformaRef.seriesName,
      proformaRef.number,
      body,
    )
    runtime.logger.info?.(
      `[smartbill] proforma converted: ${proformaRef.seriesName}-${proformaRef.number} -> ${result.series}-${result.number} for ${event.id}`,
      result,
    )
    const artifact = await persistArtifact(event, "invoice", body, result, runtime)
    await writeBackInvoiceNumberIfRequired(event, "invoice", body, result, runtime)
    await applyExternalAllocationIfRequired(event, "invoice", body, result, runtime)
    return { status: "created", invoiceId: event.id, documentType: "invoice", result, artifact }
  } catch (err) {
    runtime.logger.error(`[smartbill] convertEstimateToInvoice failed for ${event.id}`, err)
    await recordSyncError(event, "invoice", err, runtime, pluginOptions)
    throw err
  }
}

export async function syncSmartbillInvoiceVoidEvent({
  event,
  runtime,
  pluginOptions,
}: SyncSmartbillInvoiceVoidEventInput): Promise<SyncSmartbillInvoiceVoidEventResult> {
  const documentType: SmartbillDocumentType = "invoice"
  const db = await resolveArtifactDb(
    event,
    documentType,
    undefined,
    undefined,
    runtime,
    pluginOptions,
  )
  const externalRef = db ? await findSmartbillRefForCancellation(db, event.id) : null

  if (externalRef?.status === "cancelled") {
    runtime.logger.info?.(`[smartbill] invoice already cancelled for ${event.id}`, externalRef)
    return { status: "already_cancelled", invoiceId: event.id, externalRef }
  }

  const target = await resolveSmartbillCancellationTarget(event, externalRef, pluginOptions)
  if (!target) {
    runtime.logger.error(`[smartbill] cannot cancel invoice ${event.id}: missing external number`)
    return { status: "missing_number", invoiceId: event.id }
  }

  try {
    const result = await runtime.client.cancelInvoice(
      pluginOptions.companyVatCode,
      target.seriesName,
      target.number,
    )
    runtime.logger.info?.(
      `[smartbill] invoice cancelled: ${target.seriesName}-${target.number} for ${event.id}`,
      result,
    )
    await recordSmartbillCancellation(event, target, result, externalRef, runtime, pluginOptions)
    return {
      status: "cancelled",
      invoiceId: event.id,
      seriesName: target.seriesName,
      number: target.number,
      externalRef,
    }
  } catch (err) {
    runtime.logger.error(`[smartbill] cancelInvoice failed for ${event.id}`, err)
    await recordSyncError(event, documentType, err, runtime, pluginOptions)
    throw err
  }
}

function fallbackToSmartbillInvoiceCreate(
  event: VoyantInvoiceEvent,
  runtime: SmartbillSyncRuntime,
  pluginOptions: Pick<SmartbillPluginOptions, "companyVatCode" | "seriesName">,
  reason: string,
): Promise<SyncSmartbillInvoiceEventResult> {
  runtime.logger.info?.(
    `[smartbill] cannot convert proforma for ${event.id}: ${reason}; falling back to createInvoice`,
  )
  return syncSmartbillInvoiceEvent({
    event,
    documentType: "invoice",
    runtime,
    pluginOptions,
    operationLabel: `createInvoice fallback after proforma conversion (${reason})`,
  })
}
