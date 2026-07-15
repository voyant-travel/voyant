import { createToolRegistry, type ToolContext } from "@voyant-travel/tools"
import { describe, expect, it } from "vitest"

import { type MiceToolServices, miceTools } from "../src/tools.js"

function ctx(services?: Partial<MiceToolServices>): ToolContext & { mice?: MiceToolServices } {
  return {
    db: {},
    actor: "staff",
    audience: "staff",
    tenantId: "default",
    resolverScope: { locale: "en-GB", audience: "staff", market: "default", actor: "staff" },
    mice: services as MiceToolServices | undefined,
  }
}

describe("MICE tools", () => {
  it("registers guarded program reads and reversible writes", () => {
    const registry = createToolRegistry()
    registry.registerAll(miceTools)
    expect(
      registry
        .list()
        .map(({ name }) => name)
        .sort(),
    ).toEqual([
      "create_mice_program",
      "get_mice_program",
      "list_mice_programs",
      "update_mice_program",
    ])
    expect(
      registry
        .list()
        .filter(({ name }) => name.startsWith("create_") || name.startsWith("update_")),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ riskPolicy: expect.objectContaining({ reversible: true }) }),
        expect.objectContaining({ riskPolicy: expect.objectContaining({ reversible: true }) }),
      ]),
    )
  })

  it("routes reads through the package runtime and serializes timestamps", async () => {
    const registry = createToolRegistry()
    registry.registerAll(miceTools)
    const timestamp = new Date("2026-07-15T10:00:00.000Z")
    await expect(
      registry.dispatch<Record<string, unknown>>(
        "get_mice_program",
        { id: "mice_1" },
        ctx({
          async getProgram(id) {
            return {
              id,
              organizationId: null,
              primaryContactPersonId: null,
              accountManagerId: null,
              name: "Annual conference",
              code: null,
              type: "conference",
              status: "planning",
              destination: null,
              startDate: null,
              endDate: null,
              estimatedPax: null,
              confirmedPax: null,
              currency: null,
              budgetAmountCents: null,
              metadata: null,
              createdAt: timestamp,
              updatedAt: timestamp,
            }
          },
        }),
      ),
    ).resolves.toMatchObject({ id: "mice_1", createdAt: timestamp.toISOString() })
  })

  it("fails closed without the runtime service", async () => {
    const registry = createToolRegistry()
    registry.registerAll(miceTools)
    await expect(registry.dispatch("list_mice_programs", {}, ctx())).rejects.toMatchObject({
      code: "MISSING_SERVICE",
    })
  })
})
