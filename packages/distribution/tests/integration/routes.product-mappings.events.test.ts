/**
 * Product-mapping publication events.
 *
 * Verifies that every product↔channel mapping write path emits
 * `product.publication.changed` from the SERVICE layer (via the routes that
 * pass the request-scoped bus through), including the batch paths that fan out
 * over the single-item service methods. The event carries the prev/new mapping
 * active state, the operation source, and the channel kind/status.
 */

import type { EventBus } from "@voyant-travel/core"
import { Hono } from "hono"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { PRODUCT_PUBLICATION_CHANGED_EVENT } from "../../src/events.js"
import { distributionRoutes } from "../../src/routes.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

interface CapturedEvent {
  event: string
  data: Record<string, unknown>
}

function createCapturingBus(): { bus: EventBus; events: CapturedEvent[] } {
  const events: CapturedEvent[] = []
  // Structural capturing bus — only `emit`/`subscribe` are exercised, so a
  // single widening assertion from the implemented subset is enough (no
  // double `as unknown as` cast).
  const bus: Pick<EventBus, "emit" | "subscribe"> = {
    async emit(event: string, data: unknown) {
      events.push({ event, data: data as Record<string, unknown> })
    },
    subscribe() {
      return { unsubscribe() {} } as ReturnType<EventBus["subscribe"]>
    },
  }
  return { bus: bus as EventBus, events }
}

describe.skipIf(!DB_AVAILABLE)("product mapping publication events", () => {
  let app: Hono
  let db: ReturnType<typeof import("@voyant-travel/db/test-utils").createTestDb>
  let captured: ReturnType<typeof createCapturingBus>
  let channelSeq = 0

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)

    app = new Hono()
    app.use("*", async (c, next) => {
      c.set("db" as never, db)
      c.set("userId" as never, "test-user-id")
      c.set("eventBus" as never, captured.bus)
      await next()
    })
    app.route("/", distributionRoutes)
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db as never)
    captured = createCapturingBus()
  })

  async function seedChannel(overrides: Record<string, unknown> = {}) {
    channelSeq++
    const res = await app.request("/channels", {
      method: "POST",
      ...json({ name: `Channel-${channelSeq}`, kind: "direct", ...overrides }),
    })
    return (await res.json()).data as { id: string; kind: string; status: string }
  }

  async function seedProduct() {
    const { products } = await import("../../../inventory/src/schema.js")
    const [row] = await (db as never as import("drizzle-orm/postgres-js").PostgresJsDatabase)
      .insert(products)
      .values({ name: `Test Product ${Date.now()}-${Math.random()}`, sellCurrency: "USD" })
      .returning()
    return row! as { id: string }
  }

  function publicationEvents() {
    return captured.events.filter((e) => e.event === PRODUCT_PUBLICATION_CHANGED_EVENT)
  }

  it("emits `created` with prev=null and the channel kind/status", async () => {
    const channel = await seedChannel({ kind: "direct", status: "active" })
    const product = await seedProduct()

    const res = await app.request("/product-mappings", {
      method: "POST",
      ...json({ channelId: channel.id, productId: product.id }),
    })
    expect(res.status).toBe(201)

    const events = publicationEvents()
    expect(events).toHaveLength(1)
    expect(events[0]!.data).toMatchObject({
      productId: product.id,
      channelId: channel.id,
      operation: "created",
      previousActive: null,
      nextActive: true,
      channelKind: "direct",
      channelStatus: "active",
    })
  })

  it("emits `deactivated` then `activated` when the active flag flips", async () => {
    const channel = await seedChannel()
    const product = await seedProduct()
    const created = await app.request("/product-mappings", {
      method: "POST",
      ...json({ channelId: channel.id, productId: product.id }),
    })
    const mappingId = (await created.json()).data.id as string
    captured = createCapturingBus() // reset after the create event

    const off = await app.request(`/product-mappings/${mappingId}`, {
      method: "PATCH",
      ...json({ active: false }),
    })
    expect(off.status).toBe(200)
    expect(publicationEvents()[0]!.data).toMatchObject({
      operation: "deactivated",
      previousActive: true,
      nextActive: false,
    })

    captured = createCapturingBus()
    const on = await app.request(`/product-mappings/${mappingId}`, {
      method: "PATCH",
      ...json({ active: true }),
    })
    expect(on.status).toBe(200)
    expect(publicationEvents()[0]!.data).toMatchObject({
      operation: "activated",
      previousActive: false,
      nextActive: true,
    })
  })

  it("emits `updated` when a non-active field changes", async () => {
    const channel = await seedChannel()
    const product = await seedProduct()
    const created = await app.request("/product-mappings", {
      method: "POST",
      ...json({ channelId: channel.id, productId: product.id }),
    })
    const mappingId = (await created.json()).data.id as string
    captured = createCapturingBus()

    await app.request(`/product-mappings/${mappingId}`, {
      method: "PATCH",
      ...json({ externalProductId: "ext-123" }),
    })
    expect(publicationEvents()[0]!.data).toMatchObject({
      operation: "updated",
      previousActive: true,
      nextActive: true,
    })
  })

  it("emits `deleted` with next=null carrying the affected product/channel", async () => {
    const channel = await seedChannel()
    const product = await seedProduct()
    const created = await app.request("/product-mappings", {
      method: "POST",
      ...json({ channelId: channel.id, productId: product.id }),
    })
    const mappingId = (await created.json()).data.id as string
    captured = createCapturingBus()

    const res = await app.request(`/product-mappings/${mappingId}`, { method: "DELETE" })
    expect(res.status).toBe(200)
    expect(publicationEvents()[0]!.data).toMatchObject({
      productId: product.id,
      channelId: channel.id,
      operation: "deleted",
      previousActive: true,
      nextActive: null,
    })
  })

  it("emits for every id in a batch-update (batch paths don't bypass emission)", async () => {
    const channel = await seedChannel()
    const p1 = await seedProduct()
    const p2 = await seedProduct()
    const ids: string[] = []
    for (const product of [p1, p2]) {
      const res = await app.request("/product-mappings", {
        method: "POST",
        ...json({ channelId: channel.id, productId: product.id }),
      })
      ids.push((await res.json()).data.id as string)
    }
    captured = createCapturingBus()

    const res = await app.request("/product-mappings/batch-update", {
      method: "POST",
      ...json({ ids, patch: { active: false } }),
    })
    expect(res.status).toBe(200)
    const events = publicationEvents()
    expect(events).toHaveLength(2)
    for (const e of events) {
      expect(e.data.operation).toBe("deactivated")
    }
  })
})
