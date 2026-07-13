import { describe, expect, expectTypeOf, it } from "vitest"
import {
  buildStandardNodeStarterSnapshot,
  STANDARD_NODE_STARTER,
  VOYANT_STANDARD_NODE_STARTER_SCHEMA_VERSION,
} from "./standard-node-starter.js"

describe("standard Node starter contract", () => {
  it("keeps the consumer-authored tree small and domain-conventional", () => {
    expect(JSON.parse(buildStandardNodeStarterSnapshot())).toEqual(STANDARD_NODE_STARTER)
    expect(STANDARD_NODE_STARTER).toMatchInlineSnapshot(`
      {
        "databaseProvider": "postgres",
        "defaultPlugins": [],
        "deploymentTarget": "node",
        "developmentDependencies": [
          "@voyant-travel/cli",
          "tsx",
          "typescript",
        ],
        "gitignoreEntries": [
          ".voyant/",
          "dist/",
          "node_modules/",
          ".env",
          ".env.*",
          "!.env.example",
        ],
        "optionalDirectories": [
          "src/api/admin",
          "src/api/public",
          "src/admin",
          "src/modules",
          "src/extensions",
          "src/workflows",
          "src/jobs",
          "src/subscribers",
          "src/links",
          "src/scripts",
        ],
        "packageScripts": {
          "build": "voyant build",
          "db:migrate": "voyant migrate",
          "dev": "voyant develop",
          "seed": "voyant exec ./src/scripts/seed.ts",
          "start": "voyant start",
        },
        "rootFiles": [
          ".env.example",
          ".gitignore",
          "package.json",
          "voyant.config.ts",
        ],
        "runtimeDependencies": [
          "@voyant-travel/framework",
          "@voyant-travel/runtime",
          "@voyant-travel/operator-standard",
          "pg",
        ],
        "schemaVersion": "voyant.node-starter.v2",
        "seedEntry": "src/scripts/seed.ts",
      }
    `)
  })

  it("contains no Cloudflare deployment surface", () => {
    expect(buildStandardNodeStarterSnapshot()).not.toMatch(/cloudflare|worker|wrangler/i)
  })

  it("requires integrations to be selected explicitly", () => {
    expect(STANDARD_NODE_STARTER.defaultPlugins).toEqual([])
    expect(buildStandardNodeStarterSnapshot()).not.toMatch(/smartbill/i)
  })

  it("preserves literal readonly types for consumers", () => {
    expectTypeOf(
      VOYANT_STANDARD_NODE_STARTER_SCHEMA_VERSION,
    ).toEqualTypeOf<"voyant.node-starter.v2">()
    expectTypeOf<(typeof STANDARD_NODE_STARTER.rootFiles)[number]>().toEqualTypeOf<
      ".env.example" | ".gitignore" | "package.json" | "voyant.config.ts"
    >()
    expectTypeOf(STANDARD_NODE_STARTER.rootFiles).toMatchTypeOf<readonly string[]>()
    expectTypeOf(STANDARD_NODE_STARTER.defaultPlugins).toEqualTypeOf<readonly []>()
  })
})
