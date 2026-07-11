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

  it("publishes the inert index subscriber descriptors", () => {
    expect(packageJson.exports["./index-subscribers"]).toBe("./src/index-subscriber-runtime.ts")
    expect(packageJson.publishConfig.exports["./index-subscribers"]).toEqual({
      types: "./dist/index-subscriber-runtime.d.ts",
      import: "./dist/index-subscriber-runtime.js",
      default: "./dist/index-subscriber-runtime.js",
    })
  })
})
