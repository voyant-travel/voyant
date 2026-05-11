import type { Plugin, Subscriber } from "@voyantjs/core"
import { ZodError } from "zod"

import {
  persistSmartbillInvoiceArtifact,
  type SmartbillArtifactPersistenceOptions,
  type SmartbillDocumentType,
} from "./artifacts.js"
import type { SmartbillClientOptions } from "./client.js"
import type { mapVoyantInvoiceToSmartbill, SmartbillMappingOptions } from "./mapping.js"
import { createSmartbillSyncRuntime } from "./runtime.js"
import type { VoyantInvoiceEvent } from "./types.js"
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
) => ReturnType<typeof mapVoyantInvoiceToSmartbill>

export interface SmartbillPluginOptions extends SmartbillClientOptions, SmartbillMappingOptions {
  events?: SmartbillSyncEventNames
  mapEvent?: SmartbillMapFn
  logger?: SmartbillLogger
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
  const { client, logger, mapEvent, eventNames, artifacts } =
    createSmartbillSyncRuntime(validatedOptions)

  async function persistArtifact(
    event: VoyantInvoiceEvent,
    documentType: SmartbillDocumentType,
    body: ReturnType<SmartbillMapFn>,
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
      logger.error(`[smartbill] artifact persistence failed for ${event.id}`, err)
    }
  }

  const subscribers: Subscriber[] = [
    {
      event: eventNames.issued,
      handler: async (envelope) => {
        const event = coerceEvent(envelope.data)
        if (!event) return
        try {
          const body = mapEvent(event)
          const result = await client.createInvoice(body)
          logger.info?.(
            `[smartbill] invoice created: ${result.series}-${result.number} for ${event.id}`,
            result,
          )
          await persistArtifact(event, "invoice", body, result)
        } catch (err) {
          logger.error(
            `[smartbill] createInvoice on "${eventNames.issued}" failed for ${event.id}`,
            err,
          )
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
          const body = mapEvent(event)
          const result = await client.createProforma(body)
          logger.info?.(
            `[smartbill] proforma created: ${result.series}-${result.number} for ${event.id}`,
            result,
          )
          await persistArtifact(event, "proforma", body, result)
        } catch (err) {
          logger.error(
            `[smartbill] createProforma on "${eventNames.proformaIssued}" failed for ${event.id}`,
            err,
          )
        }
      },
    },
    {
      event: eventNames.voided,
      handler: async (envelope) => {
        const event = coerceEvent(envelope.data)
        if (!event) return
        try {
          const seriesName =
            typeof event.externalSeriesName === "string"
              ? event.externalSeriesName
              : validatedOptions.seriesName
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
          const seriesName =
            typeof event.externalSeriesName === "string"
              ? event.externalSeriesName
              : validatedOptions.seriesName
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
