import { financeService, type InvoiceExternalRef } from "@voyantjs/finance"
import type { StorageProvider } from "@voyantjs/storage"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { SmartbillClientApi } from "./client.js"
import type { SmartbillInvoiceBody, SmartbillInvoiceResponse, VoyantInvoiceEvent } from "./types.js"

export type SmartbillDocumentType = "invoice" | "proforma"

export interface SmartbillArtifactStorageContext {
  event: VoyantInvoiceEvent
  documentType: SmartbillDocumentType
  body: SmartbillInvoiceBody
  result: SmartbillInvoiceResponse
}

export type SmartbillDbResolver =
  | PostgresJsDatabase
  | ((
      context: SmartbillArtifactStorageContext,
    ) => PostgresJsDatabase | null | Promise<PostgresJsDatabase | null>)

export type SmartbillDocumentStorageResolver =
  | StorageProvider
  | null
  | ((
      context: SmartbillArtifactStorageContext,
    ) => StorageProvider | null | Promise<StorageProvider | null>)

export type SmartbillStorageKeyPrefixResolver =
  | string
  | ((context: SmartbillArtifactStorageContext) => string | Promise<string>)

export interface SmartbillArtifactPersistenceOptions {
  db?: SmartbillDbResolver
  documentStorage?: SmartbillDocumentStorageResolver
  documentStorageKeyPrefix?: SmartbillStorageKeyPrefixResolver
}

export interface SmartbillArtifactPersistenceRuntime {
  db?: SmartbillDbResolver
  documentStorage?: SmartbillDocumentStorageResolver
  documentStorageKeyPrefix?: SmartbillStorageKeyPrefixResolver
}

export interface PersistSmartbillInvoiceArtifactInput {
  runtime: SmartbillArtifactPersistenceRuntime
  client: SmartbillClientApi
  event: VoyantInvoiceEvent
  documentType: SmartbillDocumentType
  body: SmartbillInvoiceBody
  result: SmartbillInvoiceResponse
}

export type SmartbillExternalRef = Pick<
  InvoiceExternalRef,
  "id" | "invoiceId" | "externalId" | "externalNumber" | "externalUrl" | "metadata"
>

export interface RetrySmartbillInvoiceArtifactInput {
  runtime: SmartbillArtifactPersistenceRuntime
  client: SmartbillClientApi
  externalRef: SmartbillExternalRef
  documentType: SmartbillDocumentType
}

type InvoiceAttachmentRecord = Awaited<ReturnType<typeof financeService.createInvoiceAttachment>>
type InvoiceRenditionRecord = Awaited<ReturnType<typeof financeService.createInvoiceRendition>>

export type SmartbillArtifactPersistenceResult =
  | {
      status: "skipped"
      reason:
        | "missing_db"
        | "missing_invoice"
        | "missing_document_storage"
        | "missing_smartbill_reference"
    }
  | { status: "registered_ref"; reason?: "missing_number" }
  | { status: "already_exists"; attachment: InvoiceAttachmentRecord }
  | { status: "persisted"; rendition: InvoiceRenditionRecord; attachment: InvoiceAttachmentRecord }

const SMARTBILL_ATTACHMENT_KIND = "smartbill_pdf"

function isResolver<TContext, TValue>(
  value: TValue | ((context: TContext) => TValue | Promise<TValue>) | undefined | null,
): value is (context: TContext) => TValue | Promise<TValue> {
  return typeof value === "function"
}

async function resolveMaybe<TContext, TValue>(
  value: TValue | ((context: TContext) => TValue | Promise<TValue>) | undefined,
  context: TContext,
) {
  return isResolver<TContext, TValue>(value) ? await value(context) : value
}

function sanitizeKeyPart(value: string) {
  return value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document"
}

async function sha256(bytes: Uint8Array) {
  const crypto = globalThis.crypto
  if (!crypto?.subtle) return null
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  const digest = await crypto.subtle.digest("SHA-256", buffer)
  return `sha256:${Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`
}

function smartbillAttachmentName(
  documentType: SmartbillDocumentType,
  seriesName: string,
  number: string,
) {
  return `SmartBill ${documentType} ${seriesName}-${number}.pdf`
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

export async function persistSmartbillInvoiceArtifact({
  runtime,
  client,
  event,
  documentType,
  body,
  result,
}: PersistSmartbillInvoiceArtifactInput): Promise<SmartbillArtifactPersistenceResult> {
  if (!runtime.db) return { status: "skipped" as const, reason: "missing_db" as const }

  const context: SmartbillArtifactStorageContext = { event, documentType, body, result }
  const db = await resolveMaybe(runtime.db, context)
  if (!db) return { status: "skipped" as const, reason: "missing_db" as const }

  const seriesName = result.series ?? body.seriesName
  const number = result.number

  const externalRef = await financeService.registerInvoiceExternalRef(db, event.id, {
    provider: "smartbill",
    externalId: number ?? null,
    externalNumber: number ?? null,
    externalUrl: result.url ?? null,
    status: result.errorText ? "error" : "issued",
    syncedAt: new Date().toISOString(),
    syncError: result.errorText ?? null,
    metadata: {
      companyVatCode: body.companyVatCode,
      seriesName: body.seriesName,
      series: seriesName,
      number: number ?? null,
      documentType,
    },
  })
  if (!externalRef) return { status: "skipped" as const, reason: "missing_invoice" as const }

  const storage = await resolveMaybe(runtime.documentStorage, context)
  if (!storage) return { status: "registered_ref" as const }
  if (!number) return { status: "registered_ref" as const, reason: "missing_number" as const }

  const keyPrefix = await resolveMaybe(runtime.documentStorageKeyPrefix, context)
  return persistSmartbillPdfArtifact({
    db,
    storage,
    client,
    invoiceId: event.id,
    documentType,
    companyVatCode: body.companyVatCode,
    seriesName,
    number,
    language: body.language ?? null,
    keyPrefix,
  })
}

export async function retrySmartbillInvoiceArtifact({
  runtime,
  client,
  externalRef,
  documentType,
}: RetrySmartbillInvoiceArtifactInput): Promise<SmartbillArtifactPersistenceResult> {
  if (!runtime.db) return { status: "skipped" as const, reason: "missing_db" as const }

  const metadata = coerceMetadata(externalRef.metadata)
  const companyVatCode =
    metadataString(metadata, "companyVatCode") ?? metadataString(metadata, "vatCode")
  const seriesName = metadataString(metadata, "series") ?? metadataString(metadata, "seriesName")
  const number =
    metadataString(metadata, "number") ??
    externalRef.externalNumber ??
    externalRef.externalId ??
    null

  if (!companyVatCode || !seriesName || !number) {
    return { status: "skipped" as const, reason: "missing_smartbill_reference" as const }
  }

  const context: SmartbillArtifactStorageContext = {
    event: { id: externalRef.invoiceId },
    documentType,
    body: {
      companyVatCode,
      client: { name: "Client" },
      seriesName,
      currency: "RON",
      language: metadataString(metadata, "language") ?? undefined,
      products: [],
    },
    result: {
      number,
      series: seriesName,
      url: externalRef.externalUrl ?? undefined,
    },
  }
  const db = await resolveMaybe(runtime.db, context)
  if (!db) return { status: "skipped" as const, reason: "missing_db" as const }

  const storage = await resolveMaybe(runtime.documentStorage, context)
  if (!storage) return { status: "skipped" as const, reason: "missing_document_storage" as const }

  const keyPrefix = await resolveMaybe(runtime.documentStorageKeyPrefix, context)
  return persistSmartbillPdfArtifact({
    db,
    storage,
    client,
    invoiceId: externalRef.invoiceId,
    documentType,
    companyVatCode,
    seriesName,
    number,
    language: metadataString(metadata, "language"),
    keyPrefix,
  })
}

async function persistSmartbillPdfArtifact({
  db,
  storage,
  client,
  invoiceId,
  documentType,
  companyVatCode,
  seriesName,
  number,
  language,
  keyPrefix,
}: {
  db: PostgresJsDatabase
  storage: StorageProvider
  client: SmartbillClientApi
  invoiceId: string
  documentType: SmartbillDocumentType
  companyVatCode: string
  seriesName: string
  number: string
  language?: string | null
  keyPrefix?: string
}): Promise<SmartbillArtifactPersistenceResult> {
  const existingAttachments = await financeService.listInvoiceAttachments(db, invoiceId)
  const existingSmartbillAttachment = existingAttachments.find(
    (attachment) => attachment.kind === SMARTBILL_ATTACHMENT_KIND,
  )
  if (existingSmartbillAttachment) {
    return { status: "already_exists" as const, attachment: existingSmartbillAttachment }
  }

  const pdf =
    documentType === "proforma"
      ? await client.viewEstimatePdf(companyVatCode, seriesName, number)
      : await client.viewInvoicePdf(companyVatCode, seriesName, number)

  const defaultPrefix = `invoices/${invoiceId}/smartbill`
  const resolvedKeyPrefix = keyPrefix ?? defaultPrefix
  const key = `${resolvedKeyPrefix.replace(/\/$/, "")}/${documentType}-${sanitizeKeyPart(seriesName)}-${sanitizeKeyPart(number)}.pdf`
  const contentType = pdf.contentType || "application/pdf"
  const checksum = await sha256(pdf.bytes)
  const uploaded = await storage.upload(pdf.bytes, {
    key,
    contentType,
    metadata: {
      provider: "smartbill",
      documentType,
      invoiceId,
      seriesName,
      number,
    },
  })

  const commonMetadata = {
    provider: "smartbill",
    documentType,
    companyVatCode,
    seriesName,
    number,
    storageProvider: storage.name,
    ...(uploaded.url ? { url: uploaded.url } : {}),
  }

  const rendition = await financeService.createInvoiceRendition(db, invoiceId, {
    format: "pdf",
    status: "ready",
    storageKey: uploaded.key,
    fileSize: pdf.bytes.byteLength,
    checksum,
    language: language ?? null,
    generatedAt: new Date().toISOString(),
    metadata: commonMetadata,
  })

  const attachment = await financeService.createInvoiceAttachment(db, invoiceId, {
    kind: SMARTBILL_ATTACHMENT_KIND,
    name: smartbillAttachmentName(documentType, seriesName, number),
    mimeType: contentType,
    fileSize: pdf.bytes.byteLength,
    storageKey: uploaded.key,
    checksum,
    metadata: {
      ...commonMetadata,
      renditionId: rendition?.id ?? null,
    },
  })

  return { status: "persisted" as const, rendition, attachment }
}
