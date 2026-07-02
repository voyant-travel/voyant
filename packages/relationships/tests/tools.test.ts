import { createToolRegistry, type ToolContext } from "@voyant-travel/tools"
import { describe, expect, it } from "vitest"

import { type RelationshipsToolServices, relationshipsTools } from "../src/tools.js"

function ctx(
  services?: Partial<RelationshipsToolServices>,
): ToolContext & { relationships?: RelationshipsToolServices } {
  return {
    db: {},
    actor: "staff",
    audience: "staff",
    tenantId: "default",
    resolverScope: { locale: "en-GB", audience: "staff", market: "default", actor: "staff" },
    relationships: services as RelationshipsToolServices | undefined,
  }
}

describe("relationships (crm) tools", () => {
  it("registers people + organization read tools gated on crm:read", () => {
    const registry = createToolRegistry()
    registry.registerAll(relationshipsTools)
    const list = registry.list()
    expect(list.map((t) => t.name).sort()).toEqual([
      "get_organization",
      "get_person",
      "list_organizations",
      "list_people",
    ])
    for (const t of list) {
      expect(t.tier).toBe("read")
      expect(t.requiredScopes).toEqual(["crm:read"])
    }
  })

  it("dispatches people + organization reads through the injected service", async () => {
    const registry = createToolRegistry()
    registry.registerAll(relationshipsTools)
    const services: RelationshipsToolServices = {
      async listPeople() {
        return { data: [{ id: "per_1" }] }
      },
      async getPersonById(id) {
        return { id }
      },
      async listOrganizations() {
        return { data: [] }
      },
      async getOrganizationById(id) {
        return { id }
      },
    }
    expect(await registry.dispatch("get_person", { id: "per_1" }, ctx(services))).toMatchObject({
      id: "per_1",
    })
    expect(
      await registry.dispatch("get_organization", { id: "org_1" }, ctx(services)),
    ).toMatchObject({
      id: "org_1",
    })
  })

  it("throws MISSING_SERVICE when unwired", async () => {
    const registry = createToolRegistry()
    registry.registerAll(relationshipsTools)
    await expect(registry.dispatch("list_people", {}, ctx(undefined))).rejects.toMatchObject({
      code: "MISSING_SERVICE",
    })
  })
})
