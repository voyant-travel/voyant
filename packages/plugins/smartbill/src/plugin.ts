import type { Plugin, Subscriber } from "@voyantjs/core"
import { financeService } from "@voyantjs/finance"
import { ZodError } from "zod"

import {
  isSmartbillPdfPersistMetadataUpdateError,
  persistSmartbillInvoiceArtifact,
  recordSmartbillInvoiceArtifactFailure,
  retrySmartbillInvoiceArtifact,
  type SmartbillArtifactPersistenceOptions,
  type SmartbillArtifactStorageContext,
  type SmartbillDocumentType,
  type SmartbillExternalRef,
} from "./artifacts.js"
import type { SmartbillClientOptions } from "./client.js"
import type { SmartbillMappingOptions } from "./mapping.js"
import { createSmartbillSyncRuntime } from "./runtime.js"
import type { SmartbillInvoiceBody, SmartbillInvoiceResponse, VoyantInvoiceEvent } from "./types.js"
import { smartbillPluginOptionsSchema } from "./validation.js"

export interface SmartbillSyncEventNames {
  issued?: string
  proformaIssued?: string
  voided?: string
  syncRequested?: string
}

export interface SmartbillLogger {
  error: (message: string, meta?: unknown) => void
  info?: (message: string, meta?: unknown) => void
}

export type SmartbillMapFn = (
  event: VoyantInvoiceEvent,
) => SmartbillInvoiceBody | Promise<SmartbillInvoiceBody>

export interface SmartbillIdempotencyOptions {
  /**
   * When artifact DB access is configured, skip SmartBill create calls for
   * duplicate invoice events that already have a non-error SmartBill ref.
   * Defaults to true.
   */
  skipExistingExternalRef?: boolean
}

export type SmartbillErrorHandler = (
  event: VoyantInvoiceEvent,
  error: unknown,
) => void | Promise<void>

export interface SmartbillPluginOptions extends SmartbillClientOptions, SmartbillMappingOptions {
  events?: SmartbillSyncEventNames
  mapEvent?: SmartbillMapFn
  logger?: SmartbillLogger
  idempotency?: SmartbillIdempotencyOptions
  onError?: SmartbillErrorHandler
  /**
   * Optional finance artifact persistence. When `db` is supplied, the plugin
   * registers the SmartBill external ref after creation. When
   * `documentStorage` is also supplied, it downloads and stores the generated
   * SmartBill PDF as both an invoice rendition and attachment.
   */
  artifacts?: SmartbillArtifactPersistenceOptions
  /** @deprecated Use `artifacts.db`. */
  db?: SmartbillArtifactPersistenceOptions["db"]
  /** @deprecated Use `artifacts.documentStorage`. */
  documentStorage?: SmartbillArtifactPersistenceOptions["documentStorage"]
  /** @deprecated Use `artifacts.documentStorageKeyPrefix`. */
  documentStorageKeyPrefix?: SmartbillArtifactPersistenceOptions["documentStorageKeyPrefix"]
}

function coerceEvent(data: unknown): VoyantInvoiceEvent | null {
  if (data == null || typeof data !== "object") return null
  const maybe = data as Record<string, unknown>
  if (typeof maybe.id === "string") return maybe as VoyantInvoiceEvent
  if (typeof maybe.invoiceId === "string") {
    return { ...maybe, id: maybe.invoiceId } as VoyantInvoiceEvent
  }
  return null
}

export function smartbillPlugin(options: SmartbillPluginOptions): Plugin {
  const validatedOptions = parseSmartbillPluginOptions(options)
  const { client, logger, mapEvent, eventNames, artifacts, idempotency, onError } =
    createSmartbillSyncRuntime(validatedOptions)

  async function resolveMaybe<TContext, TValue>(
    value: TValue | ((context: TContext) => TValue | Promise<TValue>) | undefined | null,
    context: TContext,
  ) {
    return typeof value === "function"
      ? await (value as (context: TContext) => TValue | Promise<TValue>)(context)
      : value
  }

  async function resolveArtifactDb(
    event: VoyantInvoiceEvent,
    documentType: SmartbillDocumentType,
    body?: SmartbillInvoiceBody,
    result?: SmartbillInvoiceResponse,
  ) {
    if (!artifacts.db) return null
    const context: SmartbillArtifactStorageContext = {
      event,
      documentType,
      body: body ?? {
        companyVatCode: validatedOptions.companyVatCode,
        client: { name: "Client" },
        seriesName: "unknown",
        currency: "RON",
        products: [],
      },
      result: result ?? {},
    }
    return (await resolveMaybe(artifacts.db, context)) ?? null
  }

  async function findExistingSmartbillRef(
    event: VoyantInvoiceEvent,
    documentType: SmartbillDocumentType,
    body: SmartbillInvoiceBody,
  ): Promise<SmartbillExternalRef | null> {
    if (idempotency.skipExistingExternalRef === false) return null
    const db = await resolveArtifactDb(event, documentType, body)
    if (!db) return null

    const refs = await financeService.listInvoiceExternalRefs(db, event.id)
    return refs.find((ref) => isUsableSmartbillRef(ref)) ?? null
  }

  async function handleExistingSmartbillRef(
    event: VoyantInvoiceEvent,
    documentType: SmartbillDocumentType,
    body: SmartbillInvoiceBody,
    externalRef: SmartbillExternalRef,
  ) {
    logger.info?.(
      `[smartbill] ${documentType} already has SmartBill ref for ${event.id}; skipping create`,
      externalRef,
    )
    await applyExternalAllocationFromRefIfRequired(event, documentType, body, externalRef)
    try {
      const persisted = await retrySmartbillInvoiceArtifact({
        runtime: artifacts,
        client,
        externalRef,
        documentType,
      })
      if (persisted.status === "persisted") {
        logger.info?.(`[smartbill] ${documentType} PDF re-attached for ${event.id}`, persisted)
      }
    } catch (err) {
      const message = isSmartbillPdfPersistMetadataUpdateError(err)
        ? `[smartbill] artifact re-attach metadata update failed for ${event.id}`
        : `[smartbill] artifact re-attach failed for ${event.id}`
      logger.error(message, err)
    }
  }

  async function persistArtifact(
    event: VoyantInvoiceEvent,
    documentType: SmartbillDocumentType,
    body: Awaited<ReturnType<SmartbillMapFn>>,
    result: Awaited<ReturnType<typeof client.createInvoice>>,
  ) {
    try {
      const persisted = await persistSmartbillInvoiceArtifact({
        runtime: artifacts,
        client,
        event,
        documentType,
        body,
        result,
      })
      if (persisted.status === "persisted") {
        logger.info?.(`[smartbill] ${documentType} PDF persisted for ${event.id}`, persisted)
      }
    } catch (err) {
      if (isSmartbillPdfPersistMetadataUpdateError(err)) {
        logger.error(`[smartbill] artifact persistence metadata update failed for ${event.id}`, err)
        return
      }
      logger.error(`[smartbill] artifact persistence failed for ${event.id}`, err)
      try {
        await recordSmartbillInvoiceArtifactFailure({
          runtime: artifacts,
          event,
          documentType,
          body,
          result,
          error: err,
        })
      } catch (recordError) {
        logger.error(
          `[smartbill] artifact failure external-ref update failed for ${event.id}`,
          recordError,
        )
      }
    }
  }

  async function applyExternalAllocationIfRequired(
    event: VoyantInvoiceEvent,
    documentType: SmartbillDocumentType,
    body: SmartbillInvoiceBody,
    result: SmartbillInvoiceResponse,
  ) {
    if (event.externalAllocationRequired !== true || !result.number) return

    const db = await resolveArtifactDb(event, documentType, body, result)
    if (!db) {
      throw new Error("SmartBill external allocation requires artifact database access")
    }
    const allocation = await financeService.applyExternalInvoiceAllocation(db, event.id, {
      invoiceNumber: formatExternalInvoiceNumber(result.series ?? body.seriesName, result.number),
    })
    if (allocation.status === "applied") {
      logger.info?.(`[smartbill] external number applied for ${event.id}`, allocation.invoice)
    }
  }

  async function applyExternalAllocationFromRefIfRequired(
    event: VoyantInvoiceEvent,
    documentType: SmartbillDocumentType,
    body: SmartbillInvoiceBody,
    externalRef: SmartbillExternalRef,
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
    await applyExternalAllocationIfRequired(event, documentType, body, {
      number,
      series:
        metadataString(metadata, "series") ??
        metadataString(metadata, "seriesName") ??
        body.seriesName,
      url: externalRef.externalUrl ?? undefined,
    })
  }

  async function recordSyncError(
    event: VoyantInvoiceEvent,
    documentType: SmartbillDocumentType,
    err: unknown,
  ) {
    try {
      await onError?.(event, err)
    } catch (handlerError) {
      logger.error(`[smartbill] onError handler failed for ${event.id}`, handlerError)
    }

    try {
      const db = await resolveArtifactDb(event, documentType)
      if (!db) return
      const refs = await financeService.listInvoiceExternalRefs(db, event.id)
      if (refs.some((ref) => isUsableSmartbillRef(ref))) return

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
      logger.error(`[smartbill] error external-ref recording failed for ${event.id}`, recordError)
    }
  }

  async function resolveConfiguredSeriesName(event: VoyantInvoiceEvent) {
    const value = validatedOptions.seriesName
    return typeof value === "function" ? await value(event) : value
  }

  async function resolveExternalSeriesName(event: VoyantInvoiceEvent) {
    return typeof event.externalSeriesName === "string"
      ? event.externalSeriesName
      : await resolveConfiguredSeriesName(event)
  }

  const subscribers: Subscriber[] = [
    {
      event: eventNames.issued,
      handler: async (envelope) => {
        const event = coerceEvent(envelope.data)
        if (!event) return
        try {
          const body = await mapEvent(event)
          const existingRef = await findExistingSmartbillRef(event, "invoice", body)
          if (existingRef) {
            await handleExistingSmartbillRef(event, "invoice", body, existingRef)
            return
          }
          const result = await client.createInvoice(body)
          logger.info?.(
            `[smartbill] invoice created: ${result.series}-${result.number} for ${event.id}`,
            result,
          )
          await persistArtifact(event, "invoice", body, result)
          await applyExternalAllocationIfRequired(event, "invoice", body, result)
        } catch (err) {
          logger.error(
            `[smartbill] createInvoice on "${eventNames.issued}" failed for ${event.id}`,
            err,
          )
          await recordSyncError(event, "invoice", err)
        }
      },
    },
    {
      event: eventNames.proformaIssued,
      handler: async (envelope) => {
        const event = coerceEvent(envelope.data)
        if (!event) return
        try {
          // Same shape as createInvoice — SmartBill's `/proforma`
          // endpoint accepts the same body as `/invoice`.
          const body = await mapEvent(event)
          const existingRef = await findExistingSmartbillRef(event, "proforma", body)
          if (existingRef) {
            await handleExistingSmartbillRef(event, "proforma", body, existingRef)
            return
          }
          const result = await client.createProforma(body)
          logger.info?.(
            `[smartbill] proforma created: ${result.series}-${result.number} for ${event.id}`,
            result,
          )
          await persistArtifact(event, "proforma", body, result)
          await applyExternalAllocationIfRequired(event, "proforma", body, result)
        } catch (err) {
          logger.error(
            `[smartbill] createProforma on "${eventNames.proformaIssued}" failed for ${event.id}`,
            err,
          )
          await recordSyncError(event, "proforma", err)
        }
      },
    },
    {
      event: eventNames.voided,
      handler: async (envelope) => {
        const event = coerceEvent(envelope.data)
        if (!event) return
        try {
          const seriesName = await resolveExternalSeriesName(event)
          const number =
            typeof event.externalNumber === "string"
              ? event.externalNumber
              : typeof event.invoiceNumber === "string"
                ? event.invoiceNumber
                : undefined
          if (!number) {
            logger.error(`[smartbill] cannot cancel invoice ${event.id}: missing external number`)
            return
          }
          await client.cancelInvoice(validatedOptions.companyVatCode, seriesName, number)
          logger.info?.(`[smartbill] invoice cancelled: ${seriesName}-${number} for ${event.id}`)
        } catch (err) {
          logger.error(
            `[smartbill] cancelInvoice on "${eventNames.voided}" failed for ${event.id}`,
            err,
          )
        }
      },
    },
    {
      event: eventNames.syncRequested,
      handler: async (envelope) => {
        const event = coerceEvent(envelope.data)
        if (!event) return
        try {
          const seriesName = await resolveExternalSeriesName(event)
          const number =
            typeof event.externalNumber === "string"
              ? event.externalNumber
              : typeof event.invoiceNumber === "string"
                ? event.invoiceNumber
                : undefined
          if (!number) {
            logger.error(`[smartbill] cannot sync invoice ${event.id}: missing external number`)
            return
          }
          const status = await client.getPaymentStatus(
            validatedOptions.companyVatCode,
            seriesName,
            number,
          )
          const paymentLabel = status.paid
            ? "paid"
            : (status.paidAmount ?? 0) > 0
              ? "partially_paid"
              : "unpaid"
          logger.info?.(
            `[smartbill] payment status for ${seriesName}-${number}: ${paymentLabel}`,
            status,
          )
        } catch (err) {
          logger.error(
            `[smartbill] getPaymentStatus on "${eventNames.syncRequested}" failed for ${event.id}`,
            err,
          )
        }
      },
    },
  ]

  return {
    name: "smartbill",
    version: "0.1.0",
    subscribers,
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
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
    !ref.syncError &&
    Boolean(ref.externalNumber || ref.externalId)
  )
}

function parseSmartbillPluginOptions(options: SmartbillPluginOptions): SmartbillPluginOptions {
  try {
    return smartbillPluginOptionsSchema.parse(options)
  } catch (error) {
    if (error instanceof ZodError) {
      const detail = error.issues
        .map((issue) => {
          const path = issue.path.join(".") || "options"
          return `${path}: ${issue.message}`
        })
        .join("; ")
      throw new Error(`Invalid SmartBill plugin options: ${detail}`)
    }
    throw error
  }
}
