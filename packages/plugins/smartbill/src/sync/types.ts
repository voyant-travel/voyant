import type { InvoiceIssueRuntime } from "@voyantjs/finance"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type {
  persistSmartbillInvoiceArtifact,
  retrySmartbillInvoiceArtifact,
  SmartbillDocumentType,
  SmartbillExternalRef,
} from "../artifacts.js"
import type { SmartbillClientApi } from "../client.js"
import type { SmartbillPluginOptions } from "../plugin.js"
import type { SmartbillSyncRuntime } from "../runtime.js"
import type { SmartbillInvoiceResponse, VoyantInvoiceEvent } from "../types.js"

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

export interface SyncSmartbillInvoiceVoidEventInput {
  event: VoyantInvoiceEvent
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

export type SyncSmartbillInvoiceVoidEventResult =
  | {
      status: "cancelled"
      invoiceId: string
      seriesName: string
      number: string
      externalRef: SmartbillExternalRef | null
    }
  | {
      status: "already_cancelled"
      invoiceId: string
      externalRef: SmartbillExternalRef
    }
  | {
      status: "missing_number"
      invoiceId: string
    }
