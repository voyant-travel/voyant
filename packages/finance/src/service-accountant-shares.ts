import { infraPublicDocumentDeliveryGrantsTable } from "@voyant-travel/db/schema/infra"
import {
  createDrizzlePublicDocumentDeliveryGrantStore,
  createPublicDocumentDeliveryGrant,
  resolvePublicDocumentDeliveryGrant,
  revokePublicDocumentDeliveryGrant,
} from "@voyant-travel/public-document-delivery"
import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, ne } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  invoiceAttachments,
  invoices,
  supplierInvoiceAttachments,
  supplierInvoices,
} from "./schema.js"

/**
 * Accountant shares — a revocable, TTL'd, audited public link that opens a
 * read-only finance portal scoped to a date range (RFC §13.2). Built on the
 * generic `public_document_delivery_grants` token store: we mint a grant tagged
 * `finance/accountant-share` whose `metadata` carries the period scope. The
 * portal validates the token, reads the scope, and serves profitability +
 * invoices for that window. No login; the token is the credential.
 */

const SOURCE_MODULE = "finance"
const SOURCE_ENTITY = "accountant-share"
const SHARE_SENTINEL_STORAGE_KEY = "accountant-share"
const DEFAULT_TTL_DAYS = 30

export interface AccountantShareScope {
  from: string | null
  to: string | null
  baseCurrency: string | null
}

export interface AccountantShareRecord extends AccountantShareScope {
  id: string
  createdAt: string
  expiresAt: string
  lastAccessedAt: string | null
  accessCount: number
}

export interface AccountantInvoiceAttachment {
  id: string
  name: string
  mimeType: string | null
  fileSize: number | null
  hasFile: boolean
}

export type AccountantInvoiceKind = "client" | "supplier"

export interface AccountantInvoiceRecord {
  id: string
  kind: AccountantInvoiceKind
  invoiceNumber: string
  status: string
  currency: string
  totalCents: number
  paidCents: number
  balanceDueCents: number
  issueDate: string
  dueDate: string | null
  attachments: AccountantInvoiceAttachment[]
}

export type AccountantShareResolution =
  | { status: "ready"; grantId: string; scope: AccountantShareScope }
  | { status: "not_found" }
  | { status: "gone" }

function scopeFromMetadata(metadata: unknown): AccountantShareScope {
  const m = (metadata ?? {}) as Record<string, unknown>
  return {
    from: typeof m.from === "string" ? m.from : null,
    to: typeof m.to === "string" ? m.to : null,
    baseCurrency: typeof m.baseCurrency === "string" ? m.baseCurrency : null,
  }
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export const accountantSharesService = {
  async create(
    db: PostgresJsDatabase,
    input: {
      from?: string | null
      to?: string | null
      baseCurrency?: string | null
      ttlDays?: number | null
    },
    ctx: { publicBaseUrl: string; userId?: string | null },
  ) {
    const store = createDrizzlePublicDocumentDeliveryGrantStore(db)
    const scope: AccountantShareScope = {
      from: input.from?.trim() || null,
      to: input.to?.trim() || null,
      baseCurrency: input.baseCurrency?.trim().toUpperCase() || null,
    }
    const ttlDays = input.ttlDays && input.ttlDays > 0 ? input.ttlDays : DEFAULT_TTL_DAYS
    const envelope = await createPublicDocumentDeliveryGrant(store, {
      storageKey: SHARE_SENTINEL_STORAGE_KEY,
      publicBaseUrl: ctx.publicBaseUrl,
      publicPath: "/accountant",
      ttlSeconds: ttlDays * 24 * 60 * 60,
      contentType: "application/json",
      source: { module: SOURCE_MODULE, entity: SOURCE_ENTITY, id: null },
      metadata: scope,
      createdBy: ctx.userId ?? null,
      createdByType: "staff",
    })
    return { id: envelope.grantId, url: envelope.url, expiresAt: envelope.expiresAt, ...scope }
  },

  async list(db: PostgresJsDatabase): Promise<AccountantShareRecord[]> {
    const rows = await db
      .select()
      .from(infraPublicDocumentDeliveryGrantsTable)
      .where(
        and(
          eq(infraPublicDocumentDeliveryGrantsTable.sourceEntity, SOURCE_ENTITY),
          isNull(infraPublicDocumentDeliveryGrantsTable.revokedAt),
        ),
      )
      .orderBy(desc(infraPublicDocumentDeliveryGrantsTable.createdAt))
    return rows.map((row) => ({
      id: row.id,
      ...scopeFromMetadata(row.metadata),
      createdAt: toIso(row.createdAt) ?? "",
      expiresAt: toIso(row.expiresAt) ?? "",
      lastAccessedAt: toIso(row.lastAccessedAt),
      accessCount: row.accessCount,
    }))
  },

  async revoke(db: PostgresJsDatabase, id: string, userId?: string | null) {
    const store = createDrizzlePublicDocumentDeliveryGrantStore(db)
    return revokePublicDocumentDeliveryGrant(store, { id, revokedBy: userId ?? null })
  },

  async resolve(db: PostgresJsDatabase, token: string): Promise<AccountantShareResolution> {
    const store = createDrizzlePublicDocumentDeliveryGrantStore(db)
    const resolution = await resolvePublicDocumentDeliveryGrant(store, token)
    if (resolution.status === "not_found") return { status: "not_found" }
    if (resolution.status !== "ready") return { status: "gone" }
    if (resolution.grant.sourceEntity !== SOURCE_ENTITY) return { status: "not_found" }
    return {
      status: "ready",
      grantId: resolution.grant.id,
      scope: scopeFromMetadata(resolution.grant.metadata),
    }
  },

  async recordAccess(
    db: PostgresJsDatabase,
    grantId: string,
    ctx: { ip?: string | null; userAgent?: string | null },
  ) {
    const store = createDrizzlePublicDocumentDeliveryGrantStore(db)
    await store.recordAccess(grantId, {
      accessedAt: new Date(),
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    })
  },

  /** Customer (AR) + supplier (AP) invoices in the scope window, with attachments. */
  async getInvoicesWithAttachments(
    db: PostgresJsDatabase,
    scope: AccountantShareScope,
  ): Promise<AccountantInvoiceRecord[]> {
    const clientConditions = [ne(invoices.status, "void"), ne(invoices.invoiceType, "proforma")]
    if (scope.from) clientConditions.push(gte(invoices.issueDate, scope.from))
    if (scope.to) clientConditions.push(lte(invoices.issueDate, scope.to))

    const supplierConditions = [
      ne(supplierInvoices.status, "void"),
      isNull(supplierInvoices.deletedAt),
    ]
    if (scope.from) supplierConditions.push(gte(supplierInvoices.issueDate, scope.from))
    if (scope.to) supplierConditions.push(lte(supplierInvoices.issueDate, scope.to))

    const [clientRows, supplierRows] = await Promise.all([
      db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          status: invoices.status,
          currency: invoices.currency,
          totalCents: invoices.totalCents,
          paidCents: invoices.paidCents,
          balanceDueCents: invoices.balanceDueCents,
          issueDate: invoices.issueDate,
          dueDate: invoices.dueDate,
        })
        .from(invoices)
        .where(and(...clientConditions)),
      db
        .select({
          id: supplierInvoices.id,
          invoiceNumber: supplierInvoices.supplierInvoiceNo,
          status: supplierInvoices.status,
          currency: supplierInvoices.currency,
          totalCents: supplierInvoices.totalCents,
          paidCents: supplierInvoices.paidCents,
          balanceDueCents: supplierInvoices.balanceDueCents,
          issueDate: supplierInvoices.issueDate,
          dueDate: supplierInvoices.dueDate,
        })
        .from(supplierInvoices)
        .where(and(...supplierConditions)),
    ])

    const [clientAttachments, supplierAttachments] = await Promise.all([
      clientRows.length
        ? db
            .select({
              id: invoiceAttachments.id,
              parentId: invoiceAttachments.invoiceId,
              name: invoiceAttachments.name,
              mimeType: invoiceAttachments.mimeType,
              fileSize: invoiceAttachments.fileSize,
              storageKey: invoiceAttachments.storageKey,
            })
            .from(invoiceAttachments)
            .where(
              inArray(
                invoiceAttachments.invoiceId,
                clientRows.map((row) => row.id),
              ),
            )
        : Promise.resolve([]),
      supplierRows.length
        ? db
            .select({
              id: supplierInvoiceAttachments.id,
              parentId: supplierInvoiceAttachments.supplierInvoiceId,
              name: supplierInvoiceAttachments.name,
              mimeType: supplierInvoiceAttachments.mimeType,
              fileSize: supplierInvoiceAttachments.fileSize,
              storageKey: supplierInvoiceAttachments.storageKey,
            })
            .from(supplierInvoiceAttachments)
            .where(
              inArray(
                supplierInvoiceAttachments.supplierInvoiceId,
                supplierRows.map((row) => row.id),
              ),
            )
        : Promise.resolve([]),
    ])

    const groupAttachments = (
      rows: Array<{
        id: string
        parentId: string
        name: string
        mimeType: string | null
        fileSize: number | null
        storageKey: string | null
      }>,
    ) => {
      const map = new Map<string, AccountantInvoiceAttachment[]>()
      for (const att of rows) {
        const list = map.get(att.parentId) ?? []
        list.push({
          id: att.id,
          name: att.name,
          mimeType: att.mimeType,
          fileSize: att.fileSize,
          hasFile: Boolean(att.storageKey),
        })
        map.set(att.parentId, list)
      }
      return map
    }
    const clientByInvoice = groupAttachments(clientAttachments)
    const supplierByInvoice = groupAttachments(supplierAttachments)

    const records: AccountantInvoiceRecord[] = [
      ...clientRows.map((row) => ({
        ...row,
        kind: "client" as const,
        attachments: clientByInvoice.get(row.id) ?? [],
      })),
      ...supplierRows.map((row) => ({
        ...row,
        kind: "supplier" as const,
        attachments: supplierByInvoice.get(row.id) ?? [],
      })),
    ]
    records.sort(
      (a, b) =>
        b.issueDate.localeCompare(a.issueDate) || a.invoiceNumber.localeCompare(b.invoiceNumber),
    )
    return records
  },

  /** Resolve a single attachment for download, enforcing it sits within scope. */
  async getAttachmentForDownload(
    db: PostgresJsDatabase,
    scope: AccountantShareScope,
    kind: AccountantInvoiceKind,
    invoiceId: string,
    attachmentId: string,
  ): Promise<{ storageKey: string; name: string; mimeType: string | null } | null> {
    if (kind === "supplier") {
      const conditions = [
        eq(supplierInvoiceAttachments.id, attachmentId),
        eq(supplierInvoiceAttachments.supplierInvoiceId, invoiceId),
        ne(supplierInvoices.status, "void"),
        isNull(supplierInvoices.deletedAt),
      ]
      if (scope.from) conditions.push(gte(supplierInvoices.issueDate, scope.from))
      if (scope.to) conditions.push(lte(supplierInvoices.issueDate, scope.to))
      const [row] = await db
        .select({
          storageKey: supplierInvoiceAttachments.storageKey,
          name: supplierInvoiceAttachments.name,
          mimeType: supplierInvoiceAttachments.mimeType,
        })
        .from(supplierInvoiceAttachments)
        .innerJoin(
          supplierInvoices,
          eq(supplierInvoiceAttachments.supplierInvoiceId, supplierInvoices.id),
        )
        .where(and(...conditions))
        .limit(1)
      if (!row?.storageKey) return null
      return { storageKey: row.storageKey, name: row.name, mimeType: row.mimeType }
    }

    const conditions = [
      eq(invoiceAttachments.id, attachmentId),
      eq(invoiceAttachments.invoiceId, invoiceId),
      ne(invoices.status, "void"),
    ]
    if (scope.from) conditions.push(gte(invoices.issueDate, scope.from))
    if (scope.to) conditions.push(lte(invoices.issueDate, scope.to))

    const [row] = await db
      .select({
        storageKey: invoiceAttachments.storageKey,
        name: invoiceAttachments.name,
        mimeType: invoiceAttachments.mimeType,
      })
      .from(invoiceAttachments)
      .innerJoin(invoices, eq(invoiceAttachments.invoiceId, invoices.id))
      .where(and(...conditions))
      .limit(1)

    if (!row?.storageKey) return null
    return { storageKey: row.storageKey, name: row.name, mimeType: row.mimeType }
  },

  /** Every in-scope invoice attachment that has a stored file, for bulk ZIP. */
  async listAttachmentsForZip(
    db: PostgresJsDatabase,
    scope: AccountantShareScope,
  ): Promise<
    Array<{ kind: AccountantInvoiceKind; invoiceNumber: string; name: string; storageKey: string }>
  > {
    const clientConditions = [ne(invoices.status, "void"), ne(invoices.invoiceType, "proforma")]
    if (scope.from) clientConditions.push(gte(invoices.issueDate, scope.from))
    if (scope.to) clientConditions.push(lte(invoices.issueDate, scope.to))

    const supplierConditions = [
      ne(supplierInvoices.status, "void"),
      isNull(supplierInvoices.deletedAt),
    ]
    if (scope.from) supplierConditions.push(gte(supplierInvoices.issueDate, scope.from))
    if (scope.to) supplierConditions.push(lte(supplierInvoices.issueDate, scope.to))

    const [clientRows, supplierRows] = await Promise.all([
      db
        .select({
          invoiceNumber: invoices.invoiceNumber,
          name: invoiceAttachments.name,
          storageKey: invoiceAttachments.storageKey,
        })
        .from(invoiceAttachments)
        .innerJoin(invoices, eq(invoiceAttachments.invoiceId, invoices.id))
        .where(and(...clientConditions, isNotNull(invoiceAttachments.storageKey))),
      db
        .select({
          invoiceNumber: supplierInvoices.supplierInvoiceNo,
          name: supplierInvoiceAttachments.name,
          storageKey: supplierInvoiceAttachments.storageKey,
        })
        .from(supplierInvoiceAttachments)
        .innerJoin(
          supplierInvoices,
          eq(supplierInvoiceAttachments.supplierInvoiceId, supplierInvoices.id),
        )
        .where(and(...supplierConditions, isNotNull(supplierInvoiceAttachments.storageKey))),
    ])

    return [
      ...clientRows.map((r) => ({
        kind: "client" as const,
        invoiceNumber: r.invoiceNumber,
        name: r.name,
        storageKey: r.storageKey as string,
      })),
      ...supplierRows.map((r) => ({
        kind: "supplier" as const,
        invoiceNumber: r.invoiceNumber,
        name: r.name,
        storageKey: r.storageKey as string,
      })),
    ]
  },
}

// ---------- invoices CSV (accountant export) ----------

const invCsvField = (value: string | number | null | undefined): string => {
  const str = value == null ? "" : String(value)
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

export function buildAccountantInvoicesCsv(rows: AccountantInvoiceRecord[]): string {
  const header = [
    "type",
    "invoice_number",
    "status",
    "currency",
    "total",
    "paid",
    "balance_due",
    "issue_date",
    "due_date",
  ]
  const body = rows.map((r) =>
    [
      r.kind,
      r.invoiceNumber,
      r.status,
      r.currency,
      (r.totalCents / 100).toFixed(2),
      (r.paidCents / 100).toFixed(2),
      (r.balanceDueCents / 100).toFixed(2),
      r.issueDate,
      r.dueDate ?? "",
    ]
      .map(invCsvField)
      .join(","),
  )
  return `﻿${[header.join(","), ...body].join("\r\n")}\r\n`
}
