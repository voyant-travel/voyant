import { describe, expect, it, vi } from "vitest"
import { runCatalogDraftReaperJob } from "../../src/draft-reaper-job.js"

describe("catalog draft reaper job", () => {
  it("resolves domain registries and delegates persistence through its runtime port", async () => {
    const resolveSourceRegistry = vi.fn(async () => ({}))
    const resolveOwnedHandlers = vi.fn(async () => ({}))
    const withDb = vi.fn(async () => ({
      scanned: 0,
      released: 0,
      releaseErrors: 0,
      deleted: 0,
      inGrace: 0,
    }))
    const runtime = { resolveSourceRegistry, resolveOwnedHandlers, withDb, reportFailure: vi.fn() }
    await runCatalogDraftReaperJob({ getPort: async () => runtime } as never)
    expect(resolveSourceRegistry).toHaveBeenCalledOnce()
    expect(resolveOwnedHandlers).toHaveBeenCalledOnce()
    expect(withDb).toHaveBeenCalledOnce()
  })
})
