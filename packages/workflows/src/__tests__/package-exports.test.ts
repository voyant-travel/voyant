import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import * as workflowConfig from "../config.js"
import * as workflows from "../index.js"

interface ConditionalExport {
  types: string
  import: string
  default: string
}

interface PackageJson {
  exports: Record<string, ConditionalExport>
  publishConfig: {
    exports: Record<string, ConditionalExport>
  }
}

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as PackageJson

const publicSubpaths = [
  ".",
  "./testing",
  "./protocol",
  "./handler",
  "./auth",
  "./client",
  "./bindings",
  "./config",
  "./errors",
  "./rate-limit",
  "./driver",
  "./events",
  "./http-ingest",
]

describe("@voyant-travel/workflows package exports", () => {
  it("exports the workflow authoring helper from the package root", () => {
    expect(workflows).toHaveProperty("defineWorkflow")
  })

  it("uses a domain-qualified workflow runtime config helper", () => {
    expect(workflowConfig).toHaveProperty("defineWorkflowConfig")
    expect(workflowConfig).not.toHaveProperty("defineConfig")
  })

  it("publishes the events subpath with resolver-compatible conditions", () => {
    expect(packageJson.publishConfig.exports["./events"]).toEqual({
      types: "./dist/events/index.d.ts",
      import: "./dist/events/index.js",
      default: "./dist/events/index.js",
    })
  })

  it("keeps public subpath export conditions internally consistent", () => {
    for (const exportPath of publicSubpaths) {
      expect(packageJson.exports[exportPath]).toMatchObject({
        types: expect.any(String),
        import: expect.any(String),
        default: expect.any(String),
      })
      expect(packageJson.exports[exportPath].default).toBe(packageJson.exports[exportPath].import)

      expect(packageJson.publishConfig.exports[exportPath]).toMatchObject({
        types: expect.any(String),
        import: expect.any(String),
        default: expect.any(String),
      })
      expect(packageJson.publishConfig.exports[exportPath].default).toBe(
        packageJson.publishConfig.exports[exportPath].import,
      )
    }
  })
})
