import { describe, expect, it } from "vitest"

import {
  createResourcesAdminExtension,
  ensureResourcesPageData,
  ResourceAllocationDetailHost,
  ResourceAssignmentDetailHost,
  ResourceDetailHost,
  ResourcePoolDetailHost,
  ResourcesBodySkeleton,
  ResourcesHost,
  ResourcesPageSkeleton,
  resourcesPageQueryFilters,
} from "./index.js"

describe("createResourcesAdminExtension", () => {
  it("contributes no navigation (resources nav is base-nav-owned)", () => {
    const extension = createResourcesAdminExtension()
    expect(extension.id).toBe("resources")
    expect(extension.navigation).toBeUndefined()
  })

  it("describes the dashboard and detail routes with unique ids and paths", () => {
    const extension = createResourcesAdminExtension()
    const routes = extension.routes ?? []
    expect(routes).toHaveLength(5)
    expect(new Set(routes.map((route) => route.id)).size).toBe(5)
    expect(routes.map((route) => route.path)).toEqual([
      "/resources",
      "/resources/$id",
      "/resources/pools/$id",
      "/resources/assignments/$id",
      "/resources/allocations/$id",
    ])
  })

  it("honors basePath and labels", () => {
    const extension = createResourcesAdminExtension({
      basePath: "/assets",
      labels: { resources: "Resurse" },
    })
    const index = extension.routes?.find((route) => route.id === "resources-index")
    expect(index?.path).toBe("/assets")
    expect(index?.title).toBe("Resurse")
    const poolDetail = extension.routes?.find((route) => route.id === "resources-pool-detail")
    expect(poolDetail?.path).toBe("/assets/pools/$id")
    expect(poolDetail?.title).toBe("Resurse")
  })

  it("carries no search contracts (the dashboard keeps tab/filter state local)", () => {
    const extension = createResourcesAdminExtension()
    for (const route of extension.routes ?? []) {
      expect(route.validateSearch).toBeUndefined()
    }
  })

  it("carries lazy page loaders instead of eager components", async () => {
    // The full route implementation lives on the contribution (RFC §4.8):
    // `page` resolves the page module lazily so it stays code-split; no
    // eager `component` reference pins it into the workspace-chrome chunk.
    const extension = createResourcesAdminExtension()
    for (const route of extension.routes ?? []) {
      expect(route.component).toBeUndefined()
      expect(typeof route.page).toBe("function")
      const module = await route.page?.()
      expect(typeof module?.default).toBe("function")
    }
  })

  it("attaches data loaders and pending skeletons to every route", () => {
    const extension = createResourcesAdminExtension()
    expect(extension.routes).toHaveLength(5)
    for (const route of extension.routes ?? []) {
      expect(typeof route.loader).toBe("function")
      expect(typeof route.pendingComponent).toBe("function")
    }
  })

  it("marks every route data-only for SSR (loaders prefetch, pages render client-side)", () => {
    const extension = createResourcesAdminExtension()
    expect(extension.routes).toHaveLength(5)
    for (const route of extension.routes ?? []) {
      expect(route.ssr).toBe("data-only")
    }
  })
})

describe("packaged resources admin hosts", () => {
  // Importable + renderable component types — the operator's thin route hosts
  // bind these directly, so a broken import surface fails here, not in an app
  // build. (Behavioral rendering needs the workspace provider stack and lives
  // with the host apps.)
  it("exports the page hosts as components from the admin entrypoint", () => {
    for (const host of [
      ResourcesHost,
      ResourceDetailHost,
      ResourcePoolDetailHost,
      ResourceAssignmentDetailHost,
      ResourceAllocationDetailHost,
      ResourcesPageSkeleton,
      ResourcesBodySkeleton,
    ]) {
      expect(typeof host).toBe("function")
    }
  })

  it("exposes the SSR loader data contract with filters matching the page hooks", () => {
    expect(typeof ensureResourcesPageData).toBe("function")
    // The dashboard awaits the default tab's list and prefetches the rest;
    // the filters object is the shared query-key contract with the page.
    expect(resourcesPageQueryFilters.resources).toEqual({ limit: 25, offset: 0 })
    expect(resourcesPageQueryFilters.products).toEqual({ limit: 100 })
    expect(Object.keys(resourcesPageQueryFilters)).toHaveLength(11)
  })
})
