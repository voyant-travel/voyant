import { describe, expect, it } from "vitest"

import {
  createInMemoryBookingSessionRepository,
  createInMemoryOwnedInventoryPorts,
} from "./sessions-memory.js"
import { createBookingSessionModule } from "./sessions-service.js"

const BASE_PRICING = {
  currency: "EUR",
  lines: [
    { kind: "base" as const, label: "Adult", quantity: 1, unitAmount: 10000, totalAmount: 10000 },
  ],
  taxes: [],
  subtotal: 10000,
  taxTotal: 0,
  total: 10000,
}

function createHarness() {
  let currentNow = new Date("2026-08-01T12:00:00.000Z")
  let price = BASE_PRICING
  const repository = createInMemoryBookingSessionRepository()
  const inventory = createInMemoryOwnedInventoryPorts()
  inventory.setCapacity("product:prod_owned_1", 1)
  const module = createBookingSessionModule({
    now: () => currentNow,
    quoteTtlMs: 5 * 60_000,
    holdTtlMs: 60_000,
    ports: {
      repository,
      composeQuote: async () => price,
      placeCapacityHold: inventory.placeCapacityHold,
      commitOwnedBooking: inventory.commitOwnedBooking,
    },
  })
  return {
    module,
    repository,
    inventory,
    advance(ms: number) {
      currentNow = new Date(currentNow.getTime() + ms)
    },
    setPrice(next: typeof BASE_PRICING) {
      price = next
    },
  }
}

async function createQuoteAndHold(harness = createHarness()) {
  const created = await harness.module.createSession({
    target: { kind: "product", productId: "prod_owned_1" },
  })
  if (created.kind !== "session_created") throw new Error("session not created")
  const quoted = await harness.module.quoteSession(created.session.id, {
    capability: created.session.capability,
    expectedRevision: created.session.revision,
    idempotencyKey: "quote_key",
  })
  if (quoted.kind !== "quote_created") throw new Error("quote not created")
  const held = await harness.module.placeHold(created.session.id, {
    capability: created.session.capability,
    expectedRevision: created.session.revision,
    quoteId: quoted.quote.id,
    idempotencyKey: "hold_key",
  })
  if (held.kind !== "hold_created") throw new Error("hold not created")
  return { harness, session: created.session, quote: quoted.quote, hold: held.hold }
}

describe("Booking Session v1 owned tracer", () => {
  it("requires the returned anonymous Session capability before mutation", async () => {
    const harness = createHarness()
    const created = await harness.module.createSession({
      target: { kind: "product", productId: "prod_owned_1" },
    })
    if (created.kind !== "session_created") throw new Error("session not created")

    const rejected = await harness.module.quoteSession(created.session.id, {
      expectedRevision: created.session.revision,
      idempotencyKey: "quote_without_capability",
    })

    expect(rejected).toMatchObject({
      kind: "rejected",
      error: { kind: "capability_required" },
    })
    expect(harness.repository.quotes.size).toBe(0)
  })

  it("creates no Booking or Allocation residue before Commit, then commits exactly once", async () => {
    const { harness, session, quote, hold } = await createQuoteAndHold()

    expect(harness.inventory.bookingIds).toEqual([])
    expect(harness.inventory.allocationIds).toEqual([])

    const committed = await harness.module.commitSession(session.id, {
      capability: session.capability,
      expectedRevision: session.revision,
      quoteId: quote.id,
      holdId: hold.id,
      idempotencyKey: "commit_key",
    })

    expect(committed).toMatchObject({
      kind: "commit_result",
      outcome: { kind: "committed", consumedSessionId: session.id, consumedQuoteId: quote.id },
    })
    expect(harness.inventory.bookingIds).toHaveLength(1)
    expect(harness.inventory.allocationIds).toHaveLength(1)
    expect(harness.repository.sessions.get(session.id)?.state).toBe("consumed")
    expect(harness.repository.quotes.get(quote.id)?.state).toBe("consumed")
    expect(harness.repository.holds.get(hold.id)?.state).toBe("converted")
  })

  it("increments revision on price-relevant updates and hard-rejects superseded Quotes", async () => {
    const { harness, session, quote } = await createQuoteAndHold()

    const updated = await harness.module.updateSession(session.id, {
      capability: session.capability,
      expectedRevision: session.revision,
      state: { departureSlotId: "slot_later" },
    })

    expect(updated).toMatchObject({ kind: "session_updated", session: { revision: 2 } })
    expect(harness.repository.quotes.get(quote.id)?.state).toBe("superseded")

    const rejected = await harness.module.commitSession(session.id, {
      capability: session.capability,
      expectedRevision: 2,
      quoteId: quote.id,
      holdId: "missing_hold",
      idempotencyKey: "commit_stale_quote",
    })
    expect(rejected).toMatchObject({
      kind: "commit_result",
      outcome: { kind: "quote_failure", reason: "superseded" },
    })
    expect(harness.inventory.bookingIds).toEqual([])
  })

  it("checks Hold expiry synchronously at Commit", async () => {
    const { harness, session, quote, hold } = await createQuoteAndHold()
    harness.advance(61_000)

    const rejected = await harness.module.commitSession(session.id, {
      capability: session.capability,
      expectedRevision: session.revision,
      quoteId: quote.id,
      holdId: hold.id,
      idempotencyKey: "commit_expired_hold",
    })

    expect(rejected).toMatchObject({
      kind: "commit_result",
      outcome: { kind: "hold_failure", reason: "expired" },
    })
    expect(harness.inventory.bookingIds).toEqual([])
  })

  it("replays a stable idempotency key without creating another Booking", async () => {
    const { harness, session, quote, hold } = await createQuoteAndHold()
    const input = {
      capability: session.capability,
      expectedRevision: session.revision,
      quoteId: quote.id,
      holdId: hold.id,
      idempotencyKey: "commit_replay_key",
    }

    const first = await harness.module.commitSession(session.id, input)
    const second = await harness.module.commitSession(session.id, input)

    expect(first).toMatchObject({ kind: "commit_result", outcome: { kind: "committed" } })
    expect(second).toMatchObject({
      kind: "commit_result",
      outcome: { kind: "idempotent_replay", equivalentToOutcome: "committed" },
    })
    expect(harness.inventory.bookingIds).toHaveLength(1)
    expect(harness.inventory.allocationIds).toHaveLength(1)
  })

  it("prevents double Commit with different idempotency keys after consumption", async () => {
    const { harness, session, quote, hold } = await createQuoteAndHold()
    await harness.module.commitSession(session.id, {
      capability: session.capability,
      expectedRevision: session.revision,
      quoteId: quote.id,
      holdId: hold.id,
      idempotencyKey: "commit_once",
    })
    const second = await harness.module.commitSession(session.id, {
      capability: session.capability,
      expectedRevision: session.revision,
      quoteId: quote.id,
      holdId: hold.id,
      idempotencyKey: "commit_twice",
    })

    expect(second).toMatchObject({ kind: "rejected", error: { kind: "commit_already_consumed" } })
    expect(harness.inventory.bookingIds).toHaveLength(1)
  })

  it("proves last-seat holds do not oversell owned capacity", async () => {
    const harness = createHarness()
    const a = await createQuoteAndHold(harness)
    const created = await harness.module.createSession({
      target: { kind: "product", productId: "prod_owned_1" },
    })
    if (created.kind !== "session_created") throw new Error("session not created")
    const quoted = await harness.module.quoteSession(created.session.id, {
      capability: created.session.capability,
      expectedRevision: created.session.revision,
      idempotencyKey: "quote_b",
    })
    if (quoted.kind !== "quote_created") throw new Error("quote not created")

    const secondHold = await harness.module.placeHold(created.session.id, {
      capability: created.session.capability,
      expectedRevision: created.session.revision,
      quoteId: quoted.quote.id,
      idempotencyKey: "hold_b",
    })

    expect(a.hold.state).toBe("active")
    expect(secondHold).toMatchObject({
      kind: "rejected",
      error: { kind: "availability_changed", nextAction: "request_new_hold" },
    })
  })
})
