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

describe("@voyant-travel/legal package exports", () => {
  it("publishes the package-owned Tool runtime", () => {
    expect(packageJson.exports["./tools"]).toBe("./src/mcp-runtime.ts")
    expect(packageJson.publishConfig.exports["./tools"]).toEqual({
      types: "./dist/mcp-runtime.d.ts",
      import: "./dist/mcp-runtime.js",
      default: "./dist/mcp-runtime.js",
    })
  })

  it("publishes the booking-contract subscriber runtime subpath", () => {
    expect(packageJson.exports["./booking-contract-subscriber"]).toBe(
      "./src/contracts/booking-contract-subscriber-runtime.ts",
    )
    expect(packageJson.publishConfig.exports["./booking-contract-subscriber"]).toEqual({
      types: "./dist/contracts/booking-contract-subscriber-runtime.d.ts",
      import: "./dist/contracts/booking-contract-subscriber-runtime.js",
      default: "./dist/contracts/booking-contract-subscriber-runtime.js",
    })
  })
})
