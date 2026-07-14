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

describe("@voyant-travel/finance package exports", () => {
  it("publishes the import-cheap runtime port subpath", () => {
    expect(packageJson.exports["./runtime-port"]).toBe("./src/runtime-port.ts")
    expect(packageJson.publishConfig.exports["./runtime-port"]).toEqual({
      types: "./dist/runtime-port.d.ts",
      import: "./dist/runtime-port.js",
      default: "./dist/runtime-port.js",
    })
  })

  it("publishes the booking-schedule subscriber runtime subpath", () => {
    expect(packageJson.exports["./booking-schedule-subscriber"]).toBe(
      "./src/booking-schedule/subscriber-runtime.ts",
    )
    expect(packageJson.publishConfig.exports["./booking-schedule-subscriber"]).toEqual({
      types: "./dist/booking-schedule/subscriber-runtime.d.ts",
      import: "./dist/booking-schedule/subscriber-runtime.js",
      default: "./dist/booking-schedule/subscriber-runtime.js",
    })
  })

  it("publishes the Travel Credit service and graph-declared setup subpaths", () => {
    expect(packageJson.exports["./travel-credits"]).toBe("./src/service-travel-credits.ts")
    expect(packageJson.publishConfig.exports["./travel-credits"]).toEqual({
      types: "./dist/service-travel-credits.d.ts",
      import: "./dist/service-travel-credits.js",
      default: "./dist/service-travel-credits.js",
    })
    expect(packageJson.exports["./setup/travel-credits"]).toBe(
      "./src/service-travel-credits-migration.ts",
    )
    expect(packageJson.publishConfig.exports["./setup/travel-credits"]).toEqual({
      types: "./dist/service-travel-credits-migration.d.ts",
      import: "./dist/service-travel-credits-migration.js",
      default: "./dist/service-travel-credits-migration.js",
    })
  })
})
