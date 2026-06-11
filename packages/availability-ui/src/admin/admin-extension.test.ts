import { describe, expect, it } from "vitest"

import {
  AvailabilityIndexHost,
  AvailabilityRuleDetailHost,
  AvailabilitySlotDetailHost,
  AvailabilityStartTimeDetailHost,
  createAvailabilityAdminExtension,
  ensureAvailabilityPageData,
  OptionResourceTemplatesPanel,
} from "./index.js"

describe("createAvailabilityAdminExtension", () => {
  it("contributes no navigation (availability nav is base-nav-owned)", () => {
    const extension = createAvailabilityAdminExtension()
    expect(extension.id).toBe("availability")
    expect(extension.navigation).toBeUndefined()
  })

  it("describes the index and detail routes with unique ids and paths", () => {
    const extension = createAvailabilityAdminExtension()
    const routes = extension.routes ?? []
    expect(routes).toHaveLength(4)
    expect(new Set(routes.map((route) => route.id)).size).toBe(4)
    expect(routes.map((route) => route.path)).toEqual([
      "/availability",
      "/availability/$id",
      "/availability/rules/$id",
      "/availability/start-times/$id",
    ])
  })

  it("honors basePath and label", () => {
    const extension = createAvailabilityAdminExtension({
      basePath: "/inventory",
      label: "Disponibilitate",
    })
    const index = extension.routes?.find((route) => route.id === "availability-index")
    expect(index?.path).toBe("/inventory")
    expect(index?.title).toBe("Disponibilitate")
    const slotDetail = extension.routes?.find((route) => route.id === "availability-slot-detail")
    expect(slotDetail?.path).toBe("/inventory/$id")
    expect(slotDetail?.title).toBe("Disponibilitate")
  })

  it("carries no search contracts (the pages keep their filters local)", () => {
    const extension = createAvailabilityAdminExtension()
    for (const route of extension.routes ?? []) {
      expect(route.validateSearch).toBeUndefined()
    }
  })

  it("does not attach components to contributions (hosts take route props)", () => {
    // The contribution contract renders zero-prop pages; the detail hosts
    // take the record id as a prop, so host route files stay the binding
    // layer until the RFC §4.2 code-based route assembly lands.
    const extension = createAvailabilityAdminExtension()
    for (const route of extension.routes ?? []) {
      expect(route.component).toBeUndefined()
    }
  })
})

describe("packaged availability admin hosts", () => {
  // Importable + renderable component types — the operator's thin route
  // hosts bind these directly, so a broken import surface fails here, not in
  // an app build. (Behavioral rendering needs the workspace provider stack
  // and lives with the host apps.)
  it("exports the page hosts as components from the admin entrypoint", () => {
    for (const host of [
      AvailabilityIndexHost,
      AvailabilityRuleDetailHost,
      AvailabilitySlotDetailHost,
      AvailabilityStartTimeDetailHost,
      OptionResourceTemplatesPanel,
    ]) {
      expect(typeof host).toBe("function")
    }
  })

  it("exports the index page loader for app-side SSR binding", () => {
    expect(typeof ensureAvailabilityPageData).toBe("function")
  })
})
