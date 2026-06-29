import { beforeEach, describe, expect, it, vi } from "vitest"

const outboxMocks = vi.hoisted(() => ({
  completeOutboxEvent: vi.fn(),
  failOutboxEvent: vi.fn(),
  insertOutboxEvents: vi.fn(),
}))

vi.mock("@voyant-travel/db/outbox", () => outboxMocks)

import { createRequestOutboxStore } from "../../src/lib/request-outbox-store.js"

describe("createRequestOutboxStore", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    outboxMocks.insertOutboxEvents.mockResolvedValue([{ id: "evob_1" }])
    outboxMocks.completeOutboxEvent.mockResolvedValue(undefined)
    outboxMocks.failOutboxEvent.mockResolvedValue("pending")
  })

  it("uses the request db for capture and a fresh operation db for settlement", async () => {
    const requestDb = { label: "request" }
    const operationDb = { label: "operation" }
    const dispose = vi.fn(async () => {})
    const env = { DATABASE_URL: "postgres://example" }
    const operationDbFactory = vi.fn(() => ({ db: operationDb, dispose }))
    const store = createRequestOutboxStore({
      env,
      requestDb: () => requestDb as never,
      operationDbFactory: operationDbFactory as never,
    })
    const envelope = {
      name: "product.content.changed",
      data: { id: "prod_1" },
      emittedAt: new Date().toISOString(),
    }

    await expect(store.insert(envelope)).resolves.toEqual({ id: "evob_1" })
    await store.complete("evob_1")
    await store.fail("evob_2", "boom")

    expect(outboxMocks.insertOutboxEvents).toHaveBeenCalledWith(requestDb, [envelope])
    expect(operationDbFactory).toHaveBeenCalledTimes(2)
    expect(operationDbFactory).toHaveBeenCalledWith(env)
    expect(outboxMocks.completeOutboxEvent).toHaveBeenCalledWith(operationDb, "evob_1")
    expect(outboxMocks.failOutboxEvent).toHaveBeenCalledWith(operationDb, "evob_2", "boom")
    expect(dispose).toHaveBeenCalledTimes(2)
  })

  it("keeps the existing capture error when emit runs before db middleware", async () => {
    const store = createRequestOutboxStore({
      env: { DATABASE_URL: "postgres://example" },
      requestDb: () => undefined,
      operationDbFactory: vi.fn() as never,
    })

    await expect(
      store.insert({
        name: "product.content.changed",
        data: { id: "prod_1" },
        emittedAt: new Date().toISOString(),
      }),
    ).rejects.toThrow("outbox capture needs the per-request db")
    expect(outboxMocks.insertOutboxEvents).not.toHaveBeenCalled()
  })
})
