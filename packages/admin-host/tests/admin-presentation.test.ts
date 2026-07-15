import { defineAdminExtension } from "@voyant-travel/admin"
import { describe, expect, it, vi } from "vitest"

import { createAdminHostExtensions, loadAdminDashboard } from "../src/admin-presentation.js"

describe("createAdminHostExtensions", () => {
  it("composes a selected extension and its settings pages once per extension id", () => {
    const team = defineAdminExtension({
      id: "auth-team",
      settingsPages: [
        {
          id: "team",
          path: "/team",
          title: "Team",
          page: async () => ({ default: () => null }),
        },
      ],
    })
    const duplicateTeamContribution = defineAdminExtension({
      id: "deployment-team",
      settingsPages: team.settingsPages,
    })
    let settingsPageIds: ReadonlyArray<string> = []

    const extensions = createAdminHostExtensions({
      core: (settingsPages) => {
        settingsPageIds = settingsPages.map(({ id }) => id)
        return defineAdminExtension({ id: "core" })
      },
      selected: () => [team, duplicateTeamContribution, team],
      navMessages: {},
    })

    expect(settingsPageIds).toEqual(["team"])
    expect(extensions.map(({ id }) => id)).toEqual(["core", "auth-team", "deployment-team"])
  })

  it("passes only composed selected and discovered setup contributions to core", () => {
    const seen: string[] = []
    createAdminHostExtensions({
      core: (_settings, setup) => {
        seen.push(...setup.steps.map((step) => step.id))
        return { id: "core" }
      },
      selected: () => [
        {
          id: "selected",
          setupSteps: [
            {
              id: "selected.step",
              order: 1,
              skippable: true,
              messages: { en: { title: "Selected", description: "Selected", action: "Open" } },
              isComplete: () => false,
            },
          ],
        },
      ],
      navMessages: {},
    })
    expect(seen).toEqual(["selected.step"])
  })

  it.each([
    "editor",
    "viewer",
  ])("does not initialize setup when a %s cannot manage it", async () => {
    const ensureQueryData = vi.fn(async () => ({ data: { total: 0 } }))
    const canInitialize = vi.fn(async () => false)
    const initialize = vi.fn(async () => ({}))

    await loadAdminDashboard(
      {
        queryClient: { ensureQueryData } as never,
        runtime: { baseUrl: "/api", fetcher: vi.fn() },
        params: {},
      },
      {
        flow: { id: "setup", canInitialize, initialize },
        steps: [],
      },
    )

    expect(canInitialize).toHaveBeenCalledOnce()
    expect(initialize).not.toHaveBeenCalled()
  })

  it("initializes a setup manager with only selected graph step ids", async () => {
    const ensureQueryData = vi.fn(async () => ({ data: { total: 0 } }))
    const initialize = vi.fn(async () => ({}))

    await loadAdminDashboard(
      {
        queryClient: { ensureQueryData } as never,
        runtime: { baseUrl: "/api", fetcher: vi.fn() },
        params: {},
      },
      {
        flow: { id: "setup", canInitialize: async () => true, initialize },
        steps: [setupStep("selected.one"), setupStep("selected.two")],
      },
    )

    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ runtime: expect.objectContaining({ baseUrl: "/api" }) }),
      { stepIds: ["selected.one", "selected.two"], fresh: true },
    )
  })
})

function setupStep(id: string) {
  return {
    id,
    order: 0,
    skippable: true,
    messages: { en: { title: id, description: id, action: "Open" } },
    isComplete: () => false,
  }
}
