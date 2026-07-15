import { describe, expect, it } from "vitest"
import type { OrganizationSetup, OrganizationSetupStep } from "../../src/schema.js"
import {
  completeSetupStep,
  getSetupState,
  initializeSetup,
  type SetupStore,
  skipSetupStep,
} from "../../src/service.js"

class MemorySetupStore implements SetupStore {
  organization: OrganizationSetup | null = null
  steps = new Map<string, OrganizationSetupStep>()

  async createOrganization(input: OrganizationSetup) {
    if (this.organization) return false
    this.organization = { ...input }
    return true
  }
  async getOrganization() {
    return this.organization ? { ...this.organization } : null
  }
  async ensureStep(stepId: string, firstSeenAt: Date) {
    if (!this.steps.has(stepId)) {
      this.steps.set(stepId, { stepId, firstSeenAt, completedAt: null, skippedAt: null })
    }
  }
  async listSteps() {
    return [...this.steps.values()].map((step) => ({ ...step }))
  }
  async markCompleted(stepId: string, completedAt: Date) {
    const step = this.requireStep(stepId)
    const next = { ...step, completedAt }
    this.steps.set(stepId, next)
    return next
  }
  async markSkipped(stepId: string, skippedAt: Date) {
    const step = this.requireStep(stepId)
    const next = { ...step, skippedAt }
    this.steps.set(stepId, next)
    return next
  }
  private requireStep(stepId: string) {
    const step = this.steps.get(stepId)
    if (!step) throw new Error(`Missing ${stepId}`)
    return step
  }
}

describe("organization setup state", () => {
  it("initializes startedAt and the fresh redirect exactly once", async () => {
    const store = new MemorySetupStore()
    const first = new Date("2026-07-15T08:00:00.000Z")
    const later = new Date("2026-07-15T09:00:00.000Z")

    const initial = await initializeSetup(
      store,
      { stepIds: ["acme.profile"], fresh: true },
      {},
      first,
    )
    const repeated = await initializeSetup(
      store,
      { stepIds: ["acme.profile"], fresh: true },
      {},
      later,
    )

    expect(initial).toMatchObject({
      startedAt: first.toISOString(),
      firstRunOpenedAt: first.toISOString(),
      shouldRedirect: true,
    })
    expect(repeated).toMatchObject({
      startedAt: first.toISOString(),
      firstRunOpenedAt: first.toISOString(),
      shouldRedirect: false,
    })
  })

  it("never re-runs fresh inference after a non-fresh initialization", async () => {
    const store = new MemorySetupStore()
    const first = await initializeSetup(store, { stepIds: [], fresh: false })
    const later = await initializeSetup(store, { stepIds: [], fresh: true })
    expect(first.shouldRedirect).toBe(false)
    expect(later.shouldRedirect).toBe(false)
    expect(later.firstRunOpenedAt).toBeNull()
  })

  it("records completion and skip independently", async () => {
    const store = new MemorySetupStore()
    await initializeSetup(store, { stepIds: ["acme.profile"], fresh: false })
    const skippedAt = new Date("2026-07-15T08:10:00.000Z")
    const completedAt = new Date("2026-07-15T08:20:00.000Z")
    await skipSetupStep(store, "acme.profile", skippedAt)
    const completed = await completeSetupStep(store, "acme.profile", completedAt)

    expect(completed.skippedAt).toBe(skippedAt.toISOString())
    expect(completed.completedAt).toBe(completedAt.toISOString())
  })

  it("retains unknown steps and surfaces newly selected steps as incomplete", async () => {
    const store = new MemorySetupStore()
    await initializeSetup(store, { stepIds: ["removed.step"], fresh: false })
    await completeSetupStep(store, "removed.step")
    const state = await initializeSetup(store, { stepIds: ["new.step"], fresh: false })

    expect(state.steps.map((step) => step.stepId)).toEqual(["removed.step", "new.step"])
    expect(state.steps.find((step) => step.stepId === "new.step")).toMatchObject({
      completedAt: null,
      skippedAt: null,
    })
  })

  it("returns opaque prefill without treating it as completion", async () => {
    const store = new MemorySetupStore()
    const state = await initializeSetup(
      store,
      { stepIds: ["acme.profile"], fresh: true },
      { "acme.profile": { businessName: "Acme" } },
    )
    expect(state.prefill).toEqual({ "acme.profile": { businessName: "Acme" } })
    expect(state.steps[0]?.completedAt).toBeNull()
    expect((await getSetupState(store))?.steps[0]?.completedAt).toBeNull()
  })
})
