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
  it("publishes package-owned API graph runtimes", () => {
    expect(packageJson.exports["./graph-runtime"]).toBe("./src/graph-runtime.ts")
    expect(packageJson.publishConfig.exports["./graph-runtime"]).toEqual({
      types: "./dist/graph-runtime.d.ts",
      import: "./dist/graph-runtime.js",
      default: "./dist/graph-runtime.js",
    })
  })

  it("publishes the draft-reaper workflow", () => {
    expect(packageJson.exports["./draft-reaper-workflow"]).toBe("./src/draft-reaper-workflow.ts")
    expect(packageJson.publishConfig.exports["./draft-reaper-workflow"]).toEqual({
      types: "./dist/draft-reaper-workflow.d.ts",
      import: "./dist/draft-reaper-workflow.js",
      default: "./dist/draft-reaper-workflow.js",
    })
  })

  it("publishes the projection subscriber runtime contract", () => {
    expect(packageJson.exports["./projection-runtime"]).toBe("./src/projection-runtime.ts")
    expect(packageJson.publishConfig.exports["./projection-runtime"]).toEqual({
      types: "./dist/projection-runtime.d.ts",
      import: "./dist/projection-runtime.js",
      default: "./dist/projection-runtime.js",
    })
  })

  it("publishes the index subscriber graph runtimes", () => {
    expect(packageJson.exports["./index-subscribers"]).toBe("./src/index-subscriber-runtime.ts")
    expect(packageJson.publishConfig.exports["./index-subscribers"]).toEqual({
      types: "./dist/index-subscriber-runtime.d.ts",
      import: "./dist/index-subscriber-runtime.js",
      default: "./dist/index-subscriber-runtime.js",
    })
  })

  it("publishes the booking snapshot subscriber graph runtime", () => {
    expect(packageJson.exports["./booking-snapshot-subscriber"]).toBe(
      "./src/booking-snapshot-subscriber-runtime.ts",
    )
    expect(packageJson.publishConfig.exports["./booking-snapshot-subscriber"]).toEqual({
      types: "./dist/booking-snapshot-subscriber-runtime.d.ts",
      import: "./dist/booking-snapshot-subscriber-runtime.js",
      default: "./dist/booking-snapshot-subscriber-runtime.js",
    })
  })
})
