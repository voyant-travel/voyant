import type { Plugin, Subscriber } from "@voyantjs/core"
import { financeService } from "@voyantjs/finance"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { SmartbillArtifactPersistenceOptions } from "./artifacts.js"
import type { SmartbillClientOptions } from "./client.js"
import type { SmartbillMappingOptions } from "./mapping.js"
import { createSmartbillSyncRuntime } from "./runtime.js"
import { syncSmartbillInvoiceEvent, syncSmartbillProformaConversion } from "./sync.js"
import type { SmartbillInvoiceBody, SmartbillInvoiceResponse, VoyantInvoiceEvent } from "./types.js"
import { parseSmartbillPluginOptions } from "./validation.js"

export interface SmartbillSyncEventNames {
  issued?: string
  proformaIssued?: string
  proformaConverted?: string
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

export type SmartbillInvoiceNumberWriteBackFormatter = (
  event: VoyantInvoiceEvent,
  result: SmartbillInvoiceResponse,
) => string | Promise<string>

export interface SmartbillPluginOptions extends SmartbillClientOptions, SmartbillMappingOptions {
  events?: SmartbillSyncEventNames
  mapEvent?: SmartbillMapFn
  logger?: SmartbillLogger
  idempotency?: SmartbillIdempotencyOptions
  onError?: SmartbillErrorHandler
  /**
   * When enabled, mirrors SmartBill's issued series-number back onto
   * `invoices.invoice_number` after a successful create. `true` uses
   * `${series}-${number}`; a formatter can return a custom value.
   */
  writeBackInvoiceNumber?: boolean | SmartbillInvoiceNumberWriteBackFormatter
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

function resolveStaticArtifactDb(
  db: SmartbillArtifactPersistenceOptions["db"],
): PostgresJsDatabase | null {
  if (!db || typeof db === "function") return null
  return db
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
  const runtime = createSmartbillSyncRuntime(validatedOptions)
  const { client, logger, eventNames } = runtime

  async function ensureNumberSeries() {
    const db = resolveStaticArtifactDb(runtime.artifacts.db)
    if (!db || typeof validatedOptions.seriesName !== "string") return
    try {
      await financeService.ensureExternalInvoiceNumberSeries(db, [
        {
          provider: "smartbill",
          scope: "invoice",
          code: "smartbill-invoice",
          name: "SmartBill invoices",
          externalConfigKey: validatedOptions.seriesName,
          isDefault: true,
        },
        {
          provider: "smartbill",
          scope: "proforma",
          code: "smartbill-proforma",
          name: "SmartBill proformas",
          externalConfigKey: validatedOptions.seriesName,
          isDefault: true,
        },
      ])
    } catch (error) {
      logger.error("[smartbill] invoice number series bootstrap failed", error)
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
        if (typeof event.convertedFromInvoiceId === "string" && event.convertedFromInvoiceId) {
          logger.info?.(
            `[smartbill] skipping invoice create for converted proforma ${event.id}; waiting for "${eventNames.proformaConverted}"`,
          )
          return
        }
        try {
          await syncSmartbillInvoiceEvent({
            event,
            documentType: "invoice",
            runtime,
            pluginOptions: validatedOptions,
            operationLabel: `createInvoice on "${eventNames.issued}"`,
          })
        } catch {
          // `syncSmartbillInvoiceEvent` logs and records retryable state.
        }
      },
    },
    {
      event: eventNames.proformaIssued,
      handler: async (envelope) => {
        const event = coerceEvent(envelope.data)
        if (!event) return
        try {
          await syncSmartbillInvoiceEvent({
            event,
            documentType: "proforma",
            runtime,
            pluginOptions: validatedOptions,
            operationLabel: `createProforma on "${eventNames.proformaIssued}"`,
          })
        } catch {
          // `syncSmartbillInvoiceEvent` logs and records retryable state.
        }
      },
    },
    {
      event: eventNames.proformaConverted,
      handler: async (envelope) => {
        const event = coerceEvent(envelope.data)
        if (!event) return
        try {
          await syncSmartbillProformaConversion({
            event,
            runtime,
            pluginOptions: validatedOptions,
          })
        } catch {
          // `syncSmartbillProformaConversion` logs and records retryable state.
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
    bootstrap: ensureNumberSeries,
    subscribers,
  }
}
