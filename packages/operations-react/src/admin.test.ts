import { describe, expect, it } from "vitest"

import { createSelectedOperationsAdminExtension } from "./admin.js"

describe("createSelectedOperationsAdminExtension", () => {
  it("preserves the standard Availability and Resources navigation slots", () => {
    const extension = createSelectedOperationsAdminExtension({
      navMessages: { availability: "Disponibilitate", resources: "Resurse" },
    })

    expect(
      extension.navigation?.map(({ order, items }) => ({
        order,
        ids: items.map((item) => item.id),
        titles: items.map((item) => item.title),
        urls: items.map((item) => item.url),
      })),
    ).toEqual([
      {
        order: -110,
        ids: ["availability"],
        titles: ["Disponibilitate"],
        urls: ["/operations/availability"],
      },
      {
        order: -60,
        ids: ["resources"],
        titles: ["Resurse"],
        urls: ["/operations/resources"],
      },
    ])
    expect(extension.navigation?.every(({ items }) => items[0]?.icon)).toBe(true)
  })

  it("falls back to stable English selected navigation copy", () => {
    const extension = createSelectedOperationsAdminExtension({ navMessages: {} })
    expect(extension.navigation?.map(({ items }) => items[0]?.title)).toEqual([
      "Availability",
      "Resources",
    ])
    expect(new Set(extension.routes?.map((route) => route.title))).toEqual(
      new Set(["Availability", "Resources"]),
    )
  })
})
