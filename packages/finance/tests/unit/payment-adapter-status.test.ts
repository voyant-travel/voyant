import {
  PAYMENT_ADAPTER_CONTRACT_VERSION,
  type PaymentAdapter,
  type PaymentStatusInput,
  type PaymentStatusResult,
} from "@voyant-travel/payments"
import { describe, expect, it, vi } from "vitest"

import { refreshPaymentSessionStatusWithAdapter } from "../../src/payment-adapter-status.js"

const lockedSession = {
  id: "ps_status_123",
  status: "requires_redirect" as const,
  provider: "netopia",
  providerConnectionId: "payment_connection_old",
  providerSessionId: "processor_session_old",
  providerPaymentId: null,
  bookingId: null,
}

describe("refreshPaymentSessionStatusWithAdapter", () => {
  it("passes the stored processor identity to adapter status after connection rotation", async () => {
    const updates: Record<string, unknown>[] = []
    const db = paymentStatusDb(updates)
    const adapter = statusAdapter(async (_context, input) => {
      expect(input).toMatchObject({
        paymentSessionId: "ps_status_123",
        processorSessionId: "processor_session_old",
        processorIdentity: {
          providerId: "netopia",
          connectionId: "payment_connection_old",
        },
      })
      return {
        nextState: "processing",
        processorSessionId: "processor_session_old",
        processorIdentity: {
          providerId: "netopia",
          connectionId: "payment_connection_old",
        },
      }
    })

    await refreshPaymentSessionStatusWithAdapter(db as never, lockedSession.id, {
      adapter,
      context: { env: {} },
      now: () => new Date("2026-07-17T00:00:00.000Z"),
    })

    expect(adapter.status).toHaveBeenCalledOnce()
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({
      status: "processing",
      provider: "netopia",
      providerConnectionId: "payment_connection_old",
      providerSessionId: "processor_session_old",
    })
  })

  it("fails closed when adapter status returns a mismatched processor identity", async () => {
    const updates: Record<string, unknown>[] = []
    const db = paymentStatusDb(updates)
    const adapter = statusAdapter(async () => ({
      nextState: "failed",
      processorSessionId: "processor_session_new",
      processorIdentity: {
        providerId: "netopia",
        connectionId: "payment_connection_new",
      },
    }))

    await expect(
      refreshPaymentSessionStatusWithAdapter(db as never, lockedSession.id, {
        adapter,
        context: { env: {} },
        now: () => new Date("2026-07-17T00:00:00.000Z"),
      }),
    ).rejects.toThrow(/processor identity/i)

    expect(adapter.status).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        processorIdentity: {
          providerId: "netopia",
          connectionId: "payment_connection_old",
        },
      }),
    )
    expect(updates).toHaveLength(0)
  })
})

function paymentStatusDb(updates: Record<string, unknown>[]) {
  return {
    select() {
      return selectQuery([lockedSession])
    },
    transaction<T>(run: (tx: unknown) => Promise<T>) {
      const tx = {
        select() {
          return {
            ...selectQuery([lockedSession]),
            for() {
              return selectQuery([lockedSession])
            },
          }
        },
        update() {
          return {
            set(values: Record<string, unknown>) {
              updates.push(values)
              return {
                where() {
                  return {
                    returning: async () => [{ ...lockedSession, ...values }],
                  }
                },
              }
            },
          }
        },
      }
      return run(tx)
    },
  }
}

function selectQuery(rows: unknown[]) {
  return {
    from() {
      return this
    },
    where() {
      return this
    },
    limit: async () => rows,
  }
}

function statusAdapter(
  status: (context: unknown, input: PaymentStatusInput) => Promise<PaymentStatusResult>,
): PaymentAdapter {
  return {
    id: "managed-payment-adapter",
    label: "Managed Payment Adapter",
    contractVersion: PAYMENT_ADAPTER_CONTRACT_VERSION,
    mode: "test",
    capabilities: {
      hostedCheckout: true,
      redirectCheckout: true,
      authorize: false,
      capture: false,
      void: false,
      refund: false,
      status: true,
      callbackSignatureVerification: true,
      idempotencyKeys: true,
      retrySafeInitiation: true,
    },
    initiate: vi.fn(async (_context, input) => ({
      nextState: "processing",
      idempotencyKey: input.idempotencyKey,
    })),
    verifyCallback: vi.fn(async () => ({ verified: false, reason: "malformed" })),
    health: vi.fn(async () => ({
      status: "ok",
      checkedAt: "2026-07-17T00:00:00.000Z",
    })),
    status: vi.fn(status),
  }
}
