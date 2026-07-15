import { defineAdminExtension } from "@voyant-travel/admin"
import { describe, expect, it } from "vitest"

import { createAdminHostExtensions } from "../src/admin-presentation.js"

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
})
