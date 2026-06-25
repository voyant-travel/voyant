/**
 * Admin finance action-ledger read routes — mounted by the operator starter
 * under `/v1/admin/finance/...` (staff-actor-gated by the parent app's
 * middleware chain). Two reads: the action-ledger timeline for an invoice (and
 * its booking) and for a payment session (and its resolved target).
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114 /
 * voyant#2208 — finance sub-batch 9E). The cursor-pagination query reuses
 * `actionLedgerTargetTimelineQuerySchema` from `@voyant-travel/action-ledger`;
 * the response schema is authored from the `ActionLedgerTargetTimelinePage`
 * shape (serialized action-ledger entries — §17: `occurredAt`/`createdAt` are
 * ISO strings — plus the joined `mutationSummary` and the `pageInfo.nextCursor`
 * timeline cursor). The two legs are a single small `OpenAPIHono` whose
 * `.openapi()` operations propagate up through the parent admin registry.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { type ActionLedgerEntry, actionLedgerService } from "@voyant-travel/action-ledger"
import {
  type ActionLedgerTargetTimelinePage,
  actionLedgerTargetTimelineQuerySchema,
  buildActionLedgerTargetTimelinePage,
} from "@voyant-travel/action-ledger/timeline"
import { openApiValidationHook, parseQuery } from "@voyant-travel/hono"
import type { Context } from "hono"

import type { Env } from "./routes-shared.js"
import { financeService } from "./service.js"

const errorResponseSchema = z.object({ error: z.string() })

/** §17: `occurredAt`/`createdAt` serialize to ISO strings over the wire. */
const isoString = z.string()

const actionLedgerPrincipalTypeValues = ["user", "api_key", "agent", "workflow", "system"] as const

/**
 * A serialized action-ledger timeline entry (authored from the
 * `ActionLedgerSerializedEntry` shape + the joined `mutationSummary`). The text
 * principal/caller/correlation columns are nullable strings; the enum columns
 * use their declared values.
 */
const actionLedgerTimelineEntrySchema = z.object({
  id: z.string(),
  occurredAt: isoString,
  actionName: z.string(),
  actionVersion: z.string(),
  actionKind: z.enum([
    "read",
    "create",
    "update",
    "delete",
    "execute",
    "approve",
    "reject",
    "reverse",
    "compensate",
    "duplicate",
  ]),
  status: z.enum([
    "requested",
    "awaiting_approval",
    "approved",
    "denied",
    "succeeded",
    "failed",
    "reversed",
    "compensated",
    "expired",
    "cancelled",
    "superseded",
  ]),
  evaluatedRisk: z.enum(["low", "medium", "high", "critical"]),
  actorType: z.string().nullable(),
  principalType: z.enum(actionLedgerPrincipalTypeValues),
  principalId: z.string(),
  principalSubtype: z.string().nullable(),
  sessionId: z.string().nullable(),
  apiTokenId: z.string().nullable(),
  internalRequest: z.boolean(),
  delegatedByPrincipalType: z.enum(actionLedgerPrincipalTypeValues).nullable(),
  delegatedByPrincipalId: z.string().nullable(),
  delegationId: z.string().nullable(),
  callerType: z.string().nullable(),
  organizationId: z.string().nullable(),
  routeOrToolName: z.string().nullable(),
  workflowRunId: z.string().nullable(),
  workflowStepId: z.string().nullable(),
  correlationId: z.string().nullable(),
  causationActionId: z.string().nullable(),
  idempotencyScope: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  idempotencyFingerprint: z.string().nullable(),
  targetType: z.string(),
  targetId: z.string(),
  capabilityId: z.string().nullable(),
  capabilityVersion: z.string().nullable(),
  authorizationSource: z.string().nullable(),
  approvalId: z.string().nullable(),
  amendsActionId: z.string().nullable(),
  createdAt: isoString,
  // Joined in by `buildActionLedgerTargetTimelinePage`.
  mutationSummary: z.string().nullable(),
})

const actionLedgerTimelinePageSchema = z.object({
  data: z.array(actionLedgerTimelineEntrySchema),
  pageInfo: z.object({
    nextCursor: z.object({ occurredAt: isoString, id: z.string() }).nullable(),
  }),
})

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
    200,
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

const invoiceActionLedgerRoute = createRoute({
  method: "get",
  path: "/invoices/{id}/action-ledger",
  request: { params: z.object({ id: z.string() }), query: actionLedgerTargetTimelineQuerySchema },
  responses: {
    200: {
      description: "The invoice's (and its booking's) action-ledger timeline page",
      content: { "application/json": { schema: actionLedgerTimelinePageSchema } },
    },
    404: {
      description: "Invoice not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

const paymentSessionActionLedgerRoute = createRoute({
  method: "get",
  path: "/payment-sessions/{id}/action-ledger",
  request: { params: z.object({ id: z.string() }), query: actionLedgerTargetTimelineQuerySchema },
  responses: {
    200: {
      description: "The payment session's (and its target's) action-ledger timeline page",
      content: { "application/json": { schema: actionLedgerTimelinePageSchema } },
    },
    404: {
      description: "Payment session not found",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
})

export const financeActionLedgerRoutes = new OpenAPIHono<Env>({
  defaultHook: openApiValidationHook,
})
  .openapi(invoiceActionLedgerRoute, listInvoiceActionLedger)
  .openapi(paymentSessionActionLedgerRoute, listPaymentSessionActionLedger)

export type FinanceActionLedgerRoutes = typeof financeActionLedgerRoutes

export const __test__ = {
  buildFinanceActionLedgerPage,
  financeActionLedgerQuerySchema,
  getPaymentSessionLedgerTarget,
}
