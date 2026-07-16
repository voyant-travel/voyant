import { describe, expect, it, vi } from "vitest"

import { createFinanceRuntime } from "../../src/runtime.js"

describe("finance custom-field runtime", () => {
  it("resolves invoice-visible customer values through the database-backed runtime port", async () => {
    const resolveVisibleValues = vi.fn(async () => ({ loyalty_tier: "gold" }))
    const runtime = createFinanceRuntime(
      {
        primitives: {
          env: () => ({}),
          storage: { downloadUrl: () => undefined },
        },
      } as never,
      {
        resolveRegistry: async () => ({
          all: () => [],
          entities: () => [],
          field: () => undefined,
          forEntity: () => [],
        }),
        resolveVisibleValues,
      },
      {
        resolveNotificationDispatcher: () => undefined,
        listBookingReminderRuns: async () => [],
      },
    )

    await expect(
      runtime.resolveCustomFields?.(
        {} as never,
        {
          organizationId: "org_1",
          personId: "person_1",
        } as never,
      ),
    ).resolves.toEqual({ loyalty_tier: "gold" })
    expect(resolveVisibleValues).toHaveBeenCalledWith(
      expect.anything(),
      "organization",
      "org_1",
      "invoice",
    )
  })
})
