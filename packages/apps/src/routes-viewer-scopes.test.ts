import type { AccessCatalog } from "@voyant-travel/types/api-keys"
import { describe, expect, it } from "vitest"
import { resolveViewerRemoteAppScopes } from "./routes.js"

const catalog: AccessCatalog = {
  resources: [
    {
      id: "finance-artifacts",
      unitId: "apps",
      resource: "finance-document-artifacts",
      label: "Artifacts",
      description: "Artifacts",
      wildcard: "explicit-resource",
      remoteSafe: true,
      actions: [
        {
          action: "write",
          label: "Write",
          description: "Write",
          wildcard: "explicit",
        },
      ],
    },
    {
      id: "apps-admin",
      unitId: "apps",
      resource: "apps",
      label: "Apps",
      description: "Apps",
      wildcard: "allow",
      actions: [{ action: "write", label: "Write", description: "Write" }],
    },
  ],
  presets: [],
}

describe("viewer scope projection for remote extensions", () => {
  it("projects only host-authorized remote-safe permissions", () => {
    expect(
      resolveViewerRemoteAppScopes(["finance-document-artifacts:write", "apps:write"], catalog),
    ).toEqual(["finance-document-artifacts:write"])
  })

  it("does not treat a generic wildcard as an explicit sensitive action", () => {
    expect(resolveViewerRemoteAppScopes(["*"], catalog)).toEqual([])
  })
})
