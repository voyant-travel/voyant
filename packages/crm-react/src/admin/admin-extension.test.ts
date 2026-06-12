import { describe, expect, it } from "vitest"

import {
  createCrmAdminExtension,
  OrganizationDetailHost,
  OrganizationDetailSkeleton,
  OrganizationsHost,
  OrganizationsListSkeleton,
  PeopleHost,
  PeopleListSkeleton,
  PersonDetailHost,
  PersonDetailSkeleton,
  personDetailBookingsTabSlot,
} from "./index.js"

describe("createCrmAdminExtension", () => {
  it("contributes no navigation (people/organizations nav is base-nav-owned)", () => {
    const extension = createCrmAdminExtension()
    expect(extension.id).toBe("crm")
    expect(extension.navigation).toBeUndefined()
  })

  it("describes the people and organization routes with unique ids and paths", () => {
    const extension = createCrmAdminExtension()
    const routes = extension.routes ?? []
    expect(routes).toHaveLength(4)
    expect(new Set(routes.map((route) => route.id)).size).toBe(4)
    expect(routes.map((route) => route.path)).toEqual([
      "/people",
      "/people/$id",
      "/organizations",
      "/organizations/$id",
    ])
  })

  it("honors base paths and labels", () => {
    const extension = createCrmAdminExtension({
      peopleBasePath: "/persoane",
      organizationsBasePath: "/organizatii",
      labels: { people: "Persoane", organizations: "Organizatii" },
    })
    const peopleIndex = extension.routes?.find((route) => route.id === "crm-people-index")
    expect(peopleIndex?.path).toBe("/persoane")
    expect(peopleIndex?.title).toBe("Persoane")
    const organizationsDetail = extension.routes?.find(
      (route) => route.id === "crm-organizations-detail",
    )
    expect(organizationsDetail?.path).toBe("/organizatii/$id")
    expect(organizationsDetail?.title).toBe("Organizatii")
  })

  it("carries no search contracts (CRM lists keep filter state in memory)", () => {
    const extension = createCrmAdminExtension()
    for (const route of extension.routes ?? []) {
      expect(route.validateSearch).toBeUndefined()
    }
  })

  it("carries lazy page loaders instead of eager components", async () => {
    // The full route implementation lives on the contribution (RFC §4.8):
    // `page` resolves the page module lazily so it stays code-split; no
    // eager `component` reference pins it into the workspace-chrome chunk.
    const extension = createCrmAdminExtension()
    for (const route of extension.routes ?? []) {
      expect(route.component).toBeUndefined()
      expect(typeof route.page).toBe("function")
      const module = await route.page?.()
      expect(typeof module?.default).toBe("function")
    }
  })

  it("attaches data loaders and pending skeletons to every route", () => {
    const extension = createCrmAdminExtension()
    expect(extension.routes).toHaveLength(4)
    for (const route of extension.routes ?? []) {
      expect(typeof route.loader).toBe("function")
      expect(typeof route.pendingComponent).toBe("function")
    }
  })

  it("marks the list routes data-only for SSR and leaves the detail routes default", () => {
    const extension = createCrmAdminExtension()
    const ssrById = new Map(extension.routes?.map((route) => [route.id, route.ssr]))
    expect(ssrById.get("crm-people-index")).toBe("data-only")
    expect(ssrById.get("crm-organizations-index")).toBe("data-only")
    expect(ssrById.get("crm-people-detail")).toBeUndefined()
    expect(ssrById.get("crm-organizations-detail")).toBeUndefined()
  })
})

describe("packaged crm admin hosts", () => {
  // Importable + renderable component types — the operator's thin route hosts
  // bind these directly, so a broken import surface fails here, not in an app
  // build. (Behavioral rendering needs the workspace provider stack and lives
  // with the host apps.)
  it("exports the page hosts as components from the admin entrypoint", () => {
    for (const host of [
      OrganizationDetailHost,
      OrganizationDetailSkeleton,
      OrganizationsHost,
      OrganizationsListSkeleton,
      PeopleHost,
      PeopleListSkeleton,
      PersonDetailHost,
      PersonDetailSkeleton,
    ]) {
      expect(typeof host).toBe("function")
    }
  })

  it("exposes the person-bookings widget slot id (bookings-ui targets it)", () => {
    expect(personDetailBookingsTabSlot).toBe("person.details.bookings-tab")
  })
})
