import { describe, expect, it } from "vitest"

import { createPublicDocumentDeliveryHonoModule } from "../../src/index.js"
import { publicDocumentDeliveryVoyantModule } from "../../src/voyant.js"

describe("public document delivery deployment manifest", () => {
  it("owns the anonymous public route and references a real package export", () => {
    expect(publicDocumentDeliveryVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/public-document-delivery",
      packageName: "@voyant-travel/public-document-delivery",
      requires: { ports: [{ id: "database.client" }, { id: "storage.object" }] },
      api: [
        {
          id: "@voyant-travel/public-document-delivery#api.public",
          surface: "public",
          mount: "documents",
          anonymous: true,
          runtime: {
            entry: "@voyant-travel/public-document-delivery",
            export: "createPublicDocumentDeliveryHonoModule",
          },
        },
      ],
      resources: [
        { id: "@voyant-travel/public-document-delivery#resource.database", kind: "database" },
        {
          id: "@voyant-travel/public-document-delivery#resource.documents",
          kind: "object-storage",
        },
      ],
      lifecycle: { uninstall: { default: "retain-data", purge: "not-supported" } },
    })
    expect(createPublicDocumentDeliveryHonoModule().module.name).toBe("documents")
  })
})
