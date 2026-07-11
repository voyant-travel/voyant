import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

interface PackageJson {
  exports: Record<string, string>
  publishConfig: {
    exports: Record<string, { types: string; import: string; default: string }>
  }
}

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as PackageJson

describe("@voyant-travel/realtime package exports", () => {
  it("publishes the admin invalidation subscriber runtime contract", () => {
    expect(packageJson.exports["./admin-invalidation-subscriber"]).toBe(
      "./src/admin-invalidation-subscriber.ts",
    )
    expect(packageJson.publishConfig.exports["./admin-invalidation-subscriber"]).toEqual({
      types: "./dist/admin-invalidation-subscriber.d.ts",
      import: "./dist/admin-invalidation-subscriber.js",
      default: "./dist/admin-invalidation-subscriber.js",
    })
  })
})
