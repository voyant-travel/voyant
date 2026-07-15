import { describe, expect, it, vi } from "vitest"

import { createSelectedStorefrontAdminExtension } from "./admin.js"
import { emptyForm } from "./internal/storefront-settings-form.js"
import { mergeStorefrontSetupPrefill } from "./internal/storefront-setup-prefill.js"
import { getAdminStorefrontSettings } from "./operations.js"

vi.mock("./operations.js", () => ({
  getAdminStorefrontSettings: vi.fn(async () => ({
    data: { branding: { logoUrl: "https://example.com/logo.png" } },
  })),
}))

describe("storefront setup contribution", () => {
  it("uses the existing storefront settings surface and read operation", async () => {
    const extension = createSelectedStorefrontAdminExtension()
    const step = extension.setupSteps?.[0]
    const fetcher = vi.fn()

    expect(step).toMatchObject({
      id: "@voyant-travel/storefront#setup.branding",
      href: "/settings/storefront",
    })
    await expect(
      step?.isComplete({
        queryClient: {} as never,
        runtime: { baseUrl: "/api", fetcher },
        params: {},
      }),
    ).resolves.toBe(true)
    expect(getAdminStorefrontSettings).toHaveBeenCalledWith({ baseUrl: "/api", fetcher })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("validates and initializes empty branding fields without overwriting settings", () => {
    expect(
      mergeStorefrontSetupPrefill(
        { ...emptyForm, logoUrl: "https://persisted.test/logo.png" },
        {
          logoUrl: "https://provisioned.test/logo.png",
          primaryColor: "#123456",
          defaultLocale: "ro-RO",
          ignored: "value",
        },
      ),
    ).toMatchObject({
      logoUrl: "https://persisted.test/logo.png",
      primaryColor: "#123456",
      defaultLocale: "ro-RO",
    })
  })
})
