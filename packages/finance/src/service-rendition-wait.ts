import { and, desc, eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { type InvoiceRendition, invoiceRenditions } from "./schema.js"

export type InvoiceRenditionWaitMode = "none" | "pdf" | "any"

export interface WaitForInvoiceRenditionOptions {
  format?: InvoiceRendition["format"]
  renditionId?: string
  timeoutMs?: number
  intervalMs?: number
}

export type WaitForInvoiceRenditionResult =
  | { status: "ready"; rendition: InvoiceRendition }
  | { status: "failed"; rendition: InvoiceRendition }
  | { status: "timeout"; rendition: InvoiceRendition | null }

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_INTERVAL_MS = 250

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function clampWaitTimeout(timeoutMs: number | undefined) {
  if (timeoutMs == null || Number.isNaN(timeoutMs)) return DEFAULT_TIMEOUT_MS
  return Math.max(0, Math.min(60_000, timeoutMs))
}

async function findTerminalRendition(
  db: PostgresJsDatabase,
  invoiceId: string,
  options: Pick<WaitForInvoiceRenditionOptions, "format" | "renditionId">,
) {
  const conditions = [
    eq(invoiceRenditions.invoiceId, invoiceId),
    inArray(invoiceRenditions.status, ["ready", "failed"]),
  ]
  if (options.renditionId) conditions.push(eq(invoiceRenditions.id, options.renditionId))
  if (options.format) conditions.push(eq(invoiceRenditions.format, options.format))

  const [row] = await db
    .select()
    .from(invoiceRenditions)
    .where(and(...conditions))
    .orderBy(desc(invoiceRenditions.createdAt))
    .limit(1)

  return row ?? null
}

export async function getLatestInvoiceRendition(
  db: PostgresJsDatabase,
  invoiceId: string,
  options: Pick<WaitForInvoiceRenditionOptions, "format" | "renditionId"> = {},
) {
  const conditions = [eq(invoiceRenditions.invoiceId, invoiceId)]
  if (options.renditionId) conditions.push(eq(invoiceRenditions.id, options.renditionId))
  if (options.format) conditions.push(eq(invoiceRenditions.format, options.format))

  const [row] = await db
    .select()
    .from(invoiceRenditions)
    .where(and(...conditions))
    .orderBy(desc(invoiceRenditions.createdAt))
    .limit(1)

  return row ?? null
}

export async function waitForInvoiceRendition(
  db: PostgresJsDatabase,
  invoiceId: string,
  options: WaitForInvoiceRenditionOptions = {},
): Promise<WaitForInvoiceRenditionResult> {
  const timeoutMs = clampWaitTimeout(options.timeoutMs)
  const intervalMs = Math.max(10, options.intervalMs ?? DEFAULT_INTERVAL_MS)
  const deadline = Date.now() + timeoutMs

  while (true) {
    const rendition = await findTerminalRendition(db, invoiceId, options)
    if (rendition) {
      return rendition.status === "ready"
        ? { status: "ready" as const, rendition }
        : { status: "failed" as const, rendition }
    }

    const remainingMs = deadline - Date.now()
    if (remainingMs <= 0) {
      return {
        status: "timeout" as const,
        rendition: await getLatestInvoiceRendition(db, invoiceId, options),
      }
    }

    await sleep(Math.min(intervalMs, remainingMs))
  }
}

export function waitFormatForMode(mode: InvoiceRenditionWaitMode) {
  return mode === "pdf" ? "pdf" : undefined
}
