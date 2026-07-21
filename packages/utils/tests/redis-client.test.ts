import { beforeEach, describe, expect, it, vi } from "vitest"

const redisConstructed = vi.hoisted(() => [] as Array<{ options: { url: string; token: string } }>)

vi.mock("@upstash/redis", () => {
  class Redis {
    constructor(readonly options: { url: string; token: string }) {
      redisConstructed.push({ options })
    }
  }

  return { Redis }
})

async function createClient(redisUrl: string) {
  const { createLazyRedisClient } = await import("../src/redis-client.js")
  return createLazyRedisClient(redisUrl).get()
}

beforeEach(() => {
  redisConstructed.length = 0
  vi.resetModules()
})

describe("createLazyRedisClient Redis REST URL parsing", () => {
  it("percent-decodes URL password tokens exactly once", async () => {
    await createClient("https://default:a%40b%3Ac%2Fd%3Fe%23f%25g@example.test/redis")

    expect(redisConstructed[0]?.options.url).toBe("https://example.test/redis")
    expect(redisConstructed[0]?.options.token).toBe(["a@b", "c/d?e#f%g"].join(":"))
  })

  it("does not decode query tokens a second time", async () => {
    await createClient("https://example.test/redis?token=a%40b%3Ac%2Fd%3Fe%23f%25g")

    expect(redisConstructed[0]?.options.url).toBe("https://example.test/redis")
    expect(redisConstructed[0]?.options.token).toBe(["a@b", "c/d?e#f%g"].join(":"))
  })

  it("preserves query token percent sequences that would be malformed if decoded again", async () => {
    await createClient("https://example.test/redis?token=%25E0%25A4%25A")

    expect(redisConstructed[0]?.options.url).toBe("https://example.test/redis")
    expect(redisConstructed[0]?.options.token).toBe(["%E0", "%A4", "%A"].join(""))
  })

  it("throws for malformed percent encoding in URL password tokens", async () => {
    await expect(createClient("https://default:%E0%A4%A@example.test/redis")).rejects.toThrow(
      /URI malformed/,
    )
    expect(redisConstructed).toEqual([])
  })

  it("removes credentials and token query from the base URL passed to Upstash", async () => {
    const url = new URL("https://example.test/redis?token=query-secret&db=0")
    url.username = "default"
    url.password = "secret"

    await createClient(url.toString())

    expect(redisConstructed).toEqual([
      {
        options: {
          url: "https://example.test/redis?db=0",
          token: "secret",
        },
      },
    ])
  })
})
