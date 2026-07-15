import { describe, expect, it, vi } from "vitest"

import { createSelectedOperatorSettingsAdminExtension } from "./settings.js"

describe("operator setup contribution", () => {
  it("uses the existing profile surface and a read-only completion predicate", async () => {
    const extension = createSelectedOperatorSettingsAdminExtension()
    const step = extension.setupSteps?.[0]
    const fetcher = vi.fn(async () =>
      Response.json({ data: { name: "Voyant Travel", email: "hello@example.com" } }),
    )

    expect(step).toMatchObject({
      id: "@voyant-travel/operator-settings#setup.business-profile",
      href: "/settings/operator",
    })
    await expect(
      step?.isComplete({
        queryClient: {} as never,
        runtime: { baseUrl: "/api", fetcher },
        params: {},
      }),
    ).resolves.toBe(true)
    expect(fetcher).toHaveBeenCalledWith("/api/v1/admin/settings/operator-profile")
  })
})
