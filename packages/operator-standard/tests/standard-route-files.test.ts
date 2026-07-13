import { describe, expect, it } from "vitest"

import { createStandardOperatorRouteFiles } from "../src/standard-route-files"

describe("createStandardOperatorRouteFiles", () => {
  it("routes every standard frontend surface through the package runtime", () => {
    const standardOperatorRouteFiles = createStandardOperatorRouteFiles({
      presentationIds: ["@voyant-travel/storefront#presentation.customer"],
    })
    const runtime = standardOperatorRouteFiles.find(
      (file) => file.path === "_lib/operator-frontend.tsx",
    )
    expect(runtime?.source).toContain("createStandardOperatorFrontend")
    expect(runtime?.source).toContain("selectedGraphPresentationFactories")
    expect(runtime?.source).toContain('import.meta.glob("../../../src/admin/*/index.tsx"')
    expect(runtime?.source).toContain("packages/*/openapi/{admin,storefront}/*.json")

    for (const file of standardOperatorRouteFiles.filter(
      (candidate) => candidate.path !== "_lib/operator-frontend.tsx",
    )) {
      expect(file.source, file.path).toContain("operatorFrontend")
      expect(file.source, file.path).not.toContain('from "@/lib/')
      expect(file.source, file.path).not.toContain('from "@/components/')
      expect(file.source, file.path).not.toContain('from "@/routes/')
    }
  })

  it("emits Storefront routes only when its presentation is selected", () => {
    const selected = createStandardOperatorRouteFiles({
      presentationIds: ["@voyant-travel/storefront#presentation.customer"],
    })
    const absent = createStandardOperatorRouteFiles({ presentationIds: [] })

    expect(selected.filter((file) => file.path.startsWith("(storefront)/"))).toHaveLength(10)
    expect(absent.some((file) => file.path.startsWith("(storefront)/"))).toBe(false)
    expect(absent.map(({ path }) => path)).toEqual(
      selected.filter((file) => !file.path.startsWith("(storefront)/")).map(({ path }) => path),
    )
  })
})
