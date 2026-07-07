import { describe, expect, it } from "vitest"

import { createRedisKvStore } from "../src/redis-kv.js"

const describeIfRedis = process.env.REDIS_URL ? describe : describe.skip

describeIfRedis("createRedisKvStore", () => {
  it("round-trips text and JSON with TTL against REDIS_URL", async () => {
    const kv = createRedisKvStore(process.env.REDIS_URL!)
    const key = `test:kv:${Date.now()}`
    await kv.put(key, JSON.stringify({ ok: true }), { expirationTtl: 60 })
    expect(await kv.get(key, { type: "json" })).toEqual({ ok: true })
    await kv.delete(key)
    expect(await kv.get(key)).toBeNull()
  })
})
