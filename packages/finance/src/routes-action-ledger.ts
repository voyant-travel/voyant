import {
  type ActionLedgerEntry,
  type ActionLedgerEntryResponse,
  actionLedgerService,
} from "@voyantjs/action-ledger"
import { parseQuery } from "@voyantjs/hono"
import type { Context } from "hono"
import { Hono } from "hono"
import { z } from "zod"

import type { Env } from "./routes-shared.js"
import { financeService } from "./service.js"

const FINANCE_INVOICE_LEDGER_ACTION_NAMES = [
  "finance.invoice.issue_from_booking",
  "finance.invoice.update",
  "finance.invoice.delete",
  "finance.invoice_line_item.create",
  "finance.invoice_line_item.update",
  "finance.invoice_line_item.delete",
  "finance.credit_note.create",
  "finance.credit_note.update",
  "finance.credit_note_line_item.create",
  "finance.payment.record",
  "finance.payment_session.create",
  "finance.payment_session.complete",
  "finance.payment_session.update",
  "finance.payment_session.requires_redirect",
  "finance.payment_session.fail",
  "finance.payment_session.cancel",
  "finance.payment_session.expire",
  "finance.payment_authorization.create",
  "finance.payment_authorization.update",
  "finance.payment_authorization.delete",
  "finance.payment_capture.create",
  "finance.payment_capture.update",
  "finance.payment_capture.delete",
]

const FINANCE_PAYMENT_SESSION_LEDGER_ACTION_NAMES = [
  "finance.payment_session.create",
  "finance.payment_session.complete",
  "finance.payment_session.update",
  "finance.payment_session.requires_redirect",
  "finance.payment_session.fail",
  "finance.payment_session.cancel",
  "finance.payment_session.expire",
]

const financeActionLedgerQuerySchema = z
  .object({
    cursorOccurredAt: z.string().datetime().optional(),
    cursorId: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(199).optional(),
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.cursorOccurredAt) === Boolean(value.cursorId)) return

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: value.cursorOccurredAt ? ["cursorId"] : ["cursorOccurredAt"],
      message: "cursorOccurredAt and cursorId must be provided together",
    })
  })
  .transform(({ cursorOccurredAt, cursorId, ...query }) => ({
    ...query,
    cursor:
      cursorOccurredAt && cursorId
        ? {
            occurredAt: cursorOccurredAt,
            id: cursorId,
          }
        : undefined,
  }))

interface FinanceActionLedgerSource {
  targetType: string
  targetId: string
  actionNames: readonly string[]
}

export interface FinanceActionLedgerListResponse {
  data: ActionLedgerEntryResponse[]
  pageInfo: {
    nextCursor: {
      occurredAt: string
      id: string
    } | null
  }
}

function serializeFinanceActionLedgerDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error("Finance action ledger timestamp must be a valid date")
  }
  return date.toISOString()
}

function serializeFinanceActionLedgerEntry(entry: ActionLedgerEntry): ActionLedgerEntryResponse {
  return {
    ...entry,
    occurredAt: serializeFinanceActionLedgerDate(entry.occurredAt),
    createdAt: serializeFinanceActionLedgerDate(entry.createdAt),
  }
}

function toFinanceActionLedgerCursor(entry: Pick<ActionLedgerEntry, "occurredAt" | "id">) {
  return {
    occurredAt: serializeFinanceActionLedgerDate(entry.occurredAt),
    id: entry.id,
  }
}

function sortFinanceActionLedgerEntries(entries: ActionLedgerEntry[]) {
  return [...entries].sort((a, b) => {
    const occurredAtDelta = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    if (occurredAtDelta !== 0) return occurredAtDelta
    return b.id.localeCompare(a.id)
  })
}

function buildFinanceActionLedgerPage({
  entries,
  limit,
}: {
  entries: ActionLedgerEntry[]
  limit: number
}) {
  const entriesById = new Map<string, ActionLedgerEntry>()
  for (const entry of entries) {
    entriesById.set(entry.id, entry)
  }

  const sortedEntries = sortFinanceActionLedgerEntries([...entriesById.values()])
  const visibleEntries = sortedEntries.slice(0, limit)
  const lastEntry = visibleEntries.at(-1)
  const nextCursor =
    sortedEntries.length > limit && lastEntry ? toFinanceActionLedgerCursor(lastEntry) : null

  return {
    entries: visibleEntries,
    nextCursor,
  }
}

function getPaymentSessionLedgerTarget(session: {
  id: string
  bookingId: string | null
  invoiceId: string | null
  orderId: string | null
  targetType: string
  targetId: string | null
}) {
  if (session.bookingId) return { type: "booking", id: session.bookingId }
  if (session.invoiceId) return { type: "invoice", id: session.invoiceId }
  if (session.orderId) return { type: "order", id: session.orderId }
  if (session.targetId && session.targetType !== "other") {
    return { type: session.targetType, id: session.targetId }
  }
  return { type: "payment_session", id: session.id }
}

function dedupeFinanceActionLedgerSources(sources: FinanceActionLedgerSource[]) {
  const sourcesByKey = new Map<string, FinanceActionLedgerSource>()
  for (const source of sources) {
    const key = `${source.targetType}:${source.targetId}:${source.actionNames.join(",")}`
    sourcesByKey.set(key, source)
  }
  return [...sourcesByKey.values()]
}

async function listFinanceActionLedgerPage(
  c: Context<Env>,
  sources: FinanceActionLedgerSource[],
  query: z.infer<typeof financeActionLedgerQuerySchema>,
) {
  const limit = query.limit ?? 50
  const queryLimit = limit + 1
  const sourceQueries = dedupeFinanceActionLedgerSources(sources).flatMap((source) =>
    source.actionNames.map((actionName) => ({
      targetType: source.targetType,
      targetId: source.targetId,
      actionName,
    })),
  )

  const results = await Promise.all(
    sourceQueries.map((source) =>
      actionLedgerService.listEntries(c.get("db"), {
        ...source,
        cursor: query.cursor,
        limit: queryLimit,
      }),
    ),
  )
  const page = buildFinanceActionLedgerPage({
    entries: results.flatMap((result) => result.entries),
    limit,
  })

  return c.json({
    data: page.entries.map(serializeFinanceActionLedgerEntry),
    pageInfo: {
      nextCursor: page.nextCursor,
    },
  } satisfies FinanceActionLedgerListResponse)
}

async function listInvoiceActionLedger(c: Context<Env>) {
  const invoiceId = c.req.param("id")
  if (!invoiceId) return c.json({ error: "Invoice not found" }, 404)

  const invoice = await financeService.getInvoiceById(c.get("db"), invoiceId)
  if (!invoice) return c.json({ error: "Invoice not found" }, 404)

  const query = parseQuery(c, financeActionLedgerQuerySchema)
  const sources: FinanceActionLedgerSource[] = [
    {
      targetType: "invoice",
      targetId: invoice.id,
      actionNames: FINANCE_INVOICE_LEDGER_ACTION_NAMES,
    },
  ]
  if (invoice.bookingId) {
    sources.push({
      targetType: "booking",
      targetId: invoice.bookingId,
      actionNames: FINANCE_INVOICE_LEDGER_ACTION_NAMES,
    })
  }

  return listFinanceActionLedgerPage(c, sources, query)
}

async function listPaymentSessionActionLedger(c: Context<Env>) {
  const paymentSessionId = c.req.param("id")
  if (!paymentSessionId) return c.json({ error: "Payment session not found" }, 404)

  const session = await financeService.getPaymentSessionById(c.get("db"), paymentSessionId)
  if (!session) return c.json({ error: "Payment session not found" }, 404)

  const target = getPaymentSessionLedgerTarget(session)
  const query = parseQuery(c, financeActionLedgerQuerySchema)

  return listFinanceActionLedgerPage(
    c,
    [
      {
        targetType: target.type,
        targetId: target.id,
        actionNames: FINANCE_PAYMENT_SESSION_LEDGER_ACTION_NAMES,
      },
      {
        targetType: "payment_session",
        targetId: session.id,
        actionNames: FINANCE_PAYMENT_SESSION_LEDGER_ACTION_NAMES,
      },
    ],
    query,
  )
}

export const financeActionLedgerRoutes = new Hono<Env>()
  .get("/invoices/:id/action-ledger", listInvoiceActionLedger)
  .get("/payment-sessions/:id/action-ledger", listPaymentSessionActionLedger)

export type FinanceActionLedgerRoutes = typeof financeActionLedgerRoutes

export const __test__ = {
  buildFinanceActionLedgerPage,
  financeActionLedgerQuerySchema,
  getPaymentSessionLedgerTarget,
}
