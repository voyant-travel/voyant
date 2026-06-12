import { createEventBus } from "@voyantjs/core"
import { sql } from "drizzle-orm"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import {
  claimDueOutboxEvents,
  completeOutboxEvent,
  createOutboxEventStore,
  drainOutbox,
  failOutboxEvent,
  getOutboxStats,
  insertOutboxEvents,
} from "../../src/outbox.js"
import { eventOutboxTable } from "../../src/schema/infra/event_outbox.js"
import { createTestDb } from "../../src/test-utils.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
let DB_AVAILABLE = false

if (TEST_DATABASE_URL) {
  try {
    const probe = createTestDb()
    await probe.execute(/* sql */ `SELECT 1`)
    DB_AVAILABLE = true
  } catch {
    DB_AVAILABLE = false
  }
}

describe.skipIf(!DB_AVAILABLE)("event outbox", () => {
  const db = createTestDb()

  beforeAll(async () => {
    await db.execute(/* sql */ `
      CREATE TABLE IF NOT EXISTS "event_outbox" (
        "id" text PRIMARY KEY,
        "event_id" text NOT NULL,
        "name" text NOT NULL,
        "payload" jsonb,
        "metadata" jsonb,
        "status" text NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "max_attempts" integer NOT NULL DEFAULT 8,
        "next_attempt_at" timestamptz NOT NULL DEFAULT now(),
        "last_error" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "delivered_at" timestamptz
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "event_outbox_event_id_uniq" ON "event_outbox" ("event_id");
    `)
  })

  afterEach(async () => {
    await db.execute(/* sql */ `DELETE FROM "event_outbox"`)
  })

  afterAll(async () => {
    await db.execute(/* sql */ `DROP TABLE IF EXISTS "event_outbox"`)
  })

  describe("insertOutboxEvents", () => {
    it("persists envelopes and stamps eventIds when missing", async () => {
      const rows = await insertOutboxEvents(db, [
        { name: "booking.created", data: { id: "bk_1" } },
        { name: "booking.created", data: { id: "bk_2" }, metadata: { eventId: "evt_fixed" } },
      ])
      expect(rows).toHaveLength(2)
      expect(rows[0]?.eventId).toMatch(/^evt_/)
      expect(rows[1]?.eventId).toBe("evt_fixed")
      expect(rows[0]?.status).toBe("pending")
    })

    it("dedups on eventId (idempotent capture)", async () => {
      const first = await insertOutboxEvents(db, [
        { name: "x", data: { n: 1 }, metadata: { eventId: "evt_same" } },
      ])
      const second = await insertOutboxEvents(db, [
        { name: "x", data: { n: 2 }, metadata: { eventId: "evt_same" } },
      ])
      expect(first).toHaveLength(1)
      expect(second).toHaveLength(0)
    })
  })

  describe("claimDueOutboxEvents", () => {
    it("claims due rows, bumps attempts, and hides them for the visibility window", async () => {
      await insertOutboxEvents(db, [{ name: "x", data: {} }])

      const claimed = await claimDueOutboxEvents(db, { limit: 10 })
      expect(claimed).toHaveLength(1)
      expect(claimed[0]?.attempts).toBe(1)

      // Within the visibility window the row is not due → second claim empty.
      const reclaimed = await claimDueOutboxEvents(db, { limit: 10 })
      expect(reclaimed).toHaveLength(0)
    })

    it("never claims delivered or future rows", async () => {
      const [row] = await insertOutboxEvents(db, [{ name: "done", data: {} }])
      if (!row) throw new Error("insert failed")
      await completeOutboxEvent(db, row.id)
      await insertOutboxEvents(db, [
        { name: "future", data: {}, metadata: { eventId: "evt_future" } },
      ])
      await db.execute(
        // agent-quality: raw-sql reviewed -- owner: db; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
        sql`UPDATE ${eventOutboxTable} SET "next_attempt_at" = now() + interval '1 hour' WHERE "event_id" = 'evt_future'`,
      )

      const claimed = await claimDueOutboxEvents(db, { limit: 10 })
      expect(claimed).toHaveLength(0)
    })
  })

  describe("failOutboxEvent", () => {
    it("reschedules with backoff while attempts remain", async () => {
      const [row] = await insertOutboxEvents(db, [{ name: "x", data: {} }])
      if (!row) throw new Error("insert failed")
      const [claimed] = await claimDueOutboxEvents(db, { limit: 1 })
      if (!claimed) throw new Error("claim failed")

      const status = await failOutboxEvent(db, claimed.id, "boom")
      expect(status).toBe("pending")

      const stats = await getOutboxStats(db)
      expect(stats.pending).toBe(1)
      expect(stats.dueNow).toBe(0) // backoff pushed it into the future
    })

    it("dead-letters once attempts exhaust max_attempts", async () => {
      const [row] = await insertOutboxEvents(db, [{ name: "x", data: {} }])
      if (!row) throw new Error("insert failed")
      await db.execute(
        // agent-quality: raw-sql reviewed -- owner: db; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
        sql`UPDATE ${eventOutboxTable} SET "attempts" = "max_attempts" WHERE ${eventOutboxTable.id} = ${row.id}`,
      )

      const status = await failOutboxEvent(db, row.id, "final straw")
      expect(status).toBe("failed")
      const stats = await getOutboxStats(db)
      expect(stats.failed).toBe(1)
    })
  })

  describe("drainOutbox", () => {
    it("delivers claimed rows through the bus and completes them", async () => {
      const bus = createEventBus()
      const handler = vi.fn()
      bus.subscribe("booking.created", handler)
      await insertOutboxEvents(db, [
        { name: "booking.created", data: { id: "bk_9" }, metadata: { eventId: "evt_d1" } },
      ])

      const result = await drainOutbox(db, bus)

      expect(result).toEqual({ claimed: 1, delivered: 1, retried: 0, deadLettered: 0 })
      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "booking.created",
          data: { id: "bk_9" },
          metadata: expect.objectContaining({ eventId: "evt_d1" }),
        }),
      )
      const stats = await getOutboxStats(db)
      expect(stats.delivered).toBe(1)
    })

    it("reschedules rows whose subscribers fail", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      const bus = createEventBus()
      bus.subscribe("x", () => {
        throw new Error("subscriber down")
      })
      await insertOutboxEvents(db, [{ name: "x", data: {} }])

      const result = await drainOutbox(db, bus)

      expect(result).toEqual({ claimed: 1, delivered: 0, retried: 1, deadLettered: 0 })
      const stats = await getOutboxStats(db)
      expect(stats.pending).toBe(1)
      errorSpy.mockRestore()
    })

    it("returns an empty result when nothing is due", async () => {
      const result = await drainOutbox(db, createEventBus())
      expect(result).toEqual({ claimed: 0, delivered: 0, retried: 0, deadLettered: 0 })
    })
  })

  describe("createOutboxEventStore (durable emit end-to-end)", () => {
    it("emit persists, delivers, and completes; duplicate emits capture once", async () => {
      const bus = createEventBus()
      const handler = vi.fn()
      bus.subscribe("invoice.issued", handler)
      const store = createOutboxEventStore(() => db)

      await bus.emit("invoice.issued", { id: "inv_1" }, { eventId: "evt_e2e" }, { store })
      await bus.emit("invoice.issued", { id: "inv_1" }, { eventId: "evt_e2e" }, { store })

      expect(handler).toHaveBeenCalledOnce()
      const stats = await getOutboxStats(db)
      expect(stats.delivered).toBe(1)
      expect(stats.pending).toBe(0)
    })

    it("a failed delivery leaves a pending row that a later drain redelivers", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      const bus = createEventBus()
      let attempts = 0
      bus.subscribe("flaky.event", () => {
        attempts += 1
        if (attempts === 1) throw new Error("first attempt fails")
      })
      const store = createOutboxEventStore(() => db)

      await bus.emit("flaky.event", {}, undefined, { store })
      expect((await getOutboxStats(db)).pending).toBe(1)

      // Make the backoff-delayed row due now, then drain.
      // agent-quality: raw-sql reviewed -- owner: db; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      await db.execute(sql`UPDATE ${eventOutboxTable} SET "next_attempt_at" = now()`)
      const result = await drainOutbox(db, bus)

      expect(result.delivered).toBe(1)
      expect(attempts).toBe(2)
      expect((await getOutboxStats(db)).delivered).toBe(1)
      errorSpy.mockRestore()
    })
  })
})
