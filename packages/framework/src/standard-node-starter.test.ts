import { describe, expect, it } from "vitest"
import { buildStandardNodeStarterSnapshot, STANDARD_NODE_STARTER } from "./standard-node-starter.js"

describe("standard Node starter contract", () => {
  it("keeps the consumer-authored tree small and domain-conventional", () => {
    expect(JSON.parse(buildStandardNodeStarterSnapshot())).toEqual(STANDARD_NODE_STARTER)
    expect(STANDARD_NODE_STARTER).toMatchInlineSnapshot(`
      {
        "deploymentTarget": "node",
        "optionalDirectories": [
          "src/api/admin",
          "src/api/public",
          "src/admin",
          "src/modules",
          "src/workflows",
          "src/jobs",
          "src/subscribers",
          "src/links",
          "src/scripts",
        ],
        "rootFiles": [
          ".env.example",
          "package.json",
          "voyant.config.ts",
        ],
        "schemaVersion": "voyant.node-starter.v1",
        "seedEntry": "src/scripts/seed.ts",
      }
    `)
  })

  it("contains no Cloudflare deployment surface", () => {
    expect(buildStandardNodeStarterSnapshot()).not.toMatch(/cloudflare|worker|wrangler/i)
  })
})
