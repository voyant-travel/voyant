import { describe, expect, it, vi } from "vitest"

import { CircuitOpenError, createCircuitBreaker, resilientFetch } from "../src/resilience.js"

function responseWith(status: number): Response {
  return new Response(status === 204 ? null : "{}", { status })
}

describe("resilientFetch", () => {
  it("returns a successful response without retrying", async () => {
    const fetchImpl = vi.fn(async () => responseWith(200))

    const res = await resilientFetch("https://api.example/x", {}, { fetchImpl })

    expect(res.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it("retries network errors for idempotent requests with backoff", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(responseWith(200))

    const res = await resilientFetch(
      "https://api.example/x",
      { method: "GET" },
      { fetchImpl, retry: { baseDelayMs: 1, maxDelayMs: 2 } },
    )

    expect(res.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it("retries 5xx and 429 but never other 4xx", async () => {
    const fetch5xx = vi
      .fn()
      .mockResolvedValueOnce(responseWith(503))
      .mockResolvedValueOnce(responseWith(200))
    const ok = await resilientFetch(
      "https://api.example/x",
      {},
      { fetchImpl: fetch5xx, retry: { baseDelayMs: 1 } },
    )
    expect(ok.status).toBe(200)
    expect(fetch5xx).toHaveBeenCalledTimes(2)

    const fetch404 = vi.fn(async () => responseWith(404))
    const notFound = await resilientFetch(
      "https://api.example/x",
      {},
      { fetchImpl: fetch404, retry: { baseDelayMs: 1 } },
    )
    expect(notFound.status).toBe(404)
    expect(fetch404).toHaveBeenCalledOnce()
  })

  it("does NOT retry POST by default, but does with retryNonIdempotent", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("down"))

    await expect(
      resilientFetch("https://api.example/x", { method: "POST" }, { fetchImpl: failing }),
    ).rejects.toThrow("down")
    expect(failing).toHaveBeenCalledOnce()

    failing.mockClear()
    failing.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(responseWith(201))
    const res = await resilientFetch(
      "https://api.example/x",
      { method: "POST" },
      { fetchImpl: failing, retryNonIdempotent: true, retry: { baseDelayMs: 1 } },
    )
    expect(res.status).toBe(201)
    expect(failing).toHaveBeenCalledTimes(2)
  })

  it("times out a hung attempt", async () => {
    const fetchImpl = vi.fn(
      (_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))
        }),
    )

    await expect(
      resilientFetch(
        "https://api.example/slow",
        { method: "POST" },
        { fetchImpl: fetchImpl as unknown as typeof fetch, timeoutMs: 20 },
      ),
    ).rejects.toThrow(/timed out after 20ms/)
  })

  it("exhausts attempts and surfaces the last error", async () => {
    const fetchImpl = vi.fn(async () => responseWith(500))

    await expect(
      resilientFetch(
        "https://api.example/x",
        {},
        { fetchImpl, retry: { attempts: 3, baseDelayMs: 1 } },
      ),
    ).rejects.toThrow("upstream responded 500")
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })
})

describe("circuit breaker", () => {
  it("opens after the failure threshold and rejects without touching the network", async () => {
    const breaker = createCircuitBreaker({ failureThreshold: 2, openMs: 60_000 })
    const fetchImpl = vi.fn(async () => responseWith(500))

    // Two failing calls (no retries) trip the breaker.
    for (let i = 0; i < 2; i++) {
      await expect(
        resilientFetch("https://api.example/x", {}, { fetchImpl, retry: false, breaker }),
      ).rejects.toThrow()
    }
    expect(breaker.state).toBe("open")

    fetchImpl.mockClear()
    await expect(
      resilientFetch("https://api.example/x", {}, { fetchImpl, retry: false, breaker }),
    ).rejects.toBeInstanceOf(CircuitOpenError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("half-opens after openMs: one probe closes it on success", async () => {
    vi.useFakeTimers()
    try {
      const breaker = createCircuitBreaker({ failureThreshold: 1, openMs: 1_000 })
      breaker.recordFailure()
      expect(breaker.state).toBe("open")

      vi.advanceTimersByTime(1_001)
      expect(breaker.state).toBe("half-open")

      // First caller probes…
      breaker.assertClosed()
      // …subsequent callers are still rejected while the probe is in flight.
      expect(() => breaker.assertClosed()).toThrow(CircuitOpenError)

      breaker.recordSuccess()
      expect(breaker.state).toBe("closed")
      breaker.assertClosed()
    } finally {
      vi.useRealTimers()
    }
  })

  it("a failed probe re-opens the circuit", () => {
    vi.useFakeTimers()
    try {
      const breaker = createCircuitBreaker({ failureThreshold: 1, openMs: 1_000 })
      breaker.recordFailure()
      vi.advanceTimersByTime(1_001)
      breaker.assertClosed() // probe
      breaker.recordFailure()
      expect(breaker.state).toBe("open")
    } finally {
      vi.useRealTimers()
    }
  })
})
