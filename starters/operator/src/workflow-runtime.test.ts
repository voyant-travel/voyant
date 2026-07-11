import { __resetRegistry } from "@voyant-travel/workflows"
import { afterEach, describe, expect, it, vi } from "vitest"

// Generous: this import pulls in the whole workflow module graph and is slow
// under the concurrent full-suite run (observed >15s under CPU contention).
const workflowImportTimeoutMs = 30_000

afterEach(() => {
  __resetRegistry()
  vi.resetModules()
  vi.unstubAllEnvs()
})

describe("operator graph workflow entry", () => {
  it(
    "imports without blocking module evaluation",
    async () => {
      vi.stubEnv("DATABASE_URL", "postgres://example.invalid/voyant")

      await expect(
        Promise.race([
          import("./workflow-runtime.js"),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("workflow entry import timed out")),
              workflowImportTimeoutMs,
            ),
          ),
        ]),
      ).resolves.toBeDefined()
    },
    workflowImportTimeoutMs,
  )

  it("bootstraps channel-push deps without opening the db client", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://example.invalid/voyant")

    const { createLazyWorkflowDb } = await import("./api/runtime/operator-workflow-services.js")
    let dbCreated = 0
    const db = createLazyWorkflowDb(() => {
      dbCreated += 1
      return {
        select: vi.fn(() => "selected"),
      }
    })

    expect(dbCreated).toBe(0)
    expect(db.select()).toBe("selected")
    expect(dbCreated).toBe(1)
  })

  it(
    "resolves workflow bootstrap with an unreachable database url",
    async () => {
      vi.stubEnv("DATABASE_URL", "postgres://example.invalid/voyant")

      const { bootstrapWorkflowBundle } = await import("./workflow-runtime.js")

      const runtime = await Promise.race([
        bootstrapWorkflowBundle(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("workflow bootstrap timed out")),
            workflowImportTimeoutMs,
          ),
        ),
      ])

      expect(runtime).toMatchObject({
        workflows: expect.arrayContaining([
          expect.objectContaining({ id: "bookings.expire-stale-holds" }),
          expect.objectContaining({ id: "notifications.send-due-reminders" }),
        ]),
      })
      expect(runtime.services.has("bookings.workflows.expire-stale-holds.runtime")).toBe(true)
      expect(runtime.services.has("inventory.workflows.generate-product-pdf.runtime")).toBe(true)
      expect(runtime.services.has("notifications.workflows.reminders.runtime")).toBe(true)
      expect(runtime.services.has("distribution.workflows.channel-push.runtime")).toBe(true)
    },
    workflowImportTimeoutMs,
  )
})
