import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"

import { createSelectedSetupAdminExtension, initializeSelectedSetup } from "../src/admin.js"

describe("selected setup admin extension", () => {
  it("owns the setup route and flow controller", () => {
    const extension = createSelectedSetupAdminExtension({ navMessages: { setup: "Configurare" } })
    expect(extension.routes?.[0]?.path).toBe("/setup")
    expect(extension.routes?.[0]?.title).toBe("Configurare")
    expect(extension.setupFlow?.id).toBe("@voyant-travel/setup#flow.organization-setup")
  })

  it("redirects only when the persisted initialize response requests it", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(response(true)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(response(false)), { status: 200 }))
    const context = {
      queryClient: new QueryClient(),
      runtime: { baseUrl: "/api", fetcher },
      params: {},
    }

    await expect(initializeSelectedSetup(context, { stepIds: [], fresh: true })).resolves.toEqual({
      redirectTo: "/setup",
    })
    await expect(initializeSelectedSetup(context, { stepIds: [], fresh: true })).resolves.toEqual(
      {},
    )
  })

  it("writes only setup state", async () => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify(response(false)), { status: 200 }),
    )
    await initializeSelectedSetup(
      { queryClient: new QueryClient(), runtime: { baseUrl: "/api", fetcher }, params: {} },
      { stepIds: ["acme.step"], fresh: false },
    )
    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/v1/admin/setup/initialize")
  })
})

function response(shouldRedirect: boolean) {
  return {
    data: {
      startedAt: "2026-07-15T08:00:00.000Z",
      firstRunOpenedAt: null,
      steps: [],
      prefill: {},
      shouldRedirect,
    },
  }
}
