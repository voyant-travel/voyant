import { describe, expect, it } from "vitest"
import { legalVoyantModule } from "../../src/voyant.js"

describe("legal deployment manifest", () => {
  it("owns the selected legal package surfaces", () => {
    expect(legalVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/legal",
      packageName: "@voyant-travel/legal",
      api: [
        {
          id: "@voyant-travel/legal#api",
          surface: "admin",
          transactional: true,
          runtime: {
            entry: "@voyant-travel/legal",
            export: "createLegalHonoModule",
          },
        },
      ],
      schema: [{ id: "@voyant-travel/legal#schema" }],
      migrations: [{ id: "@voyant-travel/legal#migrations" }],
    })
    expect(legalVoyantModule.links?.map((link) => link.id)).toEqual([
      "@voyant-travel/legal#linkable.contract",
      "@voyant-travel/legal#linkable.contractTemplate",
      "@voyant-travel/legal#linkable.policy",
      "@voyant-travel/legal#linkable.policyVersion",
      "@voyant-travel/legal#linkable.policyAcceptance",
      "@voyant-travel/legal#linkable.term",
    ])
  })
})
