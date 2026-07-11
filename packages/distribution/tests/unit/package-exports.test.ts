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

describe("@voyant-travel/distribution package exports", () => {
  it("publishes the graph subscriber runtime subpath", () => {
    expect(packageJson.exports["./channel-push-subscribers"]).toBe(
      "./src/channel-push/subscriber-runtime.ts",
    )
    expect(packageJson.publishConfig.exports["./channel-push-subscribers"]).toEqual({
      types: "./dist/channel-push/subscriber-runtime.d.ts",
      import: "./dist/channel-push/subscriber-runtime.js",
      default: "./dist/channel-push/subscriber-runtime.js",
    })
  })
})
