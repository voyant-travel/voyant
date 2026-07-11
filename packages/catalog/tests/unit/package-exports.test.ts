import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

interface PublishedExport {
  types: string
  import: string
  default: string
}

interface PackageJson {
  exports: Record<string, string>
  publishConfig: {
    exports: Record<string, PublishedExport>
  }
}

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as PackageJson

describe("@voyant-travel/catalog package exports", () => {
  it("publishes the projection subscriber runtime contract", () => {
    expect(packageJson.exports["./projection-runtime"]).toBe("./src/projection-runtime.ts")
    expect(packageJson.publishConfig.exports["./projection-runtime"]).toEqual({
      types: "./dist/projection-runtime.d.ts",
      import: "./dist/projection-runtime.js",
      default: "./dist/projection-runtime.js",
    })
  })
})
