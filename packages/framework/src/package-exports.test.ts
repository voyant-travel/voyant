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
  it("publishes only the runtime attestation assertion, never its registrar", async () => {
    expect(packageJson.exports["./runtime-attestation"]).toBe("./src/runtime-attestation.ts")
    expect(packageJson.publishConfig.exports["./runtime-attestation"]).toEqual({
      types: "./dist/runtime-attestation.d.ts",
      import: "./dist/runtime-attestation.js",
    })
    expect(packageJson.exports["./conditional-action-availability"]).toBeUndefined()
    expect(packageJson.publishConfig.exports["./conditional-action-availability"]).toBeUndefined()

    const framework = await import("./index.js")
    const attestation = await import("./runtime-attestation.js")
    expect("registerFrameworkOwnedRuntime" in framework).toBe(false)
    expect(Object.keys(attestation)).toEqual(["assertVoyantGraphMcpRuntime"])
  })

  it("publishes the self-host export contract for external generators", () => {
    expect(packageJson.exports["./self-host-export"]).toBe("./src/self-host-export.ts")
    expect(packageJson.publishConfig.exports["./self-host-export"]).toEqual({
      types: "./dist/self-host-export.d.ts",
      import: "./dist/self-host-export.js",
    })
  })

  it("publishes the selected graph OpenAPI authority used by the Node host", () => {
    expect(packageJson.exports["./selected-graph-openapi"]).toBe("./src/selected-graph-openapi.ts")
    expect(packageJson.publishConfig.exports["./selected-graph-openapi"]).toEqual({
      types: "./dist/selected-graph-openapi.d.ts",
      import: "./dist/selected-graph-openapi.js",
    })
  })
})
