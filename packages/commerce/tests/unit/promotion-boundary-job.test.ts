import { describe, expect, it, vi } from "vitest"
import { runPromotionBoundaryJob } from "../../src/promotions/job-boundary-scheduler.js"

describe("promotion boundary job", () => {
  it("uses the admitted runtime and stops when no durable boundary crossed", async () => {
    const withDb = vi.fn(async () => ({ crossings: [] }))
    const createReindexService = vi.fn()
    await runPromotionBoundaryJob({
      getPort: async () => ({ withDb, createReindexService }),
    } as never)
    expect(withDb).toHaveBeenCalledOnce()
    expect(createReindexService).not.toHaveBeenCalled()
  })
})
