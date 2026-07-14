import { describe, expect, it } from "vitest"

import { catalogVoyantModule } from "./voyant.js"

describe("catalog deployment declaration", () => {
  it("declares Typesense as a selected catalog.indexer provider", () => {
    expect(catalogVoyantModule.providers).toContainEqual(
      expect.objectContaining({
        port: "catalog.indexer",
        selection: { role: "search", value: "typesense" },
        runtime: {
          entry: "@voyant-travel/catalog/indexer/typesense-provider",
          export: "createTypesenseGraphIndexerProvider",
        },
      }),
    )
    expect(catalogVoyantModule.requires?.ports).toContainEqual({
      id: "catalog.indexer",
      optional: true,
    })
  })

  it("keeps provider credentials optional until Typesense is selected", () => {
    expect(catalogVoyantModule.config).toContainEqual(
      expect.objectContaining({ key: "TYPESENSE_HOST", required: false }),
    )
    expect(catalogVoyantModule.secrets).toContainEqual(
      expect.objectContaining({ key: "TYPESENSE_API_KEY", required: false }),
    )
  })
})
