import { type ActionLedgerEntry, actionLedgerService } from "@voyantjs/action-ledger"
import {
  type ActionLedgerTargetTimelinePage,
  actionLedgerTargetTimelineQuerySchema,
  buildActionLedgerTargetTimelinePage,
} from "@voyantjs/action-ledger/timeline"
import { parseQuery } from "@voyantjs/hono"
import type { Context } from "hono"
import { Hono } from "hono"
import type { z } from "zod"

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

const financeActionLedgerQuerySchema = actionLedgerTargetTimelineQuerySchema

interface FinanceActionLedgerSource {
  targetType: string
  targetId: string
  actionNames: readonly string[]
}

export type FinanceActionLedgerListResponse = ActionLedgerTargetTimelinePage

function buildFinanceActionLedgerPage({
  entries,
  limit,
}: {
  entries: ActionLedgerEntry[]
  limit: number
}) {
  return buildActionLedgerTargetTimelinePage({ entries, limit })
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
  const details = await Promise.all(
    page.data.map((entry) => actionLedgerService.getEntry(c.get("db"), entry.id)),
  )
  const summariesByActionId = new Map(
    details.flatMap((detail) =>
      detail ? [[detail.entry.id, detail.mutationDetail?.summary ?? null] as const] : [],
    ),
  )

  return c.json(
    buildActionLedgerTargetTimelinePage({
      entries: results.flatMap((result) => result.entries),
      limit,
      mutationSummariesByActionId: summariesByActionId,
    }) satisfies FinanceActionLedgerListResponse,
  )
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
