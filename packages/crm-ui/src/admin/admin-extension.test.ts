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

  it("does not attach components to contributions (hosts take route props)", () => {
    // The contribution contract renders zero-prop pages; the detail hosts
    // take route params as props, so host route files stay the binding layer
    // until the RFC §4.2 code-based route assembly lands.
    const extension = createCrmAdminExtension()
    for (const route of extension.routes ?? []) {
      expect(route.component).toBeUndefined()
    }
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
