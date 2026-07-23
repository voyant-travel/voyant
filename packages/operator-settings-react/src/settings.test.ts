import { describe, expect, it, vi } from "vitest"
import { mergeOperatorProfileSetupPrefill } from "./operator-profile-setup-prefill.js"
import { createSelectedOperatorSettingsAdminExtension } from "./settings.js"
import { createSelectedOperatorWebhooksAdminExtension } from "./webhooks.js"

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

  it("validates and initializes empty business identity fields without overwriting data", () => {
    expect(
      mergeOperatorProfileSetupPrefill(
        { name: "Persisted", legalName: "", email: "" },
        { name: "Provisioned", legalName: "Acme SRL", email: 42, ignored: "value" },
      ),
    ).toEqual({ name: "Persisted", legalName: "Acme SRL", email: "" })
  })
})

describe("operator webhook settings contribution", () => {
  it("contributes list and subscription detail settings routes", () => {
    const extension = createSelectedOperatorWebhooksAdminExtension()

    expect(extension.settingsPages).toEqual([
      expect.objectContaining({ id: "webhooks", path: "/webhooks", title: "Webhooks" }),
    ])
    expect(extension.routes).toEqual([
      expect.objectContaining({
        id: "operator-webhooks-detail",
        path: "/settings/webhooks/$subscriptionId",
      }),
    ])
  })
})
