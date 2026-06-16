import { __resetRegistry } from "@voyant-travel/workflows"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  __resetRegistry()
  vi.unstubAllEnvs()
})

describe("operator workflow entry", () => {
  it("imports without blocking module evaluation", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://example.invalid/voyant")

    await expect(
      Promise.race([
        import("./workflows.js"),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("workflow entry import timed out")), 5_000),
        ),
      ]),
    ).resolves.toBeDefined()
  })
})
