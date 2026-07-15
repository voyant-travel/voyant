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

  async transaction<T>(run: (store: SetupStore) => Promise<T>): Promise<T> {
    const organization = this.organization ? { ...this.organization } : null
    const steps = new Map([...this.steps].map(([stepId, step]) => [stepId, { ...step }] as const))
    try {
      return await run(this)
    } catch (error) {
      this.organization = organization
      this.steps = steps
      throw error
    }
  }

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
  const profileStep = { id: "acme.profile", skippable: true } as const

  it("initializes startedAt and the fresh redirect exactly once", async () => {
    const store = new MemorySetupStore()
    const first = new Date("2026-07-15T08:00:00.000Z")
    const later = new Date("2026-07-15T09:00:00.000Z")

    const initial = await initializeSetup(
      store,
      { stepIds: ["acme.profile"], fresh: true },
      [profileStep],
      {},
      first,
    )
    const repeated = await initializeSetup(
      store,
      { stepIds: ["acme.profile"], fresh: true },
      [profileStep],
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
    const first = await initializeSetup(store, { stepIds: [], fresh: false }, [])
    const later = await initializeSetup(store, { stepIds: [], fresh: true }, [])
    expect(first.shouldRedirect).toBe(false)
    expect(later.shouldRedirect).toBe(false)
    expect(later.firstRunOpenedAt).toBeNull()
  })

  it("records completion and skip independently", async () => {
    const store = new MemorySetupStore()
    await initializeSetup(store, { stepIds: ["acme.profile"], fresh: false }, [profileStep])
    const skippedAt = new Date("2026-07-15T08:10:00.000Z")
    const completedAt = new Date("2026-07-15T08:20:00.000Z")
    await skipSetupStep(store, [profileStep], "acme.profile", skippedAt)
    const completed = await completeSetupStep(store, [profileStep], "acme.profile", completedAt)

    expect(completed.skippedAt).toBe(skippedAt.toISOString())
    expect(completed.completedAt).toBe(completedAt.toISOString())
  })

  it("retains unknown steps and surfaces newly selected steps as incomplete", async () => {
    const store = new MemorySetupStore()
    const removedStep = { id: "removed.step", skippable: true } as const
    const newStep = { id: "new.step", skippable: true } as const
    await initializeSetup(store, { stepIds: [removedStep.id], fresh: false }, [removedStep])
    await completeSetupStep(store, [removedStep], removedStep.id)
    const state = await initializeSetup(store, { stepIds: [newStep.id], fresh: false }, [newStep])

    expect(state.steps.map((step) => step.stepId)).toEqual(["new.step"])
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
      [profileStep],
      { "acme.profile": { businessName: "Acme" } },
    )
    expect(state.prefill).toEqual({ "acme.profile": { businessName: "Acme" } })
    expect(state.steps[0]?.completedAt).toBeNull()
    expect((await getSetupState(store, [profileStep]))?.steps[0]?.completedAt).toBeNull()
  })

  it("rejects initialization ids outside the selected graph", async () => {
    const store = new MemorySetupStore()
    await expect(
      initializeSetup(store, { stepIds: ["unselected.step"], fresh: true }, [profileStep]),
    ).rejects.toThrow(/do not match the selected project graph/)
    expect(store.organization).toBeNull()
  })

  it("rejects completion outside the selected graph and non-skippable skips", async () => {
    const store = new MemorySetupStore()
    const requiredStep = { id: "acme.required", skippable: false } as const
    await initializeSetup(store, { stepIds: [requiredStep.id], fresh: false }, [requiredStep])

    await expect(completeSetupStep(store, [requiredStep], "other.step")).rejects.toThrow(
      /not selected/,
    )
    await expect(skipSetupStep(store, [requiredStep], requiredStep.id)).rejects.toThrow(
      /cannot be skipped/,
    )
    expect(store.steps.get(requiredStep.id)?.skippedAt).toBeNull()
  })

  it("rolls back initialization so a retry still requests the first-run redirect", async () => {
    class FailingStore extends MemorySetupStore {
      fail = true
      override async ensureStep(stepId: string, firstSeenAt: Date) {
        await super.ensureStep(stepId, firstSeenAt)
        if (this.fail) {
          this.fail = false
          throw new Error("step insert failed")
        }
      }
    }
    const store = new FailingStore()

    await expect(
      initializeSetup(store, { stepIds: [profileStep.id], fresh: true }, [profileStep]),
    ).rejects.toThrow("step insert failed")
    expect(store.organization).toBeNull()
    expect(store.steps.size).toBe(0)

    await expect(
      initializeSetup(store, { stepIds: [profileStep.id], fresh: true }, [profileStep]),
    ).resolves.toMatchObject({ shouldRedirect: true })
  })
})
