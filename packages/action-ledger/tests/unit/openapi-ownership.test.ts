import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const document = JSON.parse(
  readFileSync(new URL("../../openapi/admin/action-ledger-health.json", import.meta.url), "utf8"),
) as { paths: Record<string, Record<string, { "x-voyant-api-id"?: string }>> }

describe("action ledger health OpenAPI ownership", () => {
  it("claims every health route operation", () => {
    const apiId = "@voyant-travel/action-ledger#health-extension.api"
    expect(document.paths["/v1/admin/action-ledger/health"]?.get?.["x-voyant-api-id"]).toBe(apiId)
    expect(document.paths["/v1/admin/action-ledger/health/check"]?.post?.["x-voyant-api-id"]).toBe(
      apiId,
    )
  })
})
