import { describe, expect, it, vi } from "vitest"
import { runCruisesExternalCatalogRefreshJob } from "../../src/external-refresh-job.js"

describe("external cruise refresh job", () => {
  it("runs the admitted payload-free runtime port", async () => {
    const run = vi.fn(async () => ({ cruiseSearchIndex: { adapters: [], upserted: 0, removed: 0, errors: [] } }))
    await runCruisesExternalCatalogRefreshJob({ getPort: async () => ({ run }) } as never)
    expect(run).toHaveBeenCalledOnce()
  })
})
