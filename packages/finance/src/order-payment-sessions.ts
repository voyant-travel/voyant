/**
 * Generic order payment-session orchestration.
 *
 * Finance owns the `payment_sessions` table, so the "ensure a live session for
 * an external order, else reuse paid history, else create one and best-effort
 * start the provider" pattern lives here — generic over `targetType` rather than
 * baked into any one caller (flights, etc.). The caller maps its domain object
 * to the small `EnsureOrderSessionParams` shape and supplies an optional
 * provider-start callback.
 *
 * This module imports NO upstream module (flights/bookings/etc.) — it only
 * touches finance's own schema + service. Callers depend on finance; finance
 * never depends on them.
 */
import { and, desc, eq, inArray } from "drizzle-orm"

import { paymentSessions } from "./schema.js"
import { financeService } from "./service.js"
import type { CreatePaymentSessionInput, PostgresJsDatabase } from "./service-shared.js"

/** Target types finance recognises for external order payment sessions. */
export type OrderPaymentSessionTargetType = CreatePaymentSessionInput["targetType"]

/** A resolved payment session for an external order. */
export interface OrderPaymentSessionSummary {
  sessionId: string
  status: string
}

/** Parameters the caller maps from its domain object to create/find a session. */
export interface EnsureOrderSessionParams {
  /** The external order id (becomes `payment_sessions.target_id`). */
  targetId: string
  /** ISO 4217 currency code. */
  currency: string
  /** Amount in minor units (cents). A non-positive amount short-circuits. */
  amountCents: number
  /** Payer email for the session, when known. */
  payerEmail?: string | null
  /** Payer display name for the session, when known. */
  payerName?: string | null
  /** Human summary surfaced as `payment_sessions.notes`. */
  notes?: string | null
}

/**
 * Best-effort provider start hook. Called after a session is created so the
 * provider can populate `redirectUrl`. Failures are swallowed (logged) — the
 * session still exists for non-card payment paths.
 */
export type StartOrderPaymentProvider = (db: PostgresJsDatabase, sessionId: string) => Promise<void>

/** Statuses that are terminal/dead for "is there a live session?" purposes. */
const TERMINAL_STATUSES = ["failed", "expired", "cancelled"]
/** Statuses worth surfacing from history even when no live session exists. */
const SETTLED_STATUSES = ["paid", "authorized"]

export interface OrderPaymentSessions {
  /**
   * Ensure (idempotently) a payment session exists for an external order.
   *
   * Precedence: the most recent non-terminal session (a live link) wins; else a
   * paid/authorized session from history; else create a fresh `pending` session
   * via `financeService.createPaymentSession` and optionally start the provider.
   * Returns `null` when the amount is non-positive.
   */
  ensureSession(
    db: PostgresJsDatabase,
    params: EnsureOrderSessionParams,
    startProvider?: StartOrderPaymentProvider,
  ): Promise<OrderPaymentSessionSummary | null>
  /**
   * Bulk-resolve the most relevant session per order id (no N+1). Two passes:
   * first the most recent non-terminal session per order, then fall back to the
   * latest (terminal) session for status.
   */
  fetchSessions(
    db: PostgresJsDatabase,
    targetIds: string[],
  ): Promise<Map<string, OrderPaymentSessionSummary>>
}

export interface CreateOrderPaymentSessionsOptions {
  /** The `payment_sessions.target_type` this instance scopes all reads/writes to. */
  targetType: OrderPaymentSessionTargetType
  /**
   * Provider to stamp on newly-created sessions. Defaults to `null` (no provider)
   * so the session stays provider-agnostic — the injected `startProvider` claims
   * it when it runs (e.g. Netopia sets `provider: "netopia"` on start). Set this
   * only when the deployment wants the provider recorded up front. Never hard-code
   * a provider here: that would mislabel Stripe/Adyen/bank-transfer deployments.
   */
  provider?: string | null
  /**
   * Payment method to stamp on newly-created sessions. Defaults to `null` (unset)
   * until a payment path is chosen.
   */
  paymentMethod?: CreatePaymentSessionInput["paymentMethod"] | null
}

/**
 * Build an {@link OrderPaymentSessions} bound to a single `targetType`
 * (e.g. `"flight_order"`). All queries are scoped to that target type.
 */
export function createOrderPaymentSessions(
  options: CreateOrderPaymentSessionsOptions,
): OrderPaymentSessions {
  const { targetType, provider = null, paymentMethod = null } = options

  return {
    async ensureSession(db, params, startProvider) {
      // Prefer the most recent non-terminal session for this order so the UI
      // surfaces a live link; fall back to paid/authorized history.
      const existing = await db
        .select()
        .from(paymentSessions)
        .where(
          and(
            eq(paymentSessions.targetId, params.targetId),
            eq(paymentSessions.targetType, targetType),
          ),
        )
        .orderBy(desc(paymentSessions.createdAt))
      const live = existing.find((row) => !TERMINAL_STATUSES.includes(row.status))
      if (live) return { sessionId: live.id, status: live.status }
      const latest = existing[0]
      if (latest && SETTLED_STATUSES.includes(latest.status)) {
        return { sessionId: latest.id, status: latest.status }
      }

      if (params.amountCents <= 0) return null

      const session = await financeService.createPaymentSession(db, {
        targetType,
        targetId: params.targetId,
        currency: params.currency,
        amountCents: params.amountCents,
        status: "pending",
        provider,
        paymentMethod,
        payerEmail: params.payerEmail ?? null,
        payerName: params.payerName ?? null,
        notes: params.notes ?? null,
      })
      if (!session) return null

      // Start the provider so `redirectUrl` is populated for the landing page's
      // card tab. Best-effort — other payment paths still work if it fails.
      if (startProvider) {
        try {
          await startProvider(db, session.id)
        } catch (err) {
          console.warn("[finance] order payment provider start failed:", err)
        }
      }

      return { sessionId: session.id, status: session.status }
    },

    async fetchSessions(db, targetIds) {
      const result = new Map<string, OrderPaymentSessionSummary>()
      if (targetIds.length === 0) return result
      const rows = await db
        .select({
          id: paymentSessions.id,
          targetId: paymentSessions.targetId,
          status: paymentSessions.status,
          createdAt: paymentSessions.createdAt,
        })
        .from(paymentSessions)
        .where(
          and(
            eq(paymentSessions.targetType, targetType),
            inArray(paymentSessions.targetId, targetIds),
          ),
        )
        .orderBy(desc(paymentSessions.createdAt))

      // First pass — most recent non-terminal session per order.
      for (const row of rows) {
        if (!row.targetId || result.has(row.targetId)) continue
        if (!TERMINAL_STATUSES.includes(row.status)) {
          result.set(row.targetId, { sessionId: row.id, status: row.status })
        }
      }
      // Second pass — fall back to the latest (terminal) session for status.
      for (const row of rows) {
        if (!row.targetId || result.has(row.targetId)) continue
        result.set(row.targetId, { sessionId: row.id, status: row.status })
      }
      return result
    },
  }
}
