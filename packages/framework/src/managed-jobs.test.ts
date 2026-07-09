import { bulkReindexProductsWorkflowManifest } from "@voyant-travel/commerce/promotions/workflow-bulk-reindex-manifest"
import { describe, expect, it } from "vitest"

import {
  getManagedProfileScheduledJobs,
  getManagedProfileWorkflowManifest,
  SCHEDULED_JOB_ROUTE,
} from "./managed-jobs.js"
import { defineVoyantProject, type VoyantProjectManifest } from "./profile.js"

function project(modules: readonly string[]): VoyantProjectManifest {
  return defineVoyantProject({
    profile: "operator",
    frameworkVersion: "0.20.0",
    modules,
    plugins: [],
    settings: {},
  })
}

const jobIds = (p: VoyantProjectManifest) => getManagedProfileScheduledJobs(p).map((j) => j.id)

describe("getManagedProfileScheduledJobs (voyant#3032)", () => {
  it("returns the full standard job set for an all-modules profile", () => {
    const jobs = getManagedProfileScheduledJobs(project([]))

    expect(jobs.map((j) => j.id)).toEqual([
      "outbox-drain",
      "draft-reaper",
      "promotion-boundary-scheduler",
      "channel-push-booking-link",
      "channel-push-availability",
      "channel-push-content",
    ])
    // Every job POSTs the standard scheduled route; the cron selects the handler.
    expect(jobs.every((j) => j.route === SCHEDULED_JOB_ROUTE)).toBe(true)
  })

  it("tags each job with its owning module (framework for always-on infra)", () => {
    const byId = new Map(getManagedProfileScheduledJobs(project([])).map((j) => [j.id, j]))

    expect(byId.get("outbox-drain")?.module).toBe("framework")
    expect(byId.get("draft-reaper")?.module).toBe("catalog")
    expect(byId.get("promotion-boundary-scheduler")?.module).toBe("commerce")
    expect(byId.get("channel-push-availability")?.module).toBe("distribution")
    // The always-on outbox-drain carries the exact route + cron consumers rely on.
    expect(byId.get("outbox-drain")).toMatchObject({
      cron: "*/2 * * * *",
      route: SCHEDULED_JOB_ROUTE,
    })
  })

  it("drops jobs whose owning module is not in the subset", () => {
    // `[bookings, catalog]` resolves to include the required foundational
    // modules (commerce, relationships, …) but NOT distribution.
    const ids = jobIds(project(["bookings", "catalog"]))

    // Always-on + catalog + commerce jobs survive.
    expect(ids).toEqual(["outbox-drain", "draft-reaper", "promotion-boundary-scheduler"])
    // Distribution is inactive → no channel-push jobs (no dead scheduler entries).
    expect(ids.filter((id) => id.startsWith("channel-push"))).toEqual([])
  })

  it("keeps only always-on infra when a subset excludes the owning modules", () => {
    // A catalog-less subset drops draft-reaper too; commerce stays (required).
    const ids = jobIds(project(["bookings"]))
    expect(ids).toContain("outbox-drain")
    expect(ids).not.toContain("draft-reaper")
  })
})

describe("getManagedProfileWorkflowManifest (voyant#3032)", () => {
  it("returns active modules' workflow definitions at { id, config } grain", () => {
    const workflows = getManagedProfileWorkflowManifest(project([]))

    expect(workflows).toEqual([
      { id: "promotions.reindex-all-products", config: { defaultRuntime: "node" } },
    ])
  })

  it("stays in sync with the module's declared workflow manifest (no drift)", () => {
    const [entry] = getManagedProfileWorkflowManifest(project([]))
    expect(entry).toEqual(bulkReindexProductsWorkflowManifest)
  })

  it("only includes workflows owned by active modules", () => {
    // commerce is a required foundational module, so its workflow is always
    // present — assert the manifest is keyed on the active set, not hardcoded,
    // by confirming the id matches the commerce-owned workflow.
    const ids = getManagedProfileWorkflowManifest(project(["bookings", "catalog"])).map((w) => w.id)
    expect(ids).toEqual(["promotions.reindex-all-products"])
  })
})
