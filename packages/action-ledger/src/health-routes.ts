/**
 * Action-ledger health route module, owned by `@voyant-travel/action-ledger`.
 *
 *   GET    /health         — read-only drift check (no canary write)
 *   POST   /health/check   — drift check + synthetic canary write
 *
 * The routes mount at `/v1/admin/action-ledger` via the deployment's
 * composition (the `action-ledger-health` extension).
 *
 * The package owns the route shape, the request/response contract, and its
 * own canary logic. The per-module drift checks compose results from
 * `@voyant-travel/bookings`, `@voyant-travel/finance`, and
 * `@voyant-travel/inventory` — all of which DEPEND ON action-ledger. To avoid
 * an import cycle, those drift checks are INJECTED by the deployment as
 * structurally-typed option functions; this package never imports them.
 */
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { parseJsonBody, parseQuery } from "@voyant-travel/hono"
import type { HonoExtension } from "@voyant-travel/hono/module"
import { Hono } from "hono"
import { z } from "zod"

import {
  type RunActionLedgerCanaryInput,
  type RunActionLedgerCanaryResult,
  runActionLedgerCanary,
} from "./canary.js"

/**
 * Structural drift-check input. Mirrors the shared
 * `Check{Booking,Finance,Product}ActionLedgerDriftInput` shape so the package
 * needn't import bookings/finance/inventory.
 */
export interface ActionLedgerDriftCheckInput {
  createdAtFrom?: string | null
  sampleLimit?: number | null
}

/**
 * Structural single drift-check result row. Mirrors the row shape returned by
 * each module's drift check.
 */
export interface ActionLedgerDriftCheckRow {
  check: string
  missingCount: number
  sampleIds: string[]
}

/**
 * Structural drift-check result. Mirrors the
 * `Check{Booking,Finance,Product}ActionLedgerDriftResult` shape.
 */
export interface ActionLedgerDriftCheckResult {
  ok: boolean
  rows: ActionLedgerDriftCheckRow[]
}

/**
 * A deployment-supplied per-module drift check. Structurally typed so the
 * package can compose `@voyant-travel/{bookings,finance,inventory}`'s drift
 * checks without importing them (those modules depend on action-ledger).
 */
export type ActionLedgerDriftCheck = (
  db: AnyDrizzleDb,
  input: ActionLedgerDriftCheckInput,
) => Promise<ActionLedgerDriftCheckResult>

type ActionLedgerHealthVariables = {
  db: AnyDrizzleDb
  userId?: string
  organizationId?: string
}

const actionLedgerHealthQuerySchema = z.object({
  createdAtFrom: z.string().datetime().optional(),
  sampleLimit: z.coerce.number().int().min(1).max(100).optional(),
})

const actionLedgerHealthCheckBodySchema = actionLedgerHealthQuerySchema.extend({
  organizationId: z.string().trim().min(1).optional(),
  principalId: z.string().trim().min(1).optional(),
  idempotencyKey: z.string().trim().min(1).optional(),
  payloadRef: z.string().trim().min(1).optional(),
})

export interface ActionLedgerHealthResponse {
  data: {
    ok: boolean
    canary: RunActionLedgerCanaryResult | null
    bookingDrift: ActionLedgerDriftCheckResult
    financeDrift: ActionLedgerDriftCheckResult
    productDrift: ActionLedgerDriftCheckResult
  }
}

export interface RunActionLedgerHealthCheckInput {
  db: AnyDrizzleDb
  drift: ActionLedgerDriftCheckInput
  canary?: RunActionLedgerCanaryInput | null
  runCanary: boolean
  checkBookingDrift: ActionLedgerDriftCheck
  checkFinanceDrift: ActionLedgerDriftCheck
  checkProductDrift: ActionLedgerDriftCheck
  runCanaryCheck?: (
    db: AnyDrizzleDb,
    input: RunActionLedgerCanaryInput,
  ) => Promise<RunActionLedgerCanaryResult>
}

export async function runActionLedgerHealthCheck({
  db,
  drift,
  canary,
  runCanary,
  checkBookingDrift,
  checkFinanceDrift,
  checkProductDrift,
  runCanaryCheck = runActionLedgerCanary,
}: RunActionLedgerHealthCheckInput): Promise<ActionLedgerHealthResponse["data"]> {
  const [bookingDrift, financeDrift, productDrift, canaryResult] = await Promise.all([
    checkBookingDrift(db, drift),
    checkFinanceDrift(db, drift),
    checkProductDrift(db, drift),
    runCanary ? runCanaryCheck(db, canary ?? {}) : Promise.resolve(null),
  ])

  return {
    ok: bookingDrift.ok && financeDrift.ok && productDrift.ok && (canaryResult?.ok ?? true),
    canary: canaryResult,
    bookingDrift,
    financeDrift,
    productDrift,
  }
}

/**
 * Deployment-supplied options for the action-ledger health route module.
 * Structural only — the three per-module drift checks are INJECTED so this
 * foundational package never imports bookings/finance/inventory.
 */
export interface ActionLedgerHealthRoutesOptions {
  /** Drift check from `@voyant-travel/bookings/action-ledger-drift`. */
  checkBookingDrift: ActionLedgerDriftCheck
  /** Drift check from `@voyant-travel/finance/action-ledger-drift`. */
  checkFinanceDrift: ActionLedgerDriftCheck
  /** Drift check from `@voyant-travel/inventory/action-ledger-drift`. */
  checkProductDrift: ActionLedgerDriftCheck
  /**
   * Override the canary writer (defaults to this package's
   * `runActionLedgerCanary`). Mostly for tests.
   */
  runCanaryCheck?: (
    db: AnyDrizzleDb,
    input: RunActionLedgerCanaryInput,
  ) => Promise<RunActionLedgerCanaryResult>
}

/**
 * Build the action-ledger health routes (relative paths; mount at
 * `/v1/admin/action-ledger`). The deployment injects the per-module drift
 * checks via `options`.
 */
export function createActionLedgerHealthRoutes(options: ActionLedgerHealthRoutesOptions): Hono<{
  Variables: ActionLedgerHealthVariables
}> {
  const { checkBookingDrift, checkFinanceDrift, checkProductDrift, runCanaryCheck } = options
  const hono = new Hono<{ Variables: ActionLedgerHealthVariables }>()

  hono.get("/health", async (c) => {
    const query = parseQuery(c, actionLedgerHealthQuerySchema)
    const data = await runActionLedgerHealthCheck({
      db: c.get("db"),
      drift: {
        createdAtFrom: query.createdAtFrom ?? null,
        sampleLimit: query.sampleLimit ?? null,
      },
      runCanary: false,
      checkBookingDrift,
      checkFinanceDrift,
      checkProductDrift,
      ...(runCanaryCheck ? { runCanaryCheck } : {}),
    })

    return c.json({ data } satisfies ActionLedgerHealthResponse, data.ok ? 200 : 503)
  })

  hono.post("/health/check", async (c) => {
    const body = await parseJsonBody(c, actionLedgerHealthCheckBodySchema)
    const data = await runActionLedgerHealthCheck({
      db: c.get("db"),
      drift: {
        createdAtFrom: body.createdAtFrom ?? null,
        sampleLimit: body.sampleLimit ?? null,
      },
      canary: {
        organizationId: body.organizationId ?? c.get("organizationId") ?? null,
        principalId: body.principalId ?? c.get("userId") ?? "operator-action-ledger-health",
        idempotencyKey: body.idempotencyKey ?? null,
        payloadRef: body.payloadRef ?? null,
      },
      runCanary: true,
      checkBookingDrift,
      checkFinanceDrift,
      checkProductDrift,
      ...(runCanaryCheck ? { runCanaryCheck } : {}),
    })

    return c.json({ data } satisfies ActionLedgerHealthResponse, data.ok ? 200 : 503)
  })

  return hono
}

/** Package-owned descriptor; domain-specific drift checks remain injected. */
export function createActionLedgerHealthHonoExtension(
  options: ActionLedgerHealthRoutesOptions,
): HonoExtension {
  return {
    extension: { name: "action-ledger-health", module: "action-ledger" },
    adminRoutes: createActionLedgerHealthRoutes(options),
  }
}
