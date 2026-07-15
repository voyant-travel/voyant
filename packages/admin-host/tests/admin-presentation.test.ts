import { describe, expect, it } from "vitest"

import { createAdminHostExtensions } from "../src/admin-presentation.js"

describe("admin host setup composition", () => {
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
