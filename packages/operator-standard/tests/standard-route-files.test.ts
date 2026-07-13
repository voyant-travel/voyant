import { describe, expect, it } from "vitest"

import { standardOperatorRouteFiles } from "../src/standard-route-files"

describe("standardOperatorRouteFiles", () => {
  it("routes every standard frontend surface through the package runtime", () => {
    const runtime = standardOperatorRouteFiles.find(
      (file) => file.path === "_lib/operator-frontend.tsx",
    )
    expect(runtime?.source).toContain("createStandardOperatorFrontend")
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
})
