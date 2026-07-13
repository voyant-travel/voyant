import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

interface PackageJson {
  exports: Record<string, string>
  publishConfig: {
    exports: Record<string, { types: string; import: string }>
  }
}

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as PackageJson

describe("@voyant-travel/framework package exports", () => {
  it("publishes the selected graph OpenAPI authority used by the Node host", () => {
    expect(packageJson.exports["./selected-graph-openapi"]).toBe("./src/selected-graph-openapi.ts")
    expect(packageJson.publishConfig.exports["./selected-graph-openapi"]).toEqual({
      types: "./dist/selected-graph-openapi.d.ts",
      import: "./dist/selected-graph-openapi.js",
    })
  })
})
