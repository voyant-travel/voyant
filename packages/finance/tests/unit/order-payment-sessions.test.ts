import { describe, expect, it, vi } from "vitest"

import { createOrderPaymentSessions } from "../../src/order-payment-sessions.js"
import { financeService } from "../../src/service.js"
import type { PostgresJsDatabase } from "../../src/service-shared.js"

type SessionRow = {
  id: string
  targetId: string | null
  status: string
  createdAt: Date
}

/**
 * Minimal drizzle stub: `.select(...).from(...).where(...).orderBy(...)`
 * resolves to the provided rows. The order-payment-sessions service only ever
 * issues this single read shape (both ensure + fetch), so a thenable terminator
 * on `orderBy` is enough.
 */
function stubDb(rows: SessionRow[]): PostgresJsDatabase {
  const query = {
    from: () => query,
    where: () => query,
    orderBy: () => Promise.resolve(rows),
  }
  return { select: () => query } as PostgresJsDatabase
}

describe("createOrderPaymentSessions", () => {
  const sessions = createOrderPaymentSessions({ targetType: "flight_order" })

  describe("ensureSession", () => {
    it("returns the most recent non-terminal session as the live link", async () => {
      const db = stubDb([
        { id: "ps_live", targetId: "ord_1", status: "pending", createdAt: new Date(2) },
        { id: "ps_old", targetId: "ord_1", status: "paid", createdAt: new Date(1) },
      ])
      const create = vi.spyOn(financeService, "createPaymentSession")

      const result = await sessions.ensureSession(db, {
        targetId: "ord_1",
        currency: "RON",
        amountCents: 10000,
      })

      expect(result).toEqual({ sessionId: "ps_live", status: "pending" })
      expect(create).not.toHaveBeenCalled()
      create.mockRestore()
    })

    it("falls back to a paid/authorized session from history when no live session", async () => {
      // Latest session is terminal-but-settled (paid): no live link, but the
      // settled fallback surfaces it rather than creating a new session.
      const db = stubDb([
        { id: "ps_paid", targetId: "ord_1", status: "paid", createdAt: new Date(2) },
      ])
      const create = vi.spyOn(financeService, "createPaymentSession")

      const result = await sessions.ensureSession(db, {
        targetId: "ord_1",
        currency: "RON",
        amountCents: 10000,
      })

      expect(result).toEqual({ sessionId: "ps_paid", status: "paid" })
      expect(create).not.toHaveBeenCalled()
      create.mockRestore()
    })

    it("creates a pending session when none exists and starts the provider", async () => {
      const db = stubDb([])
      const create = vi
        .spyOn(financeService, "createPaymentSession")
        .mockResolvedValue({ id: "ps_new", status: "pending" } as never)
      const startProvider = vi.fn().mockResolvedValue(undefined)

      const result = await sessions.ensureSession(
        db,
        {
          targetId: "ord_2",
          currency: "EUR",
          amountCents: 25000,
          payerEmail: "a@b.com",
          payerName: "Ada Lovelace",
          notes: "LON -> CDG",
        },
        startProvider,
      )

      expect(result).toEqual({ sessionId: "ps_new", status: "pending" })
      expect(create).toHaveBeenCalledWith(
        db,
        expect.objectContaining({
          targetType: "flight_order",
          targetId: "ord_2",
          currency: "EUR",
          amountCents: 25000,
          status: "pending",
          // Provider-agnostic by default: the injected starter claims the
          // session on start (Netopia sets provider on its redirect step).
          provider: null,
          paymentMethod: null,
          payerEmail: "a@b.com",
          payerName: "Ada Lovelace",
          notes: "LON -> CDG",
        }),
      )
      expect(startProvider).toHaveBeenCalledWith(db, "ps_new")
      create.mockRestore()
    })

    it("stamps provider/paymentMethod when the instance opts in", async () => {
      const stamped = createOrderPaymentSessions({
        targetType: "flight_order",
        provider: "stripe",
        paymentMethod: "credit_card",
      })
      const db = stubDb([])
      const create = vi
        .spyOn(financeService, "createPaymentSession")
        .mockResolvedValue({ id: "ps_s", status: "pending" } as never)

      await stamped.ensureSession(db, { targetId: "ord_9", currency: "EUR", amountCents: 1000 })

      expect(create).toHaveBeenCalledWith(
        db,
        expect.objectContaining({ provider: "stripe", paymentMethod: "credit_card" }),
      )
      create.mockRestore()
    })

    it("lets a session request override the instance paymentMethod", async () => {
      const stamped = createOrderPaymentSessions({
        targetType: "flight_order",
        paymentMethod: "credit_card",
      })
      const db = stubDb([])
      const create = vi
        .spyOn(financeService, "createPaymentSession")
        .mockResolvedValue({ id: "ps_bt", status: "pending" } as never)

      await stamped.ensureSession(db, {
        targetId: "ord_bt",
        currency: "EUR",
        amountCents: 1000,
        paymentMethod: "bank_transfer",
      })

      expect(create).toHaveBeenCalledWith(
        db,
        expect.objectContaining({ paymentMethod: "bank_transfer" }),
      )
      create.mockRestore()
    })

    it("swallows provider start failures (best-effort)", async () => {
      const db = stubDb([])
      const create = vi
        .spyOn(financeService, "createPaymentSession")
        .mockResolvedValue({ id: "ps_new", status: "pending" } as never)
      const startProvider = vi.fn().mockRejectedValue(new Error("netopia down"))

      const result = await sessions.ensureSession(
        db,
        { targetId: "ord_3", currency: "RON", amountCents: 100 },
        startProvider,
      )

      expect(result).toEqual({ sessionId: "ps_new", status: "pending" })
      create.mockRestore()
    })

    it("returns null when amount is non-positive and no session exists", async () => {
      const db = stubDb([])
      const create = vi.spyOn(financeService, "createPaymentSession")

      const result = await sessions.ensureSession(db, {
        targetId: "ord_4",
        currency: "RON",
        amountCents: 0,
      })

      expect(result).toBeNull()
      expect(create).not.toHaveBeenCalled()
      create.mockRestore()
    })
  })

  describe("fetchSessions", () => {
    it("returns an empty map for no ids", async () => {
      const db = stubDb([])
      const result = await sessions.fetchSessions(db, [])
      expect(result.size).toBe(0)
    })

    it("prefers the most recent non-terminal session, else latest terminal", async () => {
      const db = stubDb([
        // ord_1: live pending wins over older paid
        { id: "ps_1_live", targetId: "ord_1", status: "pending", createdAt: new Date(3) },
        { id: "ps_1_old", targetId: "ord_1", status: "paid", createdAt: new Date(1) },
        // ord_2: only terminal sessions — falls back to latest
        { id: "ps_2_latest", targetId: "ord_2", status: "failed", createdAt: new Date(2) },
        { id: "ps_2_older", targetId: "ord_2", status: "cancelled", createdAt: new Date(1) },
      ])

      const result = await sessions.fetchSessions(db, ["ord_1", "ord_2"])

      expect(result.get("ord_1")).toEqual({ sessionId: "ps_1_live", status: "pending" })
      expect(result.get("ord_2")).toEqual({ sessionId: "ps_2_latest", status: "failed" })
    })
  })
})
