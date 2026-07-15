import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { createSetupRoutes } from "../../src/routes.js"

const committed = JSON.parse(
  readFileSync(new URL("../../openapi/admin/setup.json", import.meta.url), "utf8"),
) as { paths: Record<string, Record<string, { "x-voyant-api-id"?: string }>> }

describe("setup OpenAPI ownership", () => {
  it("claims every committed and live operation", () => {
    const apiId = "@voyant-travel/setup#api.admin"
    const live = createSetupRoutes().getOpenAPIDocument({
      info: { title: "test", version: "1" },
    })

    expect(Object.keys(live.paths ?? {}).sort()).toEqual(Object.keys(committed.paths).sort())
    for (const path of Object.keys(committed.paths)) {
      expect(Object.keys(live.paths?.[path] ?? {}).sort()).toEqual(
        Object.keys(committed.paths[path] ?? {}).sort(),
      )
      for (const [method, operation] of Object.entries(committed.paths[path] ?? {})) {
        expect(operation["x-voyant-api-id"]).toBe(apiId)
        expect(
          (live.paths?.[path] as Record<string, { "x-voyant-api-id"?: string }> | undefined)?.[
            method
          ]?.["x-voyant-api-id"],
        ).toBe(apiId)
      }
    }
  })
})
