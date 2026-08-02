import type { Invoice } from "@voyant-travel/finance"
import { financeService } from "@voyant-travel/finance"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  isSmartbillPdfPersistMetadataUpdateError,
  persistSmartbillInvoiceArtifact,
  recordSmartbillInvoiceArtifactFailure,
  retrySmartbillInvoiceArtifact,
  type SmartbillArtifactStorageContext,
  type SmartbillDocumentType,
  type SmartbillExternalRef,
} from "../artifacts.js"
import type { SmartbillClientApi } from "../client.js"
import type {
  SmartbillInvoiceNumberWriteBackFormatter,
  SmartbillMapFn,
  SmartbillPluginOptions,
} from "../plugin.js"
import type { SmartbillSyncRuntime } from "../runtime.js"
import type {
  SmartbillInvoiceBody,
  SmartbillInvoiceResponse,
  VoyantInvoiceEvent,
} from "../types.js"
import type { SyncSmartbillInvoiceEventResult } from "./types.js"

export async function findProformaSmartbillRef(db: PostgresJsDatabase, proformaId: string) {
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

export async function findExistingSmartbillRef(
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

export async function findSmartbillRefForCancellation(db: PostgresJsDatabase, invoiceId: string) {
  const refs = await financeService.listInvoiceExternalRefs(db, invoiceId)
  return (
    refs.find((ref) => {
      if (ref.provider !== "smartbill") return false
      const metadataDocumentType = metadataString(coerceMetadata(ref.metadata), "documentType")
      return !metadataDocumentType || metadataDocumentType === "invoice"
    }) ??
    refs.find((ref) => ref.provider === "smartbill") ??
    null
  )
}

export async function resolveSmartbillCancellationTarget(
  event: VoyantInvoiceEvent,
  externalRef: Awaited<ReturnType<typeof findSmartbillRefForCancellation>>,
  pluginOptions: Pick<SmartbillPluginOptions, "seriesName">,
) {
  const metadata = coerceMetadata(externalRef?.metadata)
  const number =
    eventString(event, "externalNumber") ??
    externalRef?.externalNumber ??
    externalRef?.externalId ??
    metadataString(metadata, "number") ??
    event.invoiceNumber
  if (!number) return null

  const seriesName =
    eventString(event, "externalSeriesName") ??
    metadataString(metadata, "seriesName") ??
    metadataString(metadata, "series") ??
    (await resolveSeriesName(pluginOptions.seriesName, event))

  return { seriesName, number }
}

export async function recordSmartbillCancellation(
  event: VoyantInvoiceEvent,
  target: { seriesName: string; number: string },
  result: Awaited<ReturnType<SmartbillClientApi["cancelInvoice"]>>,
  externalRef: Awaited<ReturnType<typeof findSmartbillRefForCancellation>>,
  runtime: SmartbillSyncRuntime,
  pluginOptions: Pick<SmartbillPluginOptions, "companyVatCode" | "seriesName">,
) {
  const db = await resolveArtifactDb(event, "invoice", undefined, undefined, runtime, pluginOptions)
  if (!db) return

  const metadata = coerceMetadata(externalRef?.metadata)
  await financeService.registerInvoiceExternalRef(db, event.id, {
    provider: "smartbill",
    externalId: externalRef?.externalId ?? target.number,
    externalNumber: externalRef?.externalNumber ?? target.number,
    externalUrl: externalRef?.externalUrl ?? null,
    status: "cancelled",
    syncedAt: new Date().toISOString(),
    syncError: null,
    metadata: {
      ...(metadata ?? {}),
      companyVatCode: pluginOptions.companyVatCode,
      seriesName: target.seriesName,
      series: target.seriesName,
      number: target.number,
      documentType: "invoice",
      cancelledAt: new Date().toISOString(),
      cancelStatus: result.status ?? null,
      cancelMessage: result.message ?? null,
    },
  })
}

export async function handleExistingSmartbillRef(
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

export async function persistArtifact(
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

export async function applyExternalAllocationIfRequired(
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

export async function writeBackInvoiceNumberIfRequired(
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

export async function recordSyncError(
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

export async function resolveArtifactDb(
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

export function withDefaultArtifactDb(
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

export function documentTypeForInvoice(invoice: Invoice): SmartbillDocumentType | null {
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

function eventString(event: VoyantInvoiceEvent, key: string) {
  const value = event[key]
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

export function isMatchingSmartbillRef(
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
