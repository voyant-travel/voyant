import { describe, expect, it } from "vitest"

import {
  type AdminExtension,
  adminExtensionsFromGlob,
  defineAdminExtension,
} from "../../src/extensions.js"

const widget = () => null
const loyalty = defineAdminExtension({
  id: "loyalty",
  widgets: [{ id: "loyalty-kpi", slot: "dashboard.after-kpis", component: widget }],
})
const concierge = defineAdminExtension({
  id: "concierge",
  navigation: [{ items: [{ id: "concierge", title: "Concierge", url: "/concierge" }] }],
})

describe("adminExtensionsFromGlob", () => {
  it("collects default-exported AdminExtensions in stable path order", () => {
    const found = adminExtensionsFromGlob({
      "../admin/loyalty/index.tsx": { default: loyalty },
      "../admin/concierge/index.tsx": { default: concierge },
    })
    // path-sorted: concierge before loyalty
    expect(found.map((e: AdminExtension) => e.id)).toEqual(["concierge", "loyalty"])
    expect(found[1]).toBe(loyalty)
  })

  it("returns an empty array for an empty glob (no custom admin extensions)", () => {
    expect(adminExtensionsFromGlob({})).toEqual([])
  })

  it("throws on a matched file with no default export", () => {
    expect(() => adminExtensionsFromGlob({ "../admin/loyalty/index.tsx": { named: 1 } })).toThrow(
      /no default export/,
    )
  })
})
