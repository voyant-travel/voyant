import { describe, expect, it } from "vitest"

import { createPromotionsAdminExtension } from "./index.js"

describe("createPromotionsAdminExtension", () => {
  it("contributes one nav entry and the promotions index route", () => {
    const extension = createPromotionsAdminExtension({ labels: { promotions: "Oferte" } })

    expect(extension.id).toBe("promotions")
    expect(extension.navigation?.[0]?.items[0]).toMatchObject({
      id: "promotions",
      title: "Oferte",
      url: "/promotions",
    })

    const route = extension.routes?.find((candidate) => candidate.id === "promotions-index")
    expect(route?.path).toBe("/promotions")
    expect(route?.title).toBe("Oferte")
  })

  it("carries the full route implementation as a lazy page (RFC §4.8)", async () => {
    const extension = createPromotionsAdminExtension()
    const route = extension.routes?.find((candidate) => candidate.id === "promotions-index")

    expect(route?.ssr).toBe("data-only")
    expect(route?.component).toBeUndefined()
    expect(typeof route?.loader).toBe("function")
    expect(typeof route?.page).toBe("function")

    const module = await route?.page?.()
    expect(typeof module?.default).toBe("function")
  })
})
