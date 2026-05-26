import {
  buildInvoiceIssuedEvent,
  financeService,
  type Invoice,
  type InvoiceIssueRuntime,
} from "@voyantjs/finance"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  isSmartbillPdfPersistMetadataUpdateError,
  persistSmartbillInvoiceArtifact,
  recordSmartbillInvoiceArtifactFailure,
  retrySmartbillInvoiceArtifact,
  type SmartbillArtifactStorageContext,
  type SmartbillDocumentType,
  type SmartbillExternalRef,
} from "./artifacts.js"
import type { SmartbillClientApi } from "./client.js"
import type {
  SmartbillInvoiceNumberWriteBackFormatter,
  SmartbillMapFn,
  SmartbillPluginOptions,
} from "./plugin.js"
import { createSmartbillSyncRuntime, type SmartbillSyncRuntime } from "./runtime.js"
import type { SmartbillInvoiceBody, SmartbillInvoiceResponse, VoyantInvoiceEvent } from "./types.js"
import { parseSmartbillPluginOptions } from "./validation.js"

export interface SyncSmartbillInvoiceInput {
  db: PostgresJsDatabase
  invoiceId: string
  pluginOptions: SmartbillPluginOptions
  client?: SmartbillClientApi
  issueRuntime?: Omit<InvoiceIssueRuntime, "eventBus">
}

export interface SyncSmartbillInvoiceEventInput {
  event: VoyantInvoiceEvent
  documentType: SmartbillDocumentType
  runtime: SmartbillSyncRuntime
  pluginOptions: Pick<SmartbillPluginOptions, "companyVatCode" | "seriesName">
  operationLabel?: string
}

export interface SyncSmartbillProformaConversionInput {
  event: VoyantInvoiceEvent & {
    proformaId?: unknown
    proformaInvoiceNumber?: unknown
  }
  runtime: SmartbillSyncRuntime
  pluginOptions: Pick<SmartbillPluginOptions, "companyVatCode" | "seriesName">
}

export type SyncSmartbillInvoiceResult =
  | {
      status: "not_found"
      invoiceId: string
    }
  | {
      status: "unsupported_document_type"
      invoiceId: string
      invoiceType: string
    }
  | SyncSmartbillInvoiceEventResult

export type SyncSmartbillInvoiceEventResult =
  | {
      status: "existing_ref"
      invoiceId: string
      documentType: SmartbillDocumentType
      externalRef: SmartbillExternalRef
      artifact: Awaited<ReturnType<typeof retrySmartbillInvoiceArtifact>> | null
    }
  | {
      status: "created"
      invoiceId: string
      documentType: SmartbillDocumentType
      result: SmartbillInvoiceResponse
      artifact: Awaited<ReturnType<typeof persistSmartbillInvoiceArtifact>> | null
    }

export type SyncSmartbillProformaConversionResult = SyncSmartbillInvoiceEventResult

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

async function findProformaSmartbillRef(db: PostgresJsDatabase, proformaId: string) {
  const refs = await financeService.listInvoiceExternalRefs(db, proformaId)
  const ref = refs.find((candidate) => isMatchingSmartbillRef(candidate, "proforma"))
  if (!ref) return null

  const metadata = coerceMetadata(ref.metadata)
  const seriesName =
    metadataString(metadata, "series") ??
    metadataString(metadata, "seriesName") ??
    metadataString(metadata, "estimateSeriesName")
  const number = metadataString(metadata, "number") ?? ref.externalNumber ?? ref.externalId ?? null

  return seriesName && number ? { ref, seriesName, number } : null
}

async function findExistingSmartbillRef(
  event: VoyantInvoiceEvent,
  documentType: SmartbillDocumentType,
  body: SmartbillInvoiceBody,
  runtime: SmartbillSyncRuntime,
): Promise<SmartbillExternalRef | null> {
  if (runtime.idempotency.skipExistingExternalRef === false) return null
  const db = await resolveArtifactDb(event, documentType, body, undefined, runtime)
  if (!db) return null

  const refs = await financeService.listInvoiceExternalRefs(db, event.id)
  return refs.find((ref) => isMatchingSmartbillRef(ref, documentType)) ?? null
}

async function handleExistingSmartbillRef(
  event: VoyantInvoiceEvent,
  documentType: SmartbillDocumentType,
  body: SmartbillInvoiceBody,
  externalRef: SmartbillExternalRef,
  runtime: SmartbillSyncRuntime,
): Promise<SyncSmartbillInvoiceEventResult> {
  runtime.logger.info?.(
    `[smartbill] ${documentType} already has SmartBill ref for ${event.id}; skipping create`,
    externalRef,
  )
  await applyExternalAllocationFromRefIfRequired(event, documentType, body, externalRef, runtime)
  await writeBackInvoiceNumberFromRefIfRequired(event, documentType, body, externalRef, runtime)

  let artifact: Awaited<ReturnType<typeof retrySmartbillInvoiceArtifact>> | null = null
  try {
    artifact = await retrySmartbillInvoiceArtifact({
      runtime: runtime.artifacts,
      client: runtime.client,
      externalRef,
      documentType,
    })
    if (artifact.status === "persisted") {
      runtime.logger.info?.(`[smartbill] ${documentType} PDF re-attached for ${event.id}`, artifact)
    }
  } catch (err) {
    const message = isSmartbillPdfPersistMetadataUpdateError(err)
      ? `[smartbill] artifact re-attach metadata update failed for ${event.id}`
      : `[smartbill] artifact re-attach failed for ${event.id}`
    runtime.logger.error(message, err)
  }

  return { status: "existing_ref", invoiceId: event.id, documentType, externalRef, artifact }
}

async function persistArtifact(
  event: VoyantInvoiceEvent,
  documentType: SmartbillDocumentType,
  body: Awaited<ReturnType<SmartbillMapFn>>,
  result: Awaited<ReturnType<SmartbillClientApi["createInvoice"]>>,
  runtime: SmartbillSyncRuntime,
) {
  try {
    const persisted = await persistSmartbillInvoiceArtifact({
      runtime: runtime.artifacts,
      client: runtime.client,
      event,
      documentType,
      body,
      result,
    })
    if (persisted.status === "persisted") {
      runtime.logger.info?.(`[smartbill] ${documentType} PDF persisted for ${event.id}`, persisted)
    }
    return persisted
  } catch (err) {
    if (isSmartbillPdfPersistMetadataUpdateError(err)) {
      runtime.logger.error(
        `[smartbill] artifact persistence metadata update failed for ${event.id}`,
        err,
      )
      return null
    }
    runtime.logger.error(`[smartbill] artifact persistence failed for ${event.id}`, err)
    try {
      await recordSmartbillInvoiceArtifactFailure({
        runtime: runtime.artifacts,
        event,
        documentType,
        body,
        result,
        error: err,
      })
    } catch (recordError) {
      runtime.logger.error(
        `[smartbill] artifact failure external-ref update failed for ${event.id}`,
        recordError,
      )
    }
    return null
  }
}

async function applyExternalAllocationIfRequired(
  event: VoyantInvoiceEvent,
  documentType: SmartbillDocumentType,
  body: SmartbillInvoiceBody,
  result: SmartbillInvoiceResponse,
  runtime: SmartbillSyncRuntime,
) {
  if (event.externalAllocationRequired !== true || !result.number) return

  await applyExternalAllocationNumber(
    event,
    documentType,
    body,
    result,
    runtime,
    formatExternalInvoiceNumber(result.series ?? body.seriesName, result.number),
  )
}

async function applyExternalAllocationNumber(
  event: VoyantInvoiceEvent,
  documentType: SmartbillDocumentType,
  body: SmartbillInvoiceBody,
  result: SmartbillInvoiceResponse | undefined,
  runtime: SmartbillSyncRuntime,
  invoiceNumber: string,
) {
  const db = await resolveArtifactDb(event, documentType, body, result, runtime)
  if (!db) {
    throw new Error("SmartBill external allocation requires artifact database access")
  }
  const allocation = await financeService.applyExternalInvoiceAllocation(db, event.id, {
    invoiceNumber,
  })
  if (allocation.status === "applied") {
    runtime.logger.info?.(`[smartbill] external number applied for ${event.id}`, allocation.invoice)
  }
}

async function applyExternalAllocationFromRefIfRequired(
  event: VoyantInvoiceEvent,
  documentType: SmartbillDocumentType,
  body: SmartbillInvoiceBody,
  externalRef: SmartbillExternalRef,
  runtime: SmartbillSyncRuntime,
) {
  if (event.externalAllocationRequired !== true) return

  const metadata = coerceMetadata(externalRef.metadata)
  const number =
    metadataString(metadata, "number") ??
    externalRef.externalNumber ??
    externalRef.externalId ??
    null
  if (!number) {
    throw new Error("SmartBill external allocation requires an existing external number")
  }
  const refSeries = metadataString(metadata, "series") ?? metadataString(metadata, "seriesName")
  const refResult: SmartbillInvoiceResponse = {
    number,
    series: refSeries ?? undefined,
    url: externalRef.externalUrl ?? undefined,
  }
  await applyExternalAllocationNumber(
    event,
    documentType,
    body,
    refResult,
    runtime,
    formatExternalInvoiceNumber(refSeries ?? undefined, number),
  )
}

async function resolveWriteBackInvoiceNumber(
  event: VoyantInvoiceEvent,
  body: SmartbillInvoiceBody,
  result: SmartbillInvoiceResponse,
  writeBackInvoiceNumber: boolean | SmartbillInvoiceNumberWriteBackFormatter | undefined,
  options: { useBodySeriesFallback?: boolean } = {},
) {
  if (!writeBackInvoiceNumber) return null
  if (typeof writeBackInvoiceNumber === "function") {
    const invoiceNumber = await writeBackInvoiceNumber(event, result)
    if (typeof invoiceNumber !== "string" || invoiceNumber.trim().length === 0) {
      throw new Error("SmartBill invoice number write-back formatter returned an empty value")
    }
    return invoiceNumber
  }
  if (!result.number) return null
  const series =
    result.series ?? (options.useBodySeriesFallback === false ? undefined : body.seriesName)
  return formatExternalInvoiceNumber(series, result.number)
}

async function writeBackInvoiceNumberIfRequired(
  event: VoyantInvoiceEvent,
  documentType: SmartbillDocumentType,
  body: SmartbillInvoiceBody,
  result: SmartbillInvoiceResponse,
  runtime: SmartbillSyncRuntime,
) {
  const invoiceNumber = await resolveWriteBackInvoiceNumber(
    event,
    body,
    result,
    runtime.writeBackInvoiceNumber,
  )
  if (!invoiceNumber) return

  await writeBackResolvedInvoiceNumber(event, documentType, body, result, runtime, invoiceNumber)
}

async function writeBackResolvedInvoiceNumber(
  event: VoyantInvoiceEvent,
  documentType: SmartbillDocumentType,
  body: SmartbillInvoiceBody,
  result: SmartbillInvoiceResponse | undefined,
  runtime: SmartbillSyncRuntime,
  invoiceNumber: string,
) {
  const db = await resolveArtifactDb(event, documentType, body, result, runtime)
  if (!db) {
    throw new Error("SmartBill invoice number write-back requires artifact database access")
  }

  const invoice = await financeService.updateInvoice(db, event.id, { invoiceNumber })
  if (!invoice) {
    throw new Error(`SmartBill invoice number write-back failed for missing invoice ${event.id}`)
  }
  runtime.logger.info?.(`[smartbill] invoice number write-back applied for ${event.id}`, invoice)
}

async function writeBackInvoiceNumberFromRefIfRequired(
  event: VoyantInvoiceEvent,
  documentType: SmartbillDocumentType,
  body: SmartbillInvoiceBody,
  externalRef: SmartbillExternalRef,
  runtime: SmartbillSyncRuntime,
) {
  if (!runtime.writeBackInvoiceNumber) return

  const metadata = coerceMetadata(externalRef.metadata)
  const number =
    metadataString(metadata, "number") ??
    externalRef.externalNumber ??
    externalRef.externalId ??
    null
  if (!number) return

  const refSeries = metadataString(metadata, "series") ?? metadataString(metadata, "seriesName")
  const refResult: SmartbillInvoiceResponse = {
    number,
    series: refSeries ?? undefined,
    url: externalRef.externalUrl ?? undefined,
  }
  const invoiceNumber = await resolveWriteBackInvoiceNumber(
    event,
    body,
    refResult,
    runtime.writeBackInvoiceNumber,
    { useBodySeriesFallback: false },
  )
  if (!invoiceNumber) return

  await writeBackResolvedInvoiceNumber(event, documentType, body, refResult, runtime, invoiceNumber)
}

async function recordSyncError(
  event: VoyantInvoiceEvent,
  documentType: SmartbillDocumentType,
  err: unknown,
  runtime: SmartbillSyncRuntime,
  pluginOptions: Pick<SmartbillPluginOptions, "companyVatCode" | "seriesName">,
) {
  try {
    await runtime.onError?.(event, err)
  } catch (handlerError) {
    runtime.logger.error(`[smartbill] onError handler failed for ${event.id}`, handlerError)
  }

  try {
    const db = await resolveArtifactDb(
      event,
      documentType,
      undefined,
      undefined,
      runtime,
      pluginOptions,
    )
    if (!db) return
    const refs = await financeService.listInvoiceExternalRefs(db, event.id)
    const matchingRef = refs.find((ref) => isMatchingSmartbillRef(ref, documentType))
    if (matchingRef) {
      await financeService.registerInvoiceExternalRef(db, event.id, {
        provider: "smartbill",
        externalId: matchingRef.externalId ?? null,
        externalNumber: matchingRef.externalNumber ?? null,
        externalUrl: matchingRef.externalUrl ?? null,
        status: matchingRef.status ?? "error",
        syncedAt: new Date().toISOString(),
        syncError: errorMessage(err),
        metadata: {
          ...(coerceMetadata(matchingRef.metadata) ?? {}),
          documentType,
        },
      })
      return
    }

    await financeService.registerInvoiceExternalRef(db, event.id, {
      provider: "smartbill",
      externalId: null,
      externalNumber: null,
      externalUrl: null,
      status: "error",
      syncedAt: new Date().toISOString(),
      syncError: errorMessage(err),
      metadata: { documentType },
    })
  } catch (recordError) {
    runtime.logger.error(
      `[smartbill] error external-ref recording failed for ${event.id}`,
      recordError,
    )
  }
}

async function resolveArtifactDb(
  event: VoyantInvoiceEvent,
  documentType: SmartbillDocumentType,
  body: SmartbillInvoiceBody | undefined,
  result: SmartbillInvoiceResponse | undefined,
  runtime: SmartbillSyncRuntime,
  pluginOptions?: Pick<SmartbillPluginOptions, "companyVatCode" | "seriesName">,
) {
  if (!runtime.artifacts.db) return null
  const context: SmartbillArtifactStorageContext = {
    event,
    documentType,
    body: body ?? {
      companyVatCode: pluginOptions?.companyVatCode ?? "",
      client: { name: "Client" },
      seriesName: await resolveSeriesName(pluginOptions?.seriesName, event),
      currency: "RON",
      products: [],
    },
    result: result ?? {},
  }
  return (await resolveMaybe(runtime.artifacts.db, context)) ?? null
}

function withDefaultArtifactDb(
  pluginOptions: SmartbillPluginOptions,
  db: PostgresJsDatabase,
): SmartbillPluginOptions {
  if (pluginOptions.artifacts?.db || pluginOptions.db) return pluginOptions
  return {
    ...pluginOptions,
    artifacts: {
      ...pluginOptions.artifacts,
      db,
    },
  }
}

function documentTypeForInvoice(invoice: Invoice): SmartbillDocumentType | null {
  if (invoice.invoiceType === "proforma") return "proforma"
  if (invoice.invoiceType === "invoice") return "invoice"
  return null
}

async function resolveSeriesName(
  seriesName: SmartbillPluginOptions["seriesName"] | undefined,
  event: VoyantInvoiceEvent,
) {
  if (typeof seriesName === "function") return seriesName(event)
  return seriesName ?? "unknown"
}

async function resolveMaybe<TContext, TValue>(
  value: TValue | ((context: TContext) => TValue | Promise<TValue>) | undefined | null,
  context: TContext,
) {
  return typeof value === "function"
    ? await (value as (context: TContext) => TValue | Promise<TValue>)(context)
    : value
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    const maybeCode = (error as Error & { code?: unknown }).code
    const code = typeof maybeCode === "string" ? maybeCode : null
    return code ? `${code}: ${error.message}` : error.message
  }
  return String(error)
}

function coerceMetadata(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function metadataString(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

function formatExternalInvoiceNumber(seriesName: string | undefined, number: string) {
  const trimmedNumber = number.trim()
  const trimmedSeries = seriesName?.trim()
  if (!trimmedSeries || trimmedNumber.startsWith(`${trimmedSeries}-`)) return trimmedNumber
  return `${trimmedSeries}-${trimmedNumber}`
}

function isUsableSmartbillRef(ref: {
  provider: string
  status?: string | null
  syncError?: string | null
  externalNumber?: string | null
  externalId?: string | null
}) {
  return (
    ref.provider === "smartbill" &&
    ref.status !== "error" &&
    Boolean(ref.externalNumber || ref.externalId)
  )
}

function isMatchingSmartbillRef(
  ref: {
    provider: string
    status?: string | null
    syncError?: string | null
    externalNumber?: string | null
    externalId?: string | null
    metadata?: unknown
  },
  documentType: SmartbillDocumentType,
) {
  if (!isUsableSmartbillRef(ref)) return false
  const metadataDocumentType = metadataString(coerceMetadata(ref.metadata), "documentType")
  return !metadataDocumentType || metadataDocumentType === documentType
}
