import {
  type RunActionLedgerCanaryInput,
  type RunActionLedgerCanaryResult,
  runActionLedgerCanary,
} from "@voyantjs/action-ledger/canary"
import {
  type CheckBookingActionLedgerDriftInput,
  type CheckBookingActionLedgerDriftResult,
  checkBookingActionLedgerDrift,
} from "@voyantjs/bookings/action-ledger-drift"
import type { AnyDrizzleDb } from "@voyantjs/db"
import {
  type CheckFinanceActionLedgerDriftInput,
  type CheckFinanceActionLedgerDriftResult,
  checkFinanceActionLedgerDrift,
} from "@voyantjs/finance/action-ledger-drift"
import { parseJsonBody, parseQuery } from "@voyantjs/hono"
import {
  type CheckProductActionLedgerDriftInput,
  type CheckProductActionLedgerDriftResult,
  checkProductActionLedgerDrift,
} from "@voyantjs/inventory/action-ledger-drift"
import type { Hono } from "hono"
import { z } from "zod"

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
    bookingDrift: CheckBookingActionLedgerDriftResult
    financeDrift: CheckFinanceActionLedgerDriftResult
    productDrift: CheckProductActionLedgerDriftResult
  }
}

export interface RunOperatorActionLedgerHealthCheckInput {
  db: AnyDrizzleDb
  drift: CheckBookingActionLedgerDriftInput &
    CheckFinanceActionLedgerDriftInput &
    CheckProductActionLedgerDriftInput
  canary?: RunActionLedgerCanaryInput | null
  runCanary: boolean
  checkBookingDrift?: (
    db: AnyDrizzleDb,
    input: CheckBookingActionLedgerDriftInput,
  ) => Promise<CheckBookingActionLedgerDriftResult>
  checkFinanceDrift?: (
    db: AnyDrizzleDb,
    input: CheckFinanceActionLedgerDriftInput,
  ) => Promise<CheckFinanceActionLedgerDriftResult>
  checkProductDrift?: (
    db: AnyDrizzleDb,
    input: CheckProductActionLedgerDriftInput,
  ) => Promise<CheckProductActionLedgerDriftResult>
  runCanaryCheck?: (
    db: AnyDrizzleDb,
    input: RunActionLedgerCanaryInput,
  ) => Promise<RunActionLedgerCanaryResult>
}

export async function runOperatorActionLedgerHealthCheck({
  db,
  drift,
  canary,
  runCanary,
  checkBookingDrift = checkBookingActionLedgerDrift,
  checkFinanceDrift = checkFinanceActionLedgerDrift,
  checkProductDrift = checkProductActionLedgerDrift,
  runCanaryCheck = runActionLedgerCanary,
}: RunOperatorActionLedgerHealthCheckInput): Promise<ActionLedgerHealthResponse["data"]> {
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

export function mountActionLedgerHealthRoutes(
  hono: Hono<{ Variables: ActionLedgerHealthVariables }>,
): void {
  hono.get("/v1/admin/action-ledger/health", async (c) => {
    const query = parseQuery(c, actionLedgerHealthQuerySchema)
    const data = await runOperatorActionLedgerHealthCheck({
      db: c.get("db"),
      drift: {
        createdAtFrom: query.createdAtFrom ?? null,
        sampleLimit: query.sampleLimit ?? null,
      },
      runCanary: false,
    })

    return c.json({ data } satisfies ActionLedgerHealthResponse, data.ok ? 200 : 503)
  })

  hono.post("/v1/admin/action-ledger/health/check", async (c) => {
    const body = await parseJsonBody(c, actionLedgerHealthCheckBodySchema)
    const data = await runOperatorActionLedgerHealthCheck({
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
    })

    return c.json({ data } satisfies ActionLedgerHealthResponse, data.ok ? 200 : 503)
  })
}
